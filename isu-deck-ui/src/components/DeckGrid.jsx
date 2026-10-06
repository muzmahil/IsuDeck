'use client';

import useStore, { getDynamicStateForButton } from '../store/useStore';
import { LUCIDE_ICONS } from '../utils/lucideIcons';

export const STATIC_ACTION_KEYS = new Set([
  'OPEN_APP', 'OPEN_URL', 'HOTKEY', 'PLAY_SOUND',
  'MEDIA_BUTTON', 'VOLUME_UP', 'VOLUME_DOWN', 'MUTE', 'VOLUME_MUTE',
  'MEDIA_PLAY', 'MEDIA_PLAY_PAUSE', 'MEDIA_STOP', 'MEDIA_NEXT', 'MEDIA_PREV', 'MEDIA_PREVIOUS',
  'DELAY', 'CHANGE_PROFILE', 'SWITCH_PROFILE',
  'SCREENSHOT', 'CLIPBOARD_HISTORY', 'SHOW_DESKTOP', 'TOGGLE_DESKTOP',
  'TASK_MANAGER', 'OPEN_TASK_MANAGER', 'CLOSE_WINDOW', 'LOCK_SCREEN', 'SYSTEM_LOCK',
  'TYPE_TEXT', 'TEXT_MACRO', 'RUN_COMMAND', 'OPEN_FOLDER',
  'VIRTUAL_DESKTOP_LEFT', 'VIRTUAL_DESKTOP_RIGHT',
  'SET_VARIABLE', 'CHANGE_VARIABLE', 'SET_SYSTEM_VOLUME', 'ADJUST_SYSTEM_VOLUME',
  'IF_CONDITION', 'LOOP_REPEAT',
  'BRIGHTNESS_UP', 'BRIGHTNESS_DOWN', 'TIMER_START', 'EMPTY_RECYCLE_BIN', 'SYSTEM_SLEEP', 'SWITCH_AUDIO_OUTPUT'
]);

export const resolveTemplateString = (str, variables = [], systemMetrics = {}) => {
  if (typeof str !== 'string' || !str) return str;
  return str.replace(/\{([^}]+)\}/g, (match, expression) => {
    const key = expression.trim();
    if (key.startsWith('$sys.')) {
      const metricKey = key.slice(5);
      return systemMetrics[metricKey] !== undefined ? systemMetrics[metricKey] : match;
    }
    const matchingVar = variables.find(v => v.name.toLowerCase() === key.toLowerCase());
    if (matchingVar !== undefined && matchingVar.value !== undefined) {
      return matchingVar.value;
    }
    return match;
  });
};

export default function DeckGrid({ buttons, gridSize, onTrigger, onEdit, pressedButtonIndex, readOnly = false }) {
  const { isMiniMode, dynamicButtonStates, settings, plugins, language, t, variables, systemMetrics } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';

  const getGridClasses = () => {
    if (isMiniMode) {
      switch(gridSize) {
        case 8: return "max-w-[340px] aspect-[2/4]";
        case 32: return "max-w-[350px]";
        default: return "max-w-[340px] aspect-[3/5]"; // 15
      }
    }
    switch(gridSize) {
      case 8: return "grid-cols-4 grid-rows-2 aspect-[2/1] max-w-4xl";
      case 32: return "grid-cols-8 grid-rows-4 aspect-[2/1] max-w-7xl";
      default: return "grid-cols-5 grid-rows-3 aspect-[16/10] max-w-5xl"; // 15
    }
  };

  const getInnerGridClasses = () => {
    if (isMiniMode) {
      switch(gridSize) {
        case 8: return "grid-cols-2 grid-rows-4 gap-2";
        case 32: return "grid-cols-4 grid-rows-8 gap-1";
        default: return "grid-cols-3 grid-rows-5 gap-1.5";
      }
    }
    switch(gridSize) {
      case 8: return "grid-cols-4 grid-rows-2 gap-3 md:gap-6";
      case 32: return "grid-cols-8 grid-rows-4 gap-2 md:gap-4";
      default: return "grid-cols-5 grid-rows-3 gap-3 md:gap-6";
    }
  };

  return (
    <div className={`relative w-full bg-[#181818] border border-white/5 shadow-2xl transition-all ${
      isMiniMode ? 'rounded-2xl p-2' : 'rounded-3xl p-4 md:p-8'
    } ${getGridClasses()}`}>
      {/* Vida detayları (Sadece normal modda) */}
      {!isMiniMode && (
        <>
          <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#252525] shadow-inner" />
          <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#252525] shadow-inner" />
          <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-[#252525] shadow-inner" />
          <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-[#252525] shadow-inner" />
        </>
      )}

      <div className={`grid h-full ${getInnerGridClasses()}`}>
        {Array.from({ length: gridSize }).map((_, i) => {
          const isDynAllowed = buttons[i]?.disableDynamicState !== true && settings?.enableDynamicButtonStates !== false;
          const dynState = isDynAllowed ? getDynamicStateForButton(buttons[i], dynamicButtonStates) : null;
          const isDynActive = !!dynState?.active;

          // Eksik eklenti kontrolü (Missing Plugin Guard)
          const hasMissingPlugin = buttons[i]?.actions?.some(act => {
            if (!act) return false;
            const defId = act.definitionId || act.type;
            if (!defId) return false;
            if (STATIC_ACTION_KEYS.has(defId) || STATIC_ACTION_KEYS.has(act.type)) return false;
            const pluginExists = plugins?.some(p => 
              p.identifier === act.pluginId ||
              p.name === act.category ||
              p.actions?.some(a => a.name === defId || a.name === act.type || `${a.name}` === defId)
            );
            return !pluginExists;
          });

          const lucideIconObj = buttons[i]?.iconType === 'lucide' && buttons[i]?.selectedLucideIcon 
            ? (LUCIDE_ICONS[buttons[i].selectedLucideIcon] || null)
            : null;

          const effectiveBgColor = isDynAllowed && (dynState?.bgColor || dynState?.backgroundColor || dynState?.buttonBg)
            ? (dynState.bgColor || dynState.backgroundColor || dynState.buttonBg)
            : buttons[i]?.bgColor;

          const effectiveBorderColor = isDynAllowed && (dynState?.borderColor || (isDynActive && dynState?.color))
            ? (dynState.borderColor || dynState.color)
            : (pressedButtonIndex === i ? accentColor : null);

          const effectiveGlowColor = isDynAllowed && (dynState?.glowColor || dynState?.borderColor || (isDynActive && dynState?.color))
            ? (dynState.glowColor || dynState.borderColor || dynState.color)
            : (pressedButtonIndex === i ? accentColor : null);

          const rawLabel = isDynAllowed && dynState?.label !== undefined && dynState?.label !== null && String(dynState.label).trim() !== ''
            ? dynState.label
            : (buttons[i]?.label || `KEY ${i + 1}`);
          const effectiveLabel = resolveTemplateString(rawLabel, variables, systemMetrics);

          const effectiveTextColor = isDynAllowed && dynState?.textColor
            ? dynState.textColor
            : null;

          const effectiveLucideColor = isDynAllowed && dynState?.iconColor
            ? dynState.iconColor
            : (buttons[i]?.selectedLucideColor || '#ffffff');

          const hasBadge = isDynAllowed && dynState?.badge !== undefined && dynState?.badge !== null && String(dynState.badge).trim() !== '';
          const rawBadgeText = hasBadge ? String(dynState.badge) : '';
          const badgeText = resolveTemplateString(rawBadgeText, variables, systemMetrics);
          const badgeColor = (dynState?.badgeColor || dynState?.color || '#ef4444');
          const badgeBg = dynState?.badgeBg || dynState?.badgeBackgroundColor || `${badgeColor}33`;
          const badgeBorder = dynState?.badgeBorder || `${badgeColor}80`;
          const isBadgePulsing = dynState?.pulse === true || badgeText === 'REC' || badgeText === 'LIVE';

          return (
            <div
              key={i}
              onClick={() => onTrigger(i)}
              onContextMenu={(e) => { 
                e.preventDefault(); 
                if (!readOnly && onEdit) onEdit(i); 
              }}
              className={`relative group bg-gradient-to-b from-[#2a2a2a] to-[#222] border-t border-white/10 border-b border-black/50 shadow-lg transition-all duration-100 active:scale-95 active:shadow-inner flex flex-col items-center cursor-pointer overflow-hidden ${
                isMiniMode ? 'rounded-xl p-1 min-h-[58px]' : 'rounded-2xl'
              } ${
                !readOnly ? 'hover:from-[#333] hover:to-[#2a2a2a]' : ''
              } ${
                buttons[i]?.textAlignment === 'top' ? 'justify-start pt-2' : 
                buttons[i]?.textAlignment === 'bottom' ? 'justify-end pb-2' : 
                'justify-center'
              } ${
                pressedButtonIndex === i 
                  ? 'scale-95 shadow-inner brightness-150 ring-2' 
                  : ''
              } ${
                isDynActive || effectiveBorderColor ? 'ring-1' : ''
              }`}
              style={{
                ...(effectiveBgColor ? { background: `linear-gradient(to bottom, ${effectiveBgColor}, #151515)` } : {}),
                ...(isDynAllowed && dynState?.bgGradient ? { background: dynState.bgGradient } : {}),
                ...(isDynAllowed && dynState?.solidBg ? { background: dynState.solidBg, backgroundColor: dynState.solidBg } : {}),
                ...(pressedButtonIndex === i ? {
                  borderColor: accentColor,
                  boxShadow: `0 0 16px ${accentColor}60`,
                  outlineColor: accentColor
                } : (effectiveBorderColor ? {
                  borderColor: effectiveBorderColor,
                  boxShadow: `0 0 14px ${effectiveGlowColor}40`,
                  outlineColor: effectiveBorderColor
                } : {}))
              }}
            >
              {/* Eksik Eklenti Rozeti (Flat SVG Icon) */}
              {hasMissingPlugin && (
                <div 
                  className="absolute top-1.5 left-1.5 z-30 p-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-md backdrop-blur-xs" 
                  title={t('editor.actions.missing_plugin_badge_tip', language)}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
              )}

              {/* Canlı Dinamik Durum Rozeti (Örn: REC, MUTE, LIVE, 60 FPS, %85 vb.) */}
              {hasBadge && (
                <div 
                  className={`absolute top-1.5 right-1.5 z-30 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider shadow-lg flex items-center gap-1 backdrop-blur-md max-w-[85%] truncate ${
                    isBadgePulsing ? 'animate-pulse' : ''
                  }`}
                  style={{ 
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    border: `1px solid ${badgeBorder}`
                  }}
                >
                  {dynState?.showDot !== false && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dynState?.badgeDotColor || badgeColor }} />
                  )}
                  <span className="truncate">{badgeText}</span>
                </div>
              )}

              {/* Arka Plan Görseli */}
              {buttons[i]?.bgImage && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center z-0 opacity-90" style={{ backgroundImage: `url(${buttons[i].bgImage})` }} />
                  <div className="absolute inset-0 bg-black/20 z-0" />
                </>
              )}

              {/* Tuş Yüzeyi Parlaması */}
              <div className="absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 z-10" />
              
              {/* Lucide Vektör İkon */}
              {lucideIconObj && (
                <div className={`relative z-10 drop-shadow-md flex items-center justify-center ${
                  buttons[i]?.showTitle === false ? '' : (isMiniMode ? 'mb-0.5' : 'mb-2')
                }`}>
                  <svg 
                    className={`${isMiniMode ? 'w-5 h-5' : 'w-8 h-8'}`} 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={effectiveLucideColor} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    dangerouslySetInnerHTML={{ __html: lucideIconObj.svg }}
                  />
                </div>
              )}

              {/* Plugin Özgün İkon */}
              {buttons[i]?.iconType === 'plugin' && buttons[i]?.selectedPluginIcon && (
                <div className={`relative z-10 drop-shadow-md flex items-center justify-center ${
                  buttons[i]?.showTitle === false ? '' : (isMiniMode ? 'mb-0.5' : 'mb-2')
                }`}>
                  {typeof buttons[i].selectedPluginIcon === 'string' && buttons[i].selectedPluginIcon.startsWith('<svg') ? (
                    <div 
                      className={`${isMiniMode ? 'w-5 h-5' : 'w-8 h-8'}`} 
                      dangerouslySetInnerHTML={{ __html: buttons[i].selectedPluginIcon }} 
                    />
                  ) : typeof buttons[i].selectedPluginIcon === 'object' && buttons[i].selectedPluginIcon.svg ? (
                    <div 
                      className={`${isMiniMode ? 'w-5 h-5' : 'w-8 h-8'}`} 
                      dangerouslySetInnerHTML={{ __html: buttons[i].selectedPluginIcon.svg }} 
                    />
                  ) : (
                    <img 
                      src={typeof buttons[i].selectedPluginIcon === 'object' ? (buttons[i].selectedPluginIcon.src || buttons[i].selectedPluginIcon.url) : buttons[i].selectedPluginIcon} 
                      alt="Plugin Icon" 
                      className={`object-contain ${isMiniMode ? 'w-5 h-5' : 'w-8 h-8'}`}
                    />
                  )}
                </div>
              )}

              {/* Emoji İkon */}
              {buttons[i]?.iconType === 'emoji' && buttons[i]?.selectedEmoji && (
                <div className={`drop-shadow-md filter relative z-10 ${
                  isMiniMode ? 'text-lg' : 'text-3xl'
                } ${buttons[i]?.showTitle === false ? '' : (isMiniMode ? 'mb-0.5' : 'mb-2')}`}>
                  {buttons[i].selectedEmoji}
                </div>
              )}

              {/* Resim İkon */}
              {buttons[i]?.iconType === 'image' && buttons[i]?.selectedImage && (
                <img 
                  src={buttons[i].selectedImage} 
                  alt="icon" 
                  className={`object-contain drop-shadow-md relative z-10 ${
                    isMiniMode ? 'w-6 h-6' : 'w-12 h-12'
                  } ${buttons[i]?.showTitle === false ? '' : (isMiniMode ? 'mb-0.5' : 'mb-2')}`} 
                />
              )}

              {(buttons[i]?.showTitle !== false) && (
                <span 
                  data-custom-color={buttons[i]?.bgColor || effectiveBgColor ? "true" : undefined}
                  style={effectiveTextColor ? { color: effectiveTextColor } : {}}
                  className={`font-bold tracking-tight transition-colors relative z-10 truncate max-w-[90%] text-center ${
                    effectiveTextColor ? '' : (buttons[i] ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300')
                  } ${
                    isMiniMode 
                      ? 'text-[9px]' 
                      : (buttons[i]?.textSize === 'small' ? 'text-[10px]' : buttons[i]?.textSize === 'large' ? 'text-sm' : 'text-xs')
                  }`}
                >
                  {effectiveLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}