import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import SafeSpaces from './pages/SafeSpaces';
import Feed from './pages/Feed';
import Recovery from './pages/Recovery';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import AIAssistant from './pages/AIAssistant';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding has no nav / bottom bar */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* All other routes share the Nav + main layout */}
        <Route path="/*" element={
          <div className="app">
            <Nav />
            <main className="main-content" id="main-content">
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
        } />
      </Routes>
    </BrowserRouter>
  );
}

