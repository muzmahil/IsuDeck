import React from 'react';
import useStore from './store/useStore';
import TitleBar from './components/TitleBar';
import ClientLayout from './components/ClientLayout';
import HomePage from './page';
import ProfilesPage from './pages/profiles/page';
import PluginsPage from './pages/plugins/page';
import SettingsPage from './pages/settings/page';
import './globals.css';

export default function App() {
  const { activeTab } = useStore();

  const renderCurrentPage = () => {
    switch (activeTab) {
      case 'profiles':
        return <ProfilesPage />;
      case 'plugins':
        return <PluginsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'deck':
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden select-none flex flex-col bg-[#1a1a1a] text-white">
      <TitleBar />
      <ClientLayout>
        {renderCurrentPage()}
      </ClientLayout>
    </div>
  );
}
