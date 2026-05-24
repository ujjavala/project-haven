import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, WifiOff } from 'lucide-react';
import Nav from './components/Nav';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import SafeSpaces from './pages/SafeSpaces';
import Feed from './pages/Feed';
import Recovery from './pages/Recovery';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import AIAssistant from './pages/AIAssistant';
import { useTheme } from './hooks/useTheme';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const PAGE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/alerts':      'Alerts',
  '/safe-spaces': 'Safe Spaces',
  '/feed':        'Feed',
  '/recovery':    'Support',
  '/assistant':   'AI Assistant',
  '/settings':    'Settings',
};

function AppLayout() {
  useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const isHome = location.pathname === '/';
  const isAI   = location.pathname === '/assistant';
  const title  = PAGE_TITLES[location.pathname] ?? '';

  return (
    <div className="app">
      <Nav />
      <div className="app-content">
        {!online && (
          <div className="offline-banner" role="alert" aria-live="polite">
            <WifiOff size={13} />
            Offline — showing cached data. Last sync may be stale.
          </div>
        )}
        <header className="page-header">
          {!isHome ? (
            <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 34 }} />
          )}
          <span className="page-header-title">{title}</span>
        </header>
        <main className={`main-content${isAI ? ' page-fill' : ''}`} id="main-content">
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/alerts"      element={<Alerts />} />
            <Route path="/safe-spaces" element={<SafeSpaces />} />
            <Route path="/feed"        element={<Feed />} />
            <Route path="/recovery"    element={<Recovery />} />
            <Route path="/assistant"   element={<AIAssistant />} />
            <Route path="/settings"    element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding has no nav / header */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* All other routes share the side nav + page header layout */}
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}


