import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * P7-hotfix: Defensive Firebase initialization.
 *
 * Sebelumnya, initializeApp() dan getFirestore() dipanggil di top-level
 * module tanpa try-catch. Dengan Firebase v12 config placeholder tidak
 * throw synchronously, TAPI:
 *   - Versi Firebase future bisa berubah behavior
 *   - Config yang lebih malformed (mis. field hilang) bisa throw
 *   - Jika throw terjadi di sini, seluruh module graph gagal load:
 *     utils/firebase.ts → utils/storage.ts → App.tsx → index.tsx
 *     → React tidak pernah mount → LAYAR HITAM PERMANEN
 *
 * Sekarang kita wrap dalam try-catch. Jika init gagal, `db` dan `auth`
 * di-set ke null, dan app berjalan dalam mode LOCAL-ONLY.
 */

let db: any = null;
let auth: any = null;
let firebaseInitError: string | null = null;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  auth = getAuth(app);
} catch (e: any) {
  firebaseInitError = e?.message || String(e);
  console.warn(
    "[Firebase] Init gagal — app berjalan dalam mode LOCAL-ONLY.",
    "\nError:", firebaseInitError,
    "\nUntuk mengaktifkan cloud sync, edit firebase-applet-config.json dengan config Firebase project Anda yang sebenarnya."
  );
}

export { db, auth, firebaseInitError };

/**
 * Cek apakah Firebase berhasil diinisialisasi DAN config bukan placeholder.
 * Digunakan oleh storage.ts untuk skip cloud sync dengan cepat jika Firebase
 * tidak tersedia — menghindari 15+ detik timeout saat getDoc gagal.
 */
export const isFirebaseAvailable = (): boolean => {
    if (db === null) return false;
    // Deteksi config placeholder (nilai default dari template).
    // Ini mempercepat failure: lempar error sinkronis daripada tunggu network timeout.
    const cfg = firebaseConfig as any;
    const isPlaceholder =
        !cfg.projectId || cfg.projectId === 'remixed-project-id' ||
        !cfg.apiKey || cfg.apiKey === 'remixed-api-key' ||
        !cfg.appId || cfg.appId === 'remixed-app-id';
    if (isPlaceholder) {
        return false;
    }
    return true;
};

export const validateConnection = async () => {
  if (!db) {
    console.warn("[Firebase] Tidak tersedia — validateConnection di-skip (mode LOCAL-ONLY).");
    return;
  }
  try {
    // Just a dummy ping to test the connection.
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Ignore permissions errors, it just means connection works but was denied by rules
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
};
