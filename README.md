<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# GeminiRP v1.3 — SillyTavern-Parity Roleplay Hub

Aplikasi roleplay chat canggih mirip JanitorAI/SillyTavern yang ditenagai oleh
Google Gemini API + multi-provider (SumoPod, ElectronHub, GLM, BytePlus, NVIDIA,
Custom OpenAI-compatible). Fitur: manajemen karakter, layered system prompt
builder, lorebook priority + token budget, user persona, VN mode, slash commands,
auto-summarize (ContextShift), cloud sync Firebase, PWA mobile-first.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` (opsional — hanya untuk provider Google):
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the app:
   ```bash
   npm run dev
   ```
4. Buka http://localhost:3000 di browser.

## Konfigurasi Firebase (Opsional — Cloud Sync)

Secara default, app berjalan dalam mode **LOCAL-ONLY** (data tersimpan di
browser via localforage, tidak disinkronisasi antar perangkat). Untuk
mengaktifkan cloud sync:

1. Buat project di [Firebase Console](https://console.firebase.google.com/)
2. Tambahkan Web App → copy config
3. Edit `firebase-applet-config.json` dengan config asli Anda:
   ```json
   {
     "projectId": "your-real-project-id",
     "appId": "your-real-app-id",
     "apiKey": "your-real-api-key",
     "authDomain": "your-project.firebaseapp.com",
     "firestoreDatabaseId": "(default)",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "1234567890",
     "measurementId": "G-XXXXXXXXXX"
   }
   ```
4. Deploy `firestore.rules` ke Firestore project Anda
5. Restart app — cloud sync aktif

Jika config masih placeholder, app tetap berjalan normal dengan warning banner
amber. Tidak ada layar hitam.

## Troubleshooting: Layar Hitam

Jika setelah `npm run dev` layar hitam total:

### 1. Clear Service Worker Cache (paling umum)
PWA service worker bisa cache versi lama yang rusak:
- Buka DevTools (F12) → **Application** tab
- **Service Workers** → klik **Unregister** untuk semua SW
- **Storage** → **Clear site data**
- Hard reload: `Ctrl+Shift+R` (atau `Cmd+Shift+R` di Mac)

### 2. Cek Console untuk Error Fatal
- Tab **Console** → cari error merah
- Jika ada `Failed to fetch dynamically imported module` → kemungkinan
  file module tidak ditemukan. Restart dev server.
- Jika ada error Firebase → pastikan `firebase-applet-config.json`
  valid, atau biarkan placeholder (app akan jalan local-only).

### 3. File `/index.css` Sudah Dibuat (v1.3.1)
Sebelumnya `<link rel="stylesheet" href="/index.css">` di `index.html`
mereferensikan file yang tidak ada. Di Vite SPA mode, request ini
di-fallback ke `index.html` → browser terima HTML, coba parse sebagai
CSS → error yang bisa mem-block render → layar hitam.

**Sudah diperbaiki di v1.3.1**: file `index.css` sekarang ada (kosong).
Tambahkan custom CSS Anda di file ini jika perlu.

### 4. Firebase Init Sudah Defensive (v1.3.1)
`utils/firebase.ts` sekarang wrap `initializeApp` + `getFirestore` dalam
try-catch. Jika init gagal, `db` di-set ke null dan app berjalan local-only.
`isFirebaseAvailable()` juga mendeteksi config placeholder dan langsung
return false → `syncFromCloud` throw dengan cepat → tidak ada 15+ detik
Firebase timeout.

## Build untuk Production

```bash
npm run build
npm start
```

Output: `dist/` (frontend) + `dist/server.cjs` (backend Express).

## Fitur v1.3

Lihat `PATCH_NOTES.md` untuk detail lengkap semua fitur baru:
- P1: Layered System Prompt Builder + community preset
- P2: Lorebook priority + token budget
- P3: User Persona
- P4: Visual Novel Mode
- P5: Slash Commands (/regen, /continue, /edit, /vn, /chat, /summary, /help)
- P6: Auto-summarize (ContextShift)
- P7: Cloud sync + multi-provider preserved
- v1.3.1 hotfix: black screen fix (index.css + Firebase defensive init)
