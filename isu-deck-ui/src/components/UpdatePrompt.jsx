import { useState } from 'react';
import useStore from '../store/useStore';
import { openExternalUrl } from '../utils/updater';

const REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;

export default function UpdatePrompt() {
  const {
    language,
    updateInfo,
    updatePromptOpen,
    setUpdatePromptOpen,
    updateSetting
  } = useStore();
  const [actionError, setActionError] = useState('');
  const isTurkish = language === 'tr';

  if (!updatePromptOpen || !updateInfo?.updateAvailable) return null;

  const updateVersion = updateInfo.latestVersion;

  const handleLater = async () => {
    setActionError('');
    try {
      await updateSetting('deferredUpdateVersion', updateVersion);
      await updateSetting('updateReminderAt', Date.now() + REMINDER_DELAY_MS);
      setUpdatePromptOpen(false);
    } catch (error) {
      setActionError(error.message || String(error));
    }
  };

  const handleSkip = async () => {
    setActionError('');
    try {
      await updateSetting('skippedUpdateVersion', updateVersion);
      await updateSetting('deferredUpdateVersion', null);
      await updateSetting('updateReminderAt', 0);
      setUpdatePromptOpen(false);
    } catch (error) {
      setActionError(error.message || String(error));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-prompt-title"
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-[#181818] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 id="update-prompt-title" className="text-base font-bold text-white">
              {isTurkish ? 'IsuDeck güncellemesi mevcut' : 'IsuDeck update available'}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              {isTurkish ? 'Yeni sürüm:' : 'New version:'} v{updateVersion}
              {updateInfo.currentVersion ? ` · ${isTurkish ? 'Mevcut sürüm:' : 'Current version:'} v${updateInfo.currentVersion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUpdatePromptOpen(false)}
            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isTurkish ? 'Kapat' : 'Close'}
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          {updateInfo.releaseNotes && (
            <div>
              <h3 className="mb-2 text-xs font-bold text-white">
                {isTurkish ? 'Sürüm notları' : 'Release notes'}
              </h3>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-[#121212] p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300">
                {updateInfo.releaseNotes}
              </pre>
            </div>
          )}

          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            {isTurkish
              ? 'Güncellemeyi indirdikten sonra IsuDeck’i kapatıp mevcut IsuDeck.exe dosyasını yenisiyle değiştirin. Profil ve ayarlarınız uygulama klasöründe kalır.'
              : 'After downloading the update, close IsuDeck and replace the existing IsuDeck.exe. Your profiles and settings remain in the application folder.'}
          </p>

          {actionError && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {actionError}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => openExternalUrl(updateInfo.htmlUrl)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isTurkish ? "GitHub Releases'i aç" : 'Open GitHub Releases'}
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleLater}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isTurkish ? 'Daha sonra hatırlat' : 'Remind me later'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isTurkish ? 'Bu sürümü atla' : 'Skip this version'}
            </button>
            {updateInfo.downloadUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(updateInfo.downloadUrl)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
              >
                {isTurkish ? 'IsuDeck.exe indir' : 'Download IsuDeck.exe'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
