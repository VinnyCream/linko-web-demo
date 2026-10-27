import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { RouterProvider } from './lib/router.jsx';
import { PrefsProvider } from './state/prefs.jsx';
import { SessionProvider } from './auth/session.jsx';
import { PeopleProvider } from './state/people.jsx';
import { SocialProvider } from './state/social.jsx';
import { ToastProvider } from './components/Toast.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrefsProvider>
      <RouterProvider>
        <ToastProvider>
          <SessionProvider>
            <PeopleProvider>
              <SocialProvider>
                <App />
              </SocialProvider>
            </PeopleProvider>
          </SessionProvider>
        </ToastProvider>
      </RouterProvider>
    </PrefsProvider>
  </StrictMode>,
);
