# IsuDeck UI

The desktop user interface of IsuDeck, powered by Next.js 16 (React 19), Tailwind CSS, Zustand, and Tauri v2 IPC.

## Architecture

- **Framework:** Next.js 16 (Static HTML/JS export via Turbopack)
- **Styling:** Tailwind CSS with dark cyber/studio aesthetic
- **State Management:** Zustand (`app/store/useStore.js`)
- **Desktop IPC Bridge:** Tauri v2 JavaScript API (`@tauri-apps/api`)
- **Icon System:** Lucide Icons, dynamic plugin vector icons, and custom image uploads
- **Internationalization:** Multi-language localization engine (`locales/en.json`, `locales/tr.json`)

## Development

```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev

# Build production static export
npm run build
```
