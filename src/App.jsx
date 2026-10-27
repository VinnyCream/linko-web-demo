import { lazy, Suspense, useEffect } from 'react';
import { ParamsProvider, matchPath, useLocation, useNavigate } from './lib/router.jsx';
import { useSession } from './auth/session.jsx';
import { hasRole } from './auth/permissions.js';
import { useT } from './state/prefs.jsx';
import AppShell from './layout/AppShell.jsx';
import { LoadingNote, Skeleton } from './components/Feedback.jsx';
import ErrorBoundary from './pages/errors/ErrorBoundary.jsx';
import ErrorPage from './pages/errors/ErrorPage.jsx';
import Login from './pages/Login.jsx';
import Feed from './pages/Feed.jsx';

// Tách bundle theo trang: trang đầu (Bảng tin) tải ngay, các trang khác tải khi mở.
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Connections = lazy(() => import('./pages/Connections.jsx'));
const Network = lazy(() => import('./pages/Network.jsx'));
const PathFinder = lazy(() => import('./pages/PathFinder.jsx'));
const Directory = lazy(() => import('./pages/Directory.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const DepartmentList = lazy(() => import('./pages/Departments.jsx').then((m) => ({ default: m.DepartmentList })));
const DepartmentDetail = lazy(() => import('./pages/Departments.jsx').then((m) => ({ default: m.DepartmentDetail })));
const ProjectList = lazy(() => import('./pages/Projects.jsx').then((m) => ({ default: m.ProjectList })));
const ProjectDetail = lazy(() => import('./pages/Projects.jsx').then((m) => ({ default: m.ProjectDetail })));
const OrgChart = lazy(() => import('./pages/OrgChart.jsx'));
const AnalyticsOverview = lazy(() => import('./pages/Analytics.jsx').then((m) => ({ default: m.AnalyticsOverview })));
const CrossDepartment = lazy(() => import('./pages/Analytics.jsx').then((m) => ({ default: m.CrossDepartment })));
const ProjectCollaboration = lazy(() => import('./pages/Analytics.jsx').then((m) => ({ default: m.ProjectCollaboration })));
const AuditLogPage = lazy(() => import('./pages/Admin.jsx').then((m) => ({ default: m.AuditLogPage })));
const IntegrityPage = lazy(() => import('./pages/Admin.jsx').then((m) => ({ default: m.IntegrityPage })));
const SystemPage = lazy(() => import('./pages/Admin.jsx').then((m) => ({ default: m.SystemPage })));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Help = lazy(() => import('./pages/Help.jsx'));

const ROUTES = [
  ['/', Feed],
  ['/messages', Messages],
  ['/notifications', Notifications],
  ['/connections', Connections],
  ['/network', Network],
  ['/path', PathFinder],
  ['/directory', Directory],
  ['/people/:id', Profile],
  ['/departments', DepartmentList],
  ['/departments/:id', DepartmentDetail],
  ['/projects', ProjectList],
  ['/projects/:id', ProjectDetail],
  ['/org', OrgChart],
  ['/analytics', AnalyticsOverview, 'hr'],
  ['/analytics/cross-department', CrossDepartment, 'hr'],
  ['/analytics/projects', ProjectCollaboration, 'hr'],
  ['/admin/audit', AuditLogPage, 'hr'],
  ['/admin/integrity', IntegrityPage, 'hr'],
  ['/admin/system', SystemPage, 'hr'],
  ['/settings', Settings],
  ['/help', Help],
  ['/error/:code', ErrorPage],
];

function PageFallback() {
  return (
    <div className="page" aria-busy="true">
      <Skeleton width="30%" height="14px" />
      <Skeleton width="45%" height="32px" className="mt-2" />
      <Skeleton lines={4} className="mt-6" />
    </div>
  );
}

function Splash() {
  const t = useT();
  return (
    <div className="splash" role="status" aria-live="polite">
      <img src="/brand/linko-mark.png" alt="" width="72" height="68" className="splash-mark" />
      <p className="t-h4">{t('Đang mở Linko')}</p>
      <LoadingNote slow lines={['Đang chuẩn bị không gian làm việc của bạn...', 'Kết nối tới Oracle 23ai lần đầu hơi lâu, chờ chút nhé.', 'Sắp xong rồi.']} />
    </div>
  );
}

export default function App() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  useEffect(() => {
    if (session.status === 'anon' && path !== '/login') navigate('/login', { replace: true });
    if (session.status === 'ready' && path === '/login') navigate('/', { replace: true });
  }, [session.status, path, navigate]);

  if (session.status === 'booting') return <Splash />;
  if (session.status !== 'ready') {
    if (path.startsWith('/error/')) return <ErrorPage code={path.split('/')[2]} />;
    return <Login />;
  }

  let match = null;
  for (const [pattern, Component, role] of ROUTES) {
    const params = matchPath(pattern, path);
    if (params) {
      match = { Component, params, role };
      break;
    }
  }

  let content;
  if (!match) content = <ErrorPage code="404" />;
  else if (match.role && !hasRole(session.role, match.role)) content = <ErrorPage code="403" />;
  else
    content = (
      <ParamsProvider params={match.params}>
        <match.Component />
      </ParamsProvider>
    );

  return (
    <AppShell>
      <ErrorBoundary resetKey={path}>
        <Suspense fallback={<PageFallback />}>{content}</Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
