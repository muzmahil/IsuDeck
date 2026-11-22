# IsuDeck 1.2.1 — Release Notes

This is a maintenance release. It focuses on the issues reported after 1.2.0:
reliability of variable and logic actions, smoother editing, and a refresh of the
key binding screen.

## Highlights

### A new Key Binding screen
The **Key Binding** tab has been rebuilt around a large, physical-looking keycap:

- The keycap shows the state at a glance: waiting, assigned, or empty.
- Click the keycap to start listening, press a key, and it is assigned instantly.
- **Hold Mode** is a single, clear switch with a short explanation.
- Device details are tucked into a collapsible **Technical Details** panel, so the
  tab stays compact.
- **Start Recording** and **Remove Binding** now always stay visible at the bottom,
  even in a small window.

### Drag and drop works again
You can now drag actions from the catalog straight into your action list, and into
the THEN / ELSE / LOOP branches of a condition. Previously the drop was silently
ignored in the desktop app.

### Consistent look for logic blocks
IF / ELSE and LOOP cards now use the same surface color as every other action card
instead of a slightly darker shade. This also looks correct in the light theme.

### Plugin dialogs open immediately
On the Plugins page, **Configure**, **Install**, and **Uninstall** dialogs now open
right away — including from a plugin's detail page. Before, the dialog was hidden
behind the detail view and only appeared after going back.

### Smooth scrolling with long action lists
Scrolling a button with 30 or more actions no longer stutters or sticks. Opening and
closing cards mid-scroll is smooth as well. The editor also feels lighter overall.

## Other fixes

- **Logic and variables are reliable.** If a button changes a variable and then
  checks it in the same run, the check now sees the new value. Changing a variable
  that does not exist yet creates it automatically instead of doing nothing.
- **Hold mode works inside blocks.** Press-and-hold actions placed inside IF or LOOP
  blocks now receive the release event, so effects are properly reverted.
- **No more double-triggered plugin actions.** On a held key, plugin actions only
  receive a release event if the plugin explicitly supports it. Built-in volume and
  mute actions are unaffected.
- **One key, same behavior everywhere.** A bound key now triggers the same button on
  the Deck, Profiles, and Plugins pages, and conflict detection uses the same rules.
- **Canceled conflict warnings keep your binding.** Dismissing a key conflict warning
  no longer clears a binding that was already set.
- **Moving an action between THEN and ELSE.** Dragging an action from one branch of
  the same block to the other no longer loses it.
- **Real system values.** CPU, RAM, and battery readings are now real values on
  Windows and Linux, refreshed every 10 seconds. Time variables work as well.
- **Accent color is respected.** Your chosen accent color now applies throughout the
  editor instead of a fixed blue.
- **Readable update notifications.** When a new version is available, the update
  dialog now shows formatted release notes — headings, lists, bold text, and code —
  instead of raw text with `##` and `**` markers. Links open in your browser.

## Good to know

- Creating **new** nested IF / LOOP blocks from the editor is still not supported.
  Existing nested actions run correctly, including hold mode.
- Changing a plugin action's release behavior is opt-in: a plugin only receives the
  release event when it declares support for it.

## Update notes

- Version numbers are now `1.2.1` in the app and installer metadata.
- The portable Windows build is produced at
  `isu-deck-ui/src-tauri/target/release/app.exe`.
