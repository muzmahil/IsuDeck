'use client';

import { useState } from 'react';

export default function DisclaimerModal({ isOpen, onAccept, language }) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const isTr = language === 'tr';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#181818] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 bg-[#202020] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {isTr ? 'Güvenlik & Sorumluluk Bilgilendirmesi' : 'Safety & Liability Notice'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isTr ? 'IsuDeck ilk kullanım yönergeleri ve sistem uyarıları' : 'IsuDeck first-run guidance and system advisories'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
          {/* 1. Plugin Security */}
          <div className="p-4 rounded-xl bg-[#121212] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>{isTr ? 'Üçüncü Taraf Eklentiler (Plugins)' : 'Third-Party Plugins'}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isTr 
                ? 'IsuDeck eklentileri (plugins) yerel seviyede kod çalıştırabilir ve sisteminize tam erişim sağlayabilir. Güvenliğiniz için yalnızca kaynağına, geliştiricisine ve kodlarına güvendiğiniz eklentileri yükleyin.' 
                : 'Plugins loaded into IsuDeck execute native code and may have full system access. For your security, only install plugins from authors and repositories you trust.'}
            </p>
          </div>

          {/* 2. Key Binding Caution */}
          <div className="p-4 rounded-xl bg-[#121212] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></svg>
              <span>{isTr ? 'Donanım Seviyesinde Tuş Bloklama' : 'Hardware Keystroke Interception'}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isTr 
                ? 'IsuDeck, tuşları doğrudan kernel seviyesinde yakalar ve Windows\'a iletilmesini engeller. Günlük kullanım için hayati tuşları (Enter, Esc, Sol Tık, Space vb.) yanlışlıkla atamamaya özen gösterin. Bir tuş atamasını kaldırmak istediğinizde buton ayarlarından "Kaldır" butonuna basarak tuşu anında boşa çıkarabilirsiniz.' 
                : 'IsuDeck intercepts keystrokes at the kernel level and blocks them from reaching Windows. Be mindful not to bind critical everyday keys (Enter, Esc, Space, etc.). You can unbind any key anytime via the button editor using the "Remove" button.'}
            </p>
          </div>

          {/* 3. Liability Disclaimer */}
          <div className="p-4 rounded-xl bg-[#121212] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>{isTr ? 'Sorumluluk Reddi' : 'Disclaimer of Liability'}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isTr 
                ? 'IsuDeck açık bir donanım kontrol platformudur; kullanıcı tarafından yüklenen harici eklentilerin davranışlarından veya yapılan tuş atamalarından kaynaklanabilecek sistem aksaklıklarından kullanıcı bizzat sorumludur.' 
                : 'IsuDeck is an open hardware control platform; the user assumes full responsibility for third-party plugins executed and custom key interception mappings.'}
            </p>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={agreed} 
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded bg-[#141414] border-white/20 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-zinc-300 leading-snug">
              {isTr 
                ? 'Yukarıdaki güvenlik ve sorumluluk maddelerini okudum, anladım ve kabul ediyorum.' 
                : 'I have read, understood, and accept the security and liability notices above.'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-[#202020] flex items-center justify-end gap-3">
          <button
            disabled={!agreed}
            onClick={onAccept}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>{isTr ? 'Anladım ve Devam Et' : 'I Understand & Continue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
