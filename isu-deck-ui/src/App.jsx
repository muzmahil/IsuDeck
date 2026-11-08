import React, { useEffect, useState } from 'react';
import useStore from './store/useStore';
import TitleBar from './components/TitleBar';
import ClientLayout from './components/ClientLayout';
import HomePage from './page';
import ProfilesPage from './pages/profiles/page';
import PluginsPage from './pages/plugins/page';
import SettingsPage from './pages/settings/page';
import UpdatePrompt from './components/UpdatePrompt';
import { checkForUpdates, compareVersions } from './utils/updater';
import './globals.css';

export default function App() {
  const {
    activeTab,
    settings,
    settingsLoaded,
    updateInfo,
    setUpdateInfo,
    setUpdatePromptOpen
  } = useStore();
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));

  useEffect(() => {
    setVisitedTabs((visited) => {
      if (visited.has(activeTab)) return visited;
      return new Set(visited).add(activeTab);
    });
  }, [activeTab]);

  useEffect(() => {
    if (!settingsLoaded || settings?.autoCheckUpdates === false) return undefined;

    let active = true;
    const checkUpdates = async () => {
      const info = await checkForUpdates();
      if (!active) return;

      setUpdateInfo(info);
      if (!info.updateAvailable) return;

      const versionWasSkipped =
        compareVersions(settings.skippedUpdateVersion, info.latestVersion) === 0;
      if (versionWasSkipped) return;

      const reminderIsPending =
        compareVersions(settings.deferredUpdateVersion, info.latestVersion) === 0
        && Number(settings.updateReminderAt) > Date.now();
      if (!reminderIsPending) setUpdatePromptOpen(true);
    };

    checkUpdates().catch((error) => {
      console.error('Background update check failed:', error);
    });

    return () => {
      active = false;
    };
  }, [
    settingsLoaded,
    settings?.autoCheckUpdates,
    settings?.skippedUpdateVersion,
    settings?.deferredUpdateVersion,
    settings?.updateReminderAt,
    setUpdateInfo,
    setUpdatePromptOpen
  ]);

  useEffect(() => {
    if (!settingsLoaded || !updateInfo?.updateAvailable) return undefined;

    const isDeferredVersion =
      compareVersions(settings.deferredUpdateVersion, updateInfo.latestVersion) === 0;
    const wasSkipped =
      compareVersions(settings.skippedUpdateVersion, updateInfo.latestVersion) === 0;
    const reminderAt = Number(settings.updateReminderAt);
    if (!isDeferredVersion || wasSkipped || !reminderAt) return undefined;

    const timeoutId = window.setTimeout(
      () => setUpdatePromptOpen(true),
      Math.max(0, reminderAt - Date.now())
    );
    return () => window.clearTimeout(timeoutId);
  }, [
    settingsLoaded,
    settings?.deferredUpdateVersion,
    settings?.skippedUpdateVersion,
    settings?.updateReminderAt,
    updateInfo,
    setUpdatePromptOpen
  ]);

  const pages = [
    ['deck', HomePage],
    ['profiles', ProfilesPage],
    ['plugins', PluginsPage],
    ['settings', SettingsPage]
  ];

  return (
    <div className="h-screen w-screen overflow-hidden select-none flex flex-col bg-[#1a1a1a] text-white">
      <TitleBar />
      <ClientLayout>
        {pages.map(([tab, Page]) => {
          const isActive = activeTab === tab;
          if (!visitedTabs.has(tab) && !isActive) return null;

          return (
            <div
              key={tab}
              style={{ display: isActive ? 'contents' : 'none' }}
              aria-hidden={!isActive}
            >
              <Page />
            </div>
          );
        })}
      </ClientLayout>
      <UpdatePrompt />
    </div>
  );
}
