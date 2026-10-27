import { EmptyState } from '../../components/Feedback.jsx';
import { useNavigate } from '../../lib/router.jsx';
import { useT } from '../../state/prefs.jsx';
import ErrorPage from './ErrorPage.jsx';

// what: khi một bản ghi cụ thể không tồn tại (nhân viên, dự án...), hiện ngay trong khung ứng dụng.
export default function NotFound({ what }) {
  const t = useT();
  const navigate = useNavigate();
  if (!what) return <ErrorPage code="404" />;
  return (
    <div className="page">
      <EmptyState
        mascot
        title={t('Không tìm thấy {what}', { what })}
        description={t('Bản ghi có thể đã bị xoá hoặc đường dẫn không đúng.')}
        action={t('Quay lại')}
        onAction={() => navigate(-1)}
        secondary={t('Mở danh bạ')}
        onSecondary={() => navigate('/directory')}
      />
    </div>
  );
}
