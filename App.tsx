
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppSettings, Character, DEFAULT_SETTINGS } from './types';
import { loadSettings, saveSettings, loadCharacters, saveCharacters, deleteChat, getHouseId, setHouseId, logout, deleteCharacter, syncFromCloud, syncToCloud } from './utils/storage';
import { validateConnection } from './utils/firebase';
import SettingsModal from './components/SettingsModal';
import CharacterCard from './components/CharacterCard';
import ChatPage from './pages/ChatPage';
import CharacterCreator from './pages/CharacterCreator';
import BridgeManager from './components/BridgeManager';
import ExtensionsModal from './components/ExtensionsModal';
import LoginScreen from './pages/LoginScreen';
import { initExtensionSystem, loadExtensions } from './utils/extensionLoader';

import ConfirmModal from './components/ConfirmModal';

interface LayoutProps {
  onOpenSettings: () => void;
  onOpenExtensions: () => void;
  onLogout: () => void;
  cloudSyncWarning?: string | null;
  onDismissWarning?: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, onOpenSettings, onOpenExtensions, onLogout, cloudSyncWarning, onDismissWarning }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0f0f12]">
      {/* Sidebar / Navbar */}
      <nav className="w-full md:w-20 lg:w-64 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-4 flex items-center justify-center md:justify-start gap-3 border-b border-gray-800 h-16">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
            G
          </div>
          <span className="font-bold text-lg tracking-tight hidden lg:block bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            GeminiRP
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-3">
          <Link to="/" className={`flex items-center gap-3 px-3 py-3 rounded-xl transition ${location.pathname === '/' ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <i className="fas fa-users text-lg w-6 text-center"></i>
            <span className="hidden lg:block font-medium">Karakter</span>
          </Link>

          <Link to="/create" className={`flex items-center gap-3 px-3 py-3 rounded-xl transition ${location.pathname === '/create' ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <i className="fas fa-plus-circle text-lg w-6 text-center"></i>
            <span className="hidden lg:block font-medium">Buat Baru</span>
          </Link>

          <button
            onClick={onOpenExtensions}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition group cursor-pointer text-left w-full"
          >
            <i className="fas fa-plug text-lg w-6 text-center text-violet-400 group-hover:rotate-12 transition-transform"></i>
            <span className="hidden lg:block font-medium">Ekstensi</span>
          </button>
        </div>

        <div className="p-4 border-t border-gray-800 flex flex-col gap-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition group"
          >
            <i className="fas fa-cog text-lg w-6 text-center group-hover:rotate-90 transition-transform"></i>
            <span className="hidden lg:block font-medium">Pengaturan</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-red-400 hover:bg-red-900/30 transition group"
          >
            <i className="fas fa-sign-out-alt text-lg w-6 text-center"></i>
            <span className="hidden lg:block font-medium">Keluar</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-hidden relative flex flex-col">
        {/* P7-fix: Cloud sync warning banner — non-blocking, dismissible */}
        {cloudSyncWarning && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-start gap-3 shrink-0 animate-fade-in">
            <i className="fas fa-cloud-upload-alt text-amber-400 mt-0.5"></i>
            <p className="text-xs text-amber-200 flex-1 leading-relaxed">{cloudSyncWarning}</p>
            {onDismissWarning && (
              <button
                onClick={onDismissWarning}
                className="text-amber-400 hover:text-white transition shrink-0 p-1"
                title="Tutup peringatan"
              >
                <i className="fas fa-times text-sm"></i>
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

// Home Page Component (Character List)
const HomePage = ({ characters, setCharacters }: { characters: Character[], setCharacters: (c: Character[]) => void }) => {
  const [charToDelete, setCharToDelete] = useState<string | null>(null);

  const requestDeleteChar = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCharToDelete(id);
  };

  const confirmDeleteChar = async () => {
    if (charToDelete) {
      const newChars = characters.filter(c => c.id !== charToDelete);
      setCharacters(newChars);
      await deleteCharacter(charToDelete);
      await deleteChat(charToDelete);
      setCharToDelete(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <ConfirmModal
        isOpen={!!charToDelete}
        title="Hapus Karakter"
        message="Hapus karakter ini beserta semua riwayat chatnya? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDeleteChar}
        onCancel={() => setCharToDelete(null)}
      />
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pilih Karakter</h1>
          <p className="text-gray-400">Mulai petualangan roleplay baru Anda.</p>
        </div>
        <Link to="/create" className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-lg font-bold transition shadow-lg shadow-primary-500/20 flex items-center gap-2">
          <i className="fas fa-plus"></i> <span className="hidden sm:inline">Buat Karakter</span>
        </Link>
      </header>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl">
          <i className="fas fa-ghost text-5xl mb-4 opacity-50"></i>
          <p className="text-lg">Belum ada karakter.</p>
          <Link to="/create" className="mt-2 text-primary-500 hover:underline">Buat satu sekarang!</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {characters.map(char => (
            <Link key={char.id} to={`/chat/${char.id}`}>
               <CharacterCard 
                  character={char} 
                  onClick={() => {}} 
                  onDelete={(e) => requestDeleteChar(e, char.id)}
                />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExtensionsOpen, setIsExtensionsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasHouse, setHasHouse] = useState<boolean>(!!getHouseId());
  // P7-fix: cloud sync warning state — set when Firebase sync fails so the app
  // can still proceed in local-only mode instead of blocking the user.
  const [cloudSyncWarning, setCloudSyncWarning] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);
        const chars = await loadCharacters();
        setCharacters(chars);
        
        // Setup Extension System
        initExtensionSystem(loadedSettings);
        try {
          await loadExtensions();
        } catch (e) {
          console.error("Failed to load extensions on init:", e);
        }
    } catch (e) {
        console.error("Error loading house data:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (getHouseId()) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [hasHouse]);

  useEffect(() => {
    validateConnection();
  }, []);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<string>('');

  const handleLogin = async (key: string) => {
    setIsLoading(true);
    setLoginError(null);
    setCloudSyncWarning(null);
    try {
      setHouseId(key);
      setSyncProgress('Sinkronisasi Awal...');
      // P7-fix: Cloud sync failure should NOT block login.
      // The app has a full local DB (localforage) and can work in local-only mode.
      // If syncFromCloud fails (e.g. Firebase not configured, network error),
      // we proceed with local data and show a non-blocking warning.
      try {
        await syncFromCloud((m) => setSyncProgress(m));
      } catch (syncErr: any) {
        console.warn("Cloud sync failed, proceeding in local-only mode:", syncErr);
        const reason = syncErr?.message || String(syncErr || 'unknown error');
        // Detect the most common cause: placeholder Firebase config
        const isConfigError = reason.includes('remixed-') || reason.includes('Failed to get document') || reason.includes('client is offline') || reason.includes('unavailable');
        const warning = isConfigError
          ? 'Firebase belum dikonfigurasi (config masih placeholder). App berjalan dalam mode LOCAL-ONLY — data tersimpan di browser, tidak disinkronisasi ke cloud. Edit firebase-applet-config.json untuk mengaktifkan cloud sync.'
          : `Sinkronisasi cloud gagal (${reason}). App berjalan dalam mode LOCAL-ONLY. Data tersimpan di browser.`;
        setCloudSyncWarning(warning);
      }
      setHasHouse(true);
    } catch (err: any) {
      console.error("Login failed", err);
      setLoginError(err.message || "Gagal masuk.");
    } finally {
      setIsLoading(false);
      setSyncProgress('');
    }
  };

  const triggerLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    setIsLoading(true);
    setSyncProgress('Menyimpan ke Cloud sebelum Keluar...');
    try {
      // P7-fix: Cloud sync failure during logout should NOT block logout.
      // Local data is already saved continuously via localforage, so even if
      // cloud upload fails the user can safely log out.
      try {
        await syncToCloud((m) => setSyncProgress(m));
      } catch (syncErr: any) {
        console.warn("Cloud sync failed during logout, proceeding anyway:", syncErr);
        // Don't alert — just warn in console. Local data is already saved.
      }
      await logout();
      setHasHouse(false);
      setCharacters([]);
      setCloudSyncWarning(null);
    } catch (e) {
      console.error("Logout Failed", e);
      // Even if logout() itself fails, reset the UI state so user isn't stuck
      setHasHouse(false);
      setCharacters([]);
    } finally {
      setIsLoading(false);
      setSyncProgress('');
    }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };
  
  const handleReloadData = async () => {
      const chars = await loadCharacters();
      setCharacters(chars);
  }

  if (isLoading) {
      return (
          <div className="min-h-screen bg-[#0f0f12] flex flex-col items-center justify-center text-white gap-4">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="animate-pulse">{syncProgress || 'Memuat Data...'}</p>
          </div>
      )
  }

  if (!hasHouse) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  return (
    <HashRouter>
      <BridgeManager settings={settings} />
      <Layout
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExtensions={() => setIsExtensionsOpen(true)}
        onLogout={triggerLogout}
        cloudSyncWarning={cloudSyncWarning}
        onDismissWarning={() => setCloudSyncWarning(null)}
      >
        <Routes>
          <Route path="/" element={<HomePage characters={characters} setCharacters={setCharacters} />} />
          <Route 
            path="/create" 
            element={
              <CharacterCreator 
                settings={settings}
                onSave={async (newChars) => {
                  setCharacters(newChars);
                  await saveCharacters(newChars);
                }} 
              />
            } 
          />
          <Route path="/chat/:charId" element={<ChatPage settings={settings} />} />
        </Routes>
      </Layout>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSave={handleSaveSettings}
        onDataRestored={handleReloadData}
      />
      <ExtensionsModal 
        isOpen={isExtensionsOpen} 
        onClose={() => setIsExtensionsOpen(false)} 
      />
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar? Data lokal Anda saat ini akan disinkronisasikan ke cloud dan dihapus dari sesi ini."
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText="Keluar"
      />
    </HashRouter>
  );
};

export default App;
