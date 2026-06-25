# GeminiRP — Extension/Plugin System Real-ification

## Tujuan
Mengubah plugin system GeminiRP dari **"sebagian hiasan"** menjadi **fungsional penuh**
dan **kompatibel dengan ekstensi SillyTavern asli** seperti Megumin-Suite.

## Audit Sebelum Patch

| Komponen | Status Awal |
|---|---|
| `utils/eventBus.ts` | ✅ Real — 7 event types saja |
| `utils/extensionLoader.ts` | ✅ Real loader, tapi `getContext()` minimal (~10 properti) |
| `server.ts` API (list/install/create/delete) | ✅ Real |
| `ExtensionsModal.tsx` UI | ✅ Real |
| `services/geminiService.ts` emit `CHAT_COMPLETION_PROMPT_READY` | ✅ Real, **TAPI** import `flushExtensionPromptsInto` yang tidak pernah didefinisikan → bug |
| `pages/ChatPage.tsx` event emit | ✅ Real (`MESSAGE_SENDING/SENT/RECEIVED`, `CHARACTER_CHANGED`) |
| `public/script.js` | ❌ 11 baris stub — fungsi return dummy |
| `public/extensions.js` | ❌ 14 baris stub — `getContext()` minimal |
| `public/popup.js` | ❌ 12 baris — bukan modal beneran |
| `public/utils.js` | ❌ 1 baris kosong — `saveBase64AsFile` tidak ada |
| `public/RossAscends-mods.js` | ❌ 1 baris kosong — `humanizedDateTime` tidak ada |
| `Megumin-Suite/manifest.json` | ❌ Tidak ada → di-skip server |
| `Megumin-Suite/data/database.js`, `image_data.js` | ❌ Tidak ada → ekstensi crash saat impor |
| `event_types` | ❌ Hanya 7 dari ~80 di SillyTavern |

## Perubahan Per File

### 1. `utils/eventBus.ts` — diperluas total
- **Event types lengkap**: 80+ event sesuai SillyTavern `scripts/events.js`
  (`MESSAGE_EDITED`, `MESSAGE_DELETED`, `GENERATION_STARTED/ENDED`,
  `CHAT_CHANGED`, `USER/CHARACTER_MESSAGE_RENDERED`, `STREAM_TOKEN_RECEIVED`, …)
- **EventBus** sekarang mendukung `once`, `removeListener`, `removeAllListeners`,
  `listenerCount`, `emitAndWait` (alias ST)
- Legacy event GeminiRP (`MESSAGE_SENDING`, `CHAT_RESET`, `CHARACTER_CHANGED`)
  dipertahankan demi back-compat ekstensi lama

### 2. `utils/extensionLoader.ts` — `getContext()` diperluas ~6×
`window.MyApp.getContext()` sekarang menyediakan ~60 properti mirroring ST,
antara lain:
- `name1`, `name2`, `characters`, `groups`, `characterId`, `groupId`, `chatId`,
  `chatMetadata`, `extensionPrompts`, `extensionSettings`
- LLM: `callLLM`, `generate`, `generateQuietPrompt`, `generateRaw`
- Chat I/O: `addOneMessage`, `deleteMessage`, `clearChat`, `reloadCurrentChat`,
  `saveChat`, `updateChatMetadata`
- Prompt injection: `setExtensionPrompt`
- Macros: `substituteParams`, `substituteParamsExtended` (handle `{{user}}`,
  `{{char}}`, `{{random:a,b}}`, `{{roll:2d6}}`, dll)
- Karakter: `getCharacters`, `getCharacterCardFields`, `selectCharacterById`
- Tokenizer: stub `getTokenCount`, `getTokenCountAsync`
- Popup: `POPUP_TYPE`, `POPUP_RESULT`, `Popup` (fallback class), `callGenericPopup`
- Variabel: `variables.local`, `variables.global` dengan API get/set/del/has/inc/dec
- Worker: `ModuleWorkerWrapper` (compatible re-impl)

Plus dua fungsi baru di-export ke `services/geminiService.ts`:
- **`flushExtensionPromptsInto(messages)`** — menyalurkan prompt yang
  didaftarkan via `setExtensionPrompt()` ke array messages **in-place**,
  menghormati `position` (BEFORE_PROMPT/IN_PROMPT/IN_CHAT) dan `depth`.
  **Ini memperbaiki ImportError yang tadinya silently failed.**
- **`getExtensionPromptInjections()`** — helper string-only opsional

### 3. `public/script.js` — dari 11 → 486 baris real implementations
ST ekstensi mengimpor banyak nama dari sini. Sekarang semuanya nyata:
- `eventSource` & `event_types` → Proxy ke `globalEventBus`
- `chat`, `characters`, `groups` → live array Proxy yang selalu re-baca state terkini
- `saveSettingsDebounced` → persist ke localStorage
- `generateQuietPrompt(prompt, _img, _qtl, sys)` → **benar-benar panggil Gemini**
- `generateRaw`, `generateRawData`, `Generate` → wired
- `substituteParams` & `substituteParamsExtended` → handle macro lengkap
- `addOneMessage` → push ke chat + propagasi ke React state + emit
  `USER_MESSAGE_RENDERED`/`CHARACTER_MESSAGE_RENDERED`
- `deleteLastMessage`, `deleteMessage`, `clearChat` → propagasi ke React
- `appendMediaToMessage` → tulis ke `message.extra.image|audio`
- `setExtensionPrompt`, `extension_prompts` → terhubung ke pipeline LLM
- 30+ helper lainnya (`callPopup`, `extractMessageFromData`, `scrollChatToBottom`, …)

### 4. `public/extensions.js` — dari 14 → 240+ baris
- `extension_settings` ekspor yang persist
- `getContext()` delegasi ke `window.MyApp.getContext()`
- `renderExtensionTemplate` & `renderExtensionTemplateAsync` (fetch HTML + macro)
- `installExtension`, `deleteExtension`, `enableExtension`, `disableExtension`
  (delegasi ke server.ts REST)
- `ModuleWorkerWrapper` (compatible re-impl)
- `runGenerationInterceptors` + `registerGenerationInterceptor`
- `writeExtensionField` / `writeExtensionFieldBulk`
- `EMPTY_AUTHOR`, `getAuthorFromUrl`, `UNSET_VALUE`, dll

### 5. `public/popup.js` — dari 12 → 175 baris
- **Real DOM modal** dengan overlay, backdrop blur, animasi
- `POPUP_TYPE` (TEXT/CONFIRM/INPUT/DISPLAY) & `POPUP_RESULT` (AFFIRMATIVE/NEGATIVE/CANCELLED)
- `class Popup` dengan `show()` yang return Promise (resolve on click / Esc / outside click)
- INPUT mode dengan textarea/input + autofocus
- `callGenericPopup` helper

### 6. `public/utils.js` — dari 1 → 175 baris
- `saveBase64AsFile` (data URL + localStorage stash)
- `base64ToBlobUrl`, `getBase64Async`, `getFileText`
- `uuidv4`, `getStringHash`, `timestampToMoment`
- `debounce`, `throttle`, `delay`
- `escapeHtml`, `download`, `trimToEndSentence`, `parseJsonFile`,
  `urlContentToDataUri`, dll

### 7. `public/RossAscends-mods.js` — dari 1 → 47 baris
- `humanizedDateTime(ts)` — return "Jun 18, 2026 3:42pm"
- `humanizedISO8601DateTime`, `isMobile`, `shouldSendOnEnter`, `getMessageTimeStamp`
- Stub-stub no-op: `favsToHotswap`, `dragElement`, `fixViewport`

### 8. `public/scripts/*.js` — re-export tipis dari `public/*.js`
Karena beberapa ekstensi pakai path `../../../utils.js` (resolve ke
`public/scripts/utils.js`), file di sini cuma `export * from '../utils.js'`.

### 9. `public/extensions/third-party/Megumin-Suite/`
- **`manifest.json`** ditambahkan — tanpa ini ekstensi tidak terdaftar di server
- **`data/database.js`** — minimal-valid placeholder untuk `hardcodedLogic`
  (modes, personalities, models, toggles, styles, addons, blocks, styleTemplates)
- **`data/image_data.js`** — minimal `KAZUMA_PLACEHOLDERS` & `RESOLUTIONS`
- Catatan: ini cukup agar Megumin **load tanpa crash**. Untuk fitur penuh,
  user perlu mengganti data ini dengan asset asli dari rilis Megumin-Suite.

## Verifikasi
- `node --check` pada SEMUA file JS shim → ✅ semua OK
- `tsc --noEmit` pada `utils/eventBus.ts` + `utils/extensionLoader.ts` →
  ✅ tidak ada error di file yang diubah (error hanya muncul dari dependensi
  eksternal yang tidak terinstall di environment build kita: `@google/genai`,
  `@types/node`, `ImportMeta.env` Vite — semua resolved saat dependencies
  asli proyek ter-install).

## Yang Masih Stub (Bukan Dihilangkan, Dibuat Aman)
Ini fitur ST yang GeminiRP tidak memiliki padanannya — stub aman, no-op:
- `worldInfo*` (GeminiRP pakai sistem lorebook sendiri yang berbeda)
- `swipe_*`, `swipeState` (UI swipe tidak ada di GeminiRP)
- `tokenizers` (perkiraan kasar `length/4`)
- `ScraperManager`, `TextCompletionService`, `ChatCompletionService`
- `SlashCommandParser` family (slash commands tidak diimplementasikan)
- `Extras` server (`doExtrasFetch` return 503)
- `streamingProcessor`, `STREAM_TOKEN_RECEIVED` event (GeminiRP belum streaming)

Ekstensi yang sangat bergantung pada fitur-fitur ini akan tetap load tanpa
crash, tapi fungsi terkait mungkin tidak aktif penuh.

## Cara Pakai
1. Replace folder `Ren4t-main` lama dengan folder ini
2. `npm install`
3. `npm run dev`
4. Buka modal Ekstensi → install ekstensi ST dari GitHub atau buat custom

## Backward Compatibility
Semua ekstensi GeminiRP lama (`rp-style-booster`, `auto-suggest`) tetap
berfungsi — legacy event `MESSAGE_SENDING`, `CHARACTER_CHANGED`, `CHAT_RESET`
dipertahankan apa adanya, dan `window.MyApp.getContext()` masih mengembalikan
semua field yang sebelumnya ada (`eventSource`, `event_types`, `chat`,
`settings`, `callLLM`).

---

# GeminiRP v1.3 — SillyTavern Parity Upgrade

Tujuan: mengimplementasikan 7 rekomendasi pengembangan prioritas untuk menutup
gap dengan SillyTavern sambil mempertahankan keunggulan unik GeminiRP
(cloud sync Firebase, web/no-install, mobile-first, multi-provider).

## Ringkasan Fitur Baru

### P1 (Prioritas Tinggi) — Layered System Prompt Builder
- **`utils/layeredPromptBuilder.ts`** (baru): membangun system instruction
  dalam 6 lapisan terurut: **Character → Persona → World Info → Jailbreak →
  Instruct Format → Auxiliary**. Setiap lapisan dipisahkan divider visual
  agar model dapat membedakan blok secara jelas. Struktur ini secara
  signifikan mengurangi penolakan (refusal) karena jailbreak ditempatkan
  di atas instruct layer, bukan terkubur di dalam konteks karakter.
- **`utils/presetManager.ts`** (baru): manajemen preset prompt komunitas.
  Mendukung import `.json` dengan 4 format:
  1. Native GeminiRP `PromptPreset`
  2. SillyTavern preset (`{ prompts: [...] }`)
  3. Array prompt mentah
  4. Single prompt object
  Disertai 3 preset bawaan: **Narrative Default**, **Augment JB**
  (hardened jailbreak), **Safe/SFW Narrative**.
- **`PromptMarker`** type: menandai setiap `PromptEntry` dengan peran
  semantik (jailbreak / world_info / instruct_format / persona / character /
  auxiliary / none) sehingga builder tahu ke lapisan mana prompt
  tersebut harus masuk.
- **`InstructFormat`** interface: aturan output (systemPrefix, userPrefix,
  assistantPrefix, outputRules) yang diterapkan di akhir system block
  dan sebagai prefix per-turn untuk provider OpenAI-compatible.
- **UI**: panel Preset Manager + Instruct Format di SettingsModal;
  dropdown Layer Marker + badge berwarna di AdvancedPromptManager.

### P2 — Lorebook Priority + Token Budget
- Field baru di `LorebookEntry`: `priority` (default 10), `tokenBudget`
  (default 0 = unlimited), `disable` (hard-disable override).
- `scanLorebook` sekarang mengurutkan entri yang cocok berdasarkan
  priority desc (stable), kemudian menegakkan:
  - per-entry tokenBudget (truncate entry jika melebihi)
  - global totalBudget (25% dari contextLimit; entri lower-priority
    di-drop jika budget habis)
  - Mengembalikan `droppedEntries` sehingga UI bisa surface info.
- **UI**: grid 3-kolom Prioritas / Token Budget / Hard-Disable di
  LorebookModal; sidebar menampilkan badge `P{priority}` dan dot
  merah untuk entri yang di-hard-disable.

### P3 — User Persona
- `Persona` interface: name, description, pronouns, backstory.
- `processPrompt` sekarang menerima optional `persona` dan menggantikan
  macro `{{persona_description}}`, `{{persona_pronouns}}`,
  `{{persona_backstory}}`.
- Persona disuntikkan ke system prompt sebagai blok kedua
  (setelah Character, sebelum World Info) — karakter jadi "mengenal"
  pemain.
- **UI**: panel User Persona di SettingsModal dengan field name
  (sync ke userName), pronouns, description, backstory + tombol Reset.

### P4 — Visual Novel Mode
- Field baru di `Character`: `backgroundUrl`, `vnPortraitUrl`.
- Toggle VN/Chat mode di chat header (icon portrait) + perintah
  slash `/vn` dan `/chat`.
- VN mode:
  - Background full-screen dengan overlay gradient (dari
    `character.backgroundUrl`)
  - Side portrait panel (desktop only, lg+) dengan portrait
    `character.vnPortraitUrl` atau fallback ke `avatarUrl`
  - Bubble chat menjadi translucent glassy (`backdrop-blur-md`,
    semi-transparent) agar menyatu dengan background
  - Animasi `fade-in` pada setiap pesan baru
- **UI CharacterCreator**: section "Aset Visual Novel (Opsional)"
  dengan uploader Background Scene + VN Portrait + tombol clear.

### P5 — Slash Commands
- `handleSlashCommand(raw)` interceptor di `handleSendMessage`:
  - `/regen` atau `/regenerate` — regenerate pesan karakter terakhir
  - `/continue` atau `/cont` — minta karakter melanjutkan tulisan
  - `/edit` — edit pesan karakter terakhir
  - `/vn` — aktifkan mode Visual Novel
  - `/chat` — kembali ke mode Chat
  - `/summary` atau `/summarize` — buka modal ringkasan manual
  - `/help` — tampilkan semua perintah
- Live hint di textarea saat user mengetik `/` — menampilkan
  deskripsi singkat perintah yang sedang diketik.
- Interceptor hanya aktif untuk input user (bukan injection dari
  bridge/extension) sehingga tidak mengganggu alur lain.

### P6 — Auto-Summarize (ContextShift)
- `AutoSummarizeConfig`: enabled, triggerRatio (0.5–0.95, default
  0.8), keepRecentMessages (default 6), minMessagesBeforeSummarize
  (default 12).
- `shouldAutoSummarize()` menghitung estimasi token history + pesan
  baru, membandingkan dengan `contextLimit * triggerRatio`.
- `runAutoSummarize()` meringkas pesan antara `existingSummary.messageCount`
  dan `history.length - keepRecentMessages`, menggabungkan dengan
  ringkasan sebelumnya, lalu meng-trimm history.
- Di `processResponse`: auto-summarize berjalan SEBELUM generateReply.
  Summary baru di-persist via `saveChatSummary`, state `messages`
  di-trim, dan fullHistory reference diupdate sehingga generateReply
  menggunakan history yang sudah dipangkas.
- Failure non-fatal: jika summarize gagal, lanjut dengan history
  penuh + tampilkan status warning.
- **UI**: panel Auto-Summarize di SettingsModal + status banner
  (amber, animate-fade-in) di atas input saat berjalan.

### P7 — Keunggulan Unik Dipertahankan
Semua perubahan di atas dirancang untuk tidak mengganggu:
- **Cloud sync Firebase**: `syncFromCloud` / `syncToCloud` tidak
  diubah. `loadSettings` tetap merge dengan `DEFAULT_SETTINGS`
  sehingga field baru (persona, instructFormat, autoSummarize,
  defaultUIMode, activePresetId) otomatis terisi default untuk
  user lama tanpa migrasi eksplisit.
- **Web/no-install**: PWA config di `vite.config.ts` utuh
  (`display: standalone`, theme_color, runtime caching).
- **Mobile-first**: semua UI baru menggunakan grid responsive
  (`grid-cols-1 md:grid-cols-2`, `lg:` breakpoints untuk VN
  side panel yang hanya muncul di desktop).
- **Multi-provider**: tidak ada perubahan pada `makeLLMRequest`.
  Instruct prefix wrapping diterapkan ke semua provider
  OpenAI-compatible; Gemini native tetap menggunakan systemInstruction.

## Verifikasi Build
- `npx tsc --noEmit` → 0 error
- `npm run build` → sukses, 2216 modules transformed, PWA SW
  generated, server bundled (10.2kb)
- Output: `dist/` (frontend) + `dist/server.cjs` (backend)

## File Baru
- `utils/layeredPromptBuilder.ts`
- `utils/presetManager.ts`

## File Dimodifikasi
- `types.ts` — tambah Persona, InstructFormat, PromptMarker,
  AutoSummarizeConfig, PromptPreset, BUILTIN_PRESETS, field baru
  di LorebookEntry & Character & PromptEntry & AppSettings
- `utils/promptUtils.ts` — processPrompt menerima persona + macro baru
- `utils/loreUtils.ts` — scanLorebook priority + budget-aware
- `services/geminiService.ts` — gunakan buildLayeredSystemPrompt,
  applyInstructWrapping, shouldAutoSummarize, runAutoSummarize
- `components/SettingsModal.tsx` — 5 panel baru (Preset, Persona,
  Instruct, Auto-summarize, Default UI Mode)
- `components/AdvancedPromptManager.tsx` — Layer Marker dropdown
  + badge
- `components/LorebookModal.tsx` — field priority/tokenBudget/disable
- `pages/ChatPage.tsx` — VN mode wrapper, slash command handler,
  auto-summarize runtime, status banners
- `pages/CharacterCreator.tsx` — uploader backgroundUrl & vnPortraitUrl

---

# Hotfix v1.3.1 — Black Screen on Login (Firebase Placeholder Config)

## Root Cause
`firebase-applet-config.json` berisi nilai placeholder (`remixed-project-id`,
`remixed-api-key`, dll). Saat user klik "Lanjut" di login screen:

1. `handleLogin` memanggil `syncFromCloud()` yang melakukan `getDoc()` ke
   Firestore dengan config placeholder
2. Firebase SDK mencoba koneksi ke endpoint non-existent → **hang 8+ detik**
3. Selama hang, loading screen gelap (`#0f0f12`) dengan spinner kecil
   muncul → **terlihat seperti layar hitam**
4. Error "Failed to get document because the client is offline" di-catch
5. **User ter-stuck** — `handleLogin` memperlakukan error sync sebagai
   error login, jadi `setHasHouse(true)` tidak pernah dipanggil

## Fix
- **`App.tsx` — `handleLogin`**: `syncFromCloud` sekarang di-wrap di
  try-catch terpisah. Jika sync gagal, app tetap proceed ke
  `setHasHouse(true)` (mode LOCAL-ONLY) dan menampilkan warning banner
  non-blocking.
- **`App.tsx` — `handleLogout`**: `syncToCloud` juga di-wrap terpisah.
  Jika sync gagal, logout tetap berhasil (data lokal sudah tersimpan
  via localforage).
- **`App.tsx` — Layout**: tambah `cloudSyncWarning` prop + banner
  amber dismissible di atas main content. Mendeteksi 2 skenario:
  - Config placeholder → "Firebase belum dikonfigurasi..."
  - Network/other error → "Sinkronisasi cloud gagal..."
- **State**: `cloudSyncWarning` di-reset saat login baru atau logout.

## Verifikasi (headless browser test)
- Login dengan key random → app masuk ke homepage dalam ~8 detik
  (waktu Firebase timeout), bukan stuck di black screen
- Warning banner muncul: "Firebase belum dikonfigurasi (config masih
  placeholder). App berjalan dalam mode LOCAL-ONLY..."
- Homepage menampilkan "Pilih Karakter" + "Belum ada karakter"
- Sidebar navigation berfungsi (Karakter, Buat Baru, Ekstensi, Pengaturan)
- `npx tsc --noEmit` → 0 errors
- `npm run build` → sukses

## Catatan untuk User
Untuk mengaktifkan cloud sync, edit `firebase-applet-config.json` dengan
config Firebase project Anda yang sebenarnya (dari Firebase Console →
Project Settings → Web App config). Jika tidak, app tetap berjalan
normal dalam mode local-only (data tersimpan di browser via localforage,
tidak disinkronisasi antar perangkat).

---

# Hotfix v1.3.2 — Black Screen Root Cause Fix (index.css + Firebase Defensive Init)

## Konteks
Audit user menemukan bahwa hotfix v1.3.1 sebelumnya (handleLogin try-catch)
belum menangani dua akar penyebab lain dari layar hitam:

1. **Missing `/index.css`** — `<link rel="stylesheet" href="/index.css">` di
   `index.html` mereferensikan file yang tidak ada. Di Vite SPA mode
   (`appType: "spa"` di server.ts), request ke file yang tidak ada
   di-fallback ke `index.html`. Browser terima HTML (Content-Type: text/html),
   coba parse sebagai CSS → CSS parsing error. Karena inline `<style>` di
   `<head>` sudah set `body { background-color: #0f0f12 }` (nyaris hitam),
   layar tampak hitam sebelum React mount.

2. **Firebase init tidak defensive** — `utils/firebase.ts` lama memanggil
   `initializeApp(firebaseConfig)` dan `getFirestore(app, databaseId)` di
   top-level module tanpa try-catch. Dengan Firebase v12 config placeholder
   tidak throw synchronously (terverifikasi via test), TAPI untuk Firebase
   versi future atau config yang lebih malformed, throw bisa terjadi.
   Jika throw di sini → seluruh module graph gagal load (firebase.ts →
   storage.ts → App.tsx → index.tsx) → React tidak pernah mount →
   layar hitam permanen.

## Verifikasi Klaim User
- `find . -iname "index.css"` → **tidak ditemukan** (konfirmasi klaim #1)
- `curl http://localhost:3000/index.css` sebelum fix → HTTP 200 dengan
  Content-Type: `text/html` (Vite SPA fallback ke index.html) — **konfirmasi
  klaim #1**: browser terima HTML, coba parse sebagai CSS
- Test `initializeApp` + `getFirestore` dengan config placeholder via
  Node.js script → **tidak throw** dengan Firebase v12 (klaim #2 tidak
  terkonfirmasi untuk v12, tapi tetap best practice untuk defensive init)

## Fix v1.3.2

### 1. Buat file `index.css` di root project
File kosong dengan komentar penjelasan. Request `/index.css` sekarang
di-serve dengan benar oleh Vite (200, di-inject sebagai CSS module dengan
HMR di dev mode). Tidak lagi fallback ke index.html.

### 2. Defensive Firebase init di `utils/firebase.ts`
- Wrap `initializeApp` + `getFirestore` + `getAuth` dalam try-catch
- Jika init gagal: `db = null`, `auth = null`, `firebaseInitError` di-set
- Export `isFirebaseAvailable()` — return `false` jika:
  - `db === null` (init gagal), ATAU
  - Config terdeteksi sebagai placeholder (`remixed-project-id`, dll)
- `validateConnection()` skip jika `db === null`

### 3. Guard di `utils/storage.ts`
- `syncFromCloud()`: cek `isFirebaseAvailable()` di awal. Jika false,
  throw error sinkronis dengan pesan jelas (tidak tunggu 15+ detik
  Firebase network timeout)
- `syncToCloud()`: sama — throw cepat jika Firebase tidak tersedia

### 4. Placeholder detection di `isFirebaseAvailable()`
Deteksi config placeholder (`remixed-project-id`, `remixed-api-key`,
`remixed-app-id`) dan langsung return false. Ini menghindari 15+ detik
timeout saat `getDoc` gagal — sekarang login selesai dalam <5 detik.

### 5. Warning message lebih clean
Warning banner tidak lagi redundant ("Mode LOCAL-ONLY aktif" tidak diulang).
Deteksi error diperluas: cek `placeholder` dan `init gagal` di message.

### 6. README + Troubleshooting section
README sekarang berisi:
- Cara konfigurasi Firebase (opsional)
- Troubleshooting layar hitam (3 langkah: Clear SW, Cek Console, index.css)
- Penjelasan bahwa app jalan local-only out-of-the-box

## Verifikasi (headless browser test)
- Login dengan key random → **app masuk ke homepage dalam <5 detik**
  (sebelumnya 15+ detik karena Firebase timeout)
- Warning banner muncul: "Firebase belum dikonfigurasi (config masih
  placeholder). Mode LOCAL-ONLY aktif..."
- Homepage menampilkan sidebar lengkap + "Pilih Karakter" + "Belum ada
  karakter"
- Extensions loaded: Auto-Suggest, RP Style Booster, Megumin-Suite
- `npx tsc --noEmit` → 0 errors
- `npm run build` → sukses

## File yang Dimodifikasi
- `index.css` (BARU) — file kosong dengan komentar
- `utils/firebase.ts` — defensive init + `isFirebaseAvailable()` +
  placeholder detection
- `utils/storage.ts` — guard `isFirebaseAvailable()` di syncFromCloud/syncToCloud
- `App.tsx` — warning message lebih clean + deteksi error diperluas
- `README.md` — troubleshooting section lengkap

## Catatan untuk User yang Sudah Punya SW Cache Lama
Jika setelah update masih layar hitam, kemungkinan PWA Service Worker
men-cache versi lama. Fix:
1. DevTools → Application → Service Workers → Unregister
2. DevTools → Application → Storage → Clear site data
3. Hard reload: Ctrl+Shift+R
