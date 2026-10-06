import useStore from '../store/useStore';

export default function Sidebar() {
  const { activeTab, setActiveTab, connectionStatus, latency, t, language, restartApp, settings } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';

  const handleNavigation = (id) => {
    setActiveTab(id); 
  };
  const statusConfig = {
    driver_missing: {
      color: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]',
      title: language === 'tr' ? 'SÜRÜCÜ EKSİK' : 'DRIVER MISSING',
      text: language === 'tr' ? 'Interception sürücüsü gerekli' : 'Interception driver required'
    },
    connected: {
      color: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
      title: 'IsuDeck Engine',
      text: `${language === 'tr' ? 'Aktif' : 'Active'} (${latency}ms)`
    },
    slow: {
      color: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
      title: 'IsuDeck Engine',
      text: `${language === 'tr' ? 'Gecikmeli' : 'Slow Response'} (${latency}ms)`
    },
    disconnected: {
      color: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
      title: language === 'tr' ? 'GİRİŞ BEKLEMEDE' : 'INPUT STANDBY',
      text: language === 'tr' ? 'Giriş servisi beklemede, yeniden başlatın' : 'Input service standby, click to restart'
    },
    error: {
      color: 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] animate-pulse',
      title: language === 'tr' ? 'GİRİŞ HATASI' : 'INPUT ERROR',
      text: language === 'tr' ? 'Giriş servisi hatası. Yeniden başlatmak için tıklayın.' : 'Input service error. Click to restart.'
    }
  };

  const currentStatus = statusConfig[connectionStatus] || statusConfig.disconnected;

  const menuItems = [
    {
      id: 'deck',
      label: t('sidebar.deck', language),
      url: '/',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
      )
    },
    {
      id: 'profiles',
      label: t('sidebar.profiles', language),
      url: '/profiles',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
      )
    },
    {
      id: 'plugins',
      label: t('sidebar.plugins', language),
      url: '/plugins',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>
      )
    },
    {
      id: 'settings',
      label: t('sidebar.settings', language),
      url: '/settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
      )
    }
  ];

  return (
    <aside className="w-20 lg:w-72 bg-[#121212] border-r border-white/5 flex flex-col justify-between shrink-0 transition-all duration-300">
      <div>
        <div className="p-4 lg:p-8 lg:pb-4 flex justify-center lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300" style={{ boxShadow: `0 0 16px ${accentColor}45` }}>
              <img src="/isudeck_logo.png" alt="IsuDeck Logo" className="w-8 h-8 rounded-lg logo-img" />
            </div>
            <div className="hidden lg:flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">
                Isu<span style={{ color: accentColor }}>Deck</span>
              </h1>
              <span className="text-[10px] text-zinc-500 font-medium mt-1">by rootcf</span>
            </div>
          </div>
        </div>

        <nav className="px-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id, item.url)}
              tabIndex="-1"
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden cursor-pointer ${
                activeTab === item.id
                  ? 'bg-white/10 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {activeTab === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full shadow-md" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
              )}
              <span className="transition-colors group-hover:scale-105" style={activeTab === item.id ? { color: accentColor } : {}}>
                {item.icon}
              </span>
              <span className="hidden lg:block">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-2 lg:p-4 border-t border-white/5 bg-black/20">
        <div 
          onClick={() => {
            if (connectionStatus === 'driver_missing') {
              handleNavigation('settings');
            } else if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
              restartApp();
            }
          }}
          className={`flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-4 py-3 rounded-xl border transition-all duration-300 ${
            connectionStatus === 'driver_missing'
              ? 'bg-amber-500/10 border-amber-500/40 cursor-pointer hover:bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              : (connectionStatus === 'error' || connectionStatus === 'disconnected') 
                ? 'bg-red-500/10 border-red-500/50 cursor-pointer hover:bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
                : 'bg-[#1a1a1a] border-white/5'
          }`}
        >
          <div className="relative shrink-0">
            {connectionStatus === 'driver_missing' ? (
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/40">
                <svg className="w-4 h-4 text-amber-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
            ) : (connectionStatus === 'error' || connectionStatus === 'disconnected') ? (
               <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/30">
                 <svg className="animate-pulse" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
               </div>
            ) : (
               <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${currentStatus.color} ${connectionStatus !== 'disconnected' ? 'animate-pulse' : ''}`} />
            )}
          </div>
          <div className="hidden lg:flex flex-col">
            <span className={`text-xs font-bold ${
              connectionStatus === 'driver_missing'
                ? 'text-amber-400'
                : (connectionStatus === 'error' || connectionStatus === 'disconnected') 
                  ? 'text-red-400' 
                  : 'text-white'
            }`}>
              {currentStatus.title}
            </span>
            <span className={`text-[10px] leading-tight ${
              connectionStatus === 'driver_missing'
                ? 'text-amber-300'
                : (connectionStatus === 'error' || connectionStatus === 'disconnected') 
                  ? 'text-red-300' 
                  : 'text-zinc-500'
            }`}>
              {currentStatus.text}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}