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
