// Shared binding matching rules.
//
// The deck page, the background listener (ClientLayout) and the editor's
// conflict detection must all agree on what counts as the same physical key.
// Previously each place implemented its own slightly different comparison,
// which meant a hardware key could work on the deck but not on other tabs.

const WILDCARD_HIDS = new Set(['*', 'any', 'keyboard_hook']);

/**
 * True when a stored binding HID matches an incoming message HID.
 * Missing HIDs are treated as a match so older profiles keep working.
 */
export const bindingHidsMatch = (bindingHid, messageHid) => {
  if (!bindingHid || !messageHid) return true;

  const bHid = String(bindingHid).trim();
  const mHid = String(messageHid).trim();
  if (!bHid || !mHid) return true;

  if (WILDCARD_HIDS.has(bHid.toLowerCase()) || WILDCARD_HIDS.has(mHid.toLowerCase())) {
    return true;
  }

  return (
    bHid === mHid ||
    bHid.includes(mHid) ||
    mHid.includes(bHid)
  );
};

/** True when a stored binding matches an incoming input message. */
export const bindingMatchesMessage = (binding, message) => {
  if (!binding || !message) return false;
  if (binding.key === undefined || binding.key === null) return false;
  if (String(binding.key) !== String(message.key)) return false;

  return bindingHidsMatch(binding.hid, message.hid);
};

/** Index of the first button whose binding matches the message, or null. */
export const findButtonIndexByBinding = (buttons, message) => {
  if (!Array.isArray(buttons) || !message) return null;

  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    if (!button || !button.binding) continue;
    if (bindingMatchesMessage(button.binding, message)) return index;
  }

  return null;
};
