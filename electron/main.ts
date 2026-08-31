import { app, BrowserWindow } from 'electron';
import { startNotificationScheduler, type NotifyDeps } from './notifications';
import * as path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as net from 'net';

const PORT = 41872;
let nextServerProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let notificationTimer: NodeJS.Timeout | null = null;

// Wymuszamy nazwę folderu userData na "healthOS" (a nie "health-os" z package.json name)
app.setName('healthOS');

// ─── Ścieżki danych użytkownika ─────────────────────────────────────────────
const userDataPath = app.getPath('userData');
const uploadsPath = path.join(userDataPath, 'uploads');
const configPath = path.join(userDataPath, 'config.json');
const dbPath = path.join(userDataPath, 'healthos.db');
const dbUrl = `file:${dbPath}`;

console.log('📂 healthOS Desktop');
console.log(`   User Data: ${userDataPath}`);
console.log(`   Database:  ${dbPath}`);
console.log(`   Uploads:   ${uploadsPath}`);
console.log(`   Config:    ${configPath}`);

// ─── Upewnij się, że katalogi istnieją ───────────────────────────────────────
fs.mkdirSync(uploadsPath, { recursive: true });

// ─── Lokalny config (generowany przy pierwszym uruchomieniu) ─────────────────

interface AppConfig {
  nextAuthSecret: string;
  /**
   * Token, którym skrypt synchronizacji Garmina przedstawia się endpointowi
   * `/api/garmin/ingest`. Losowany per instalacja, tak samo jak `nextAuthSecret`.
   *
   * Wcześniej tego pola nie było, a kod aplikacji miał wpisane w środku hasło
   * zapasowe. Po opublikowaniu repozytorium znałby je każdy, a ten endpoint
   * pisze do bazy dowolnego konta — więc hasło zapasowe zniknęło, a token
   * musi się teraz brać stąd.
   */
  garminIngestSecret?: string;
  createdAt: string;
  /**
   * Data ostatniego powiadomienia per konto (`email` → `YYYY-MM-DD`).
   *
   * Świadomie **nie w bazie** — to stan lokalny instalacji, nie dane medyczne.
   * Skopiowanie bazy na drugi komputer nie ma zabierać ze sobą informacji
   * „temu już wyświetliłem dymek".
   */
  notifiedOn?: Record<string, string>;
}

/**
 * Zapis configu z uprawnieniami „tylko właściciel".
 *
 * W pliku leżą dwa sekrety: klucz podpisujący sesje i token ingest. Domyślne
 * uprawnienia nowego pliku na macOS to 0644 — czyli czytelne dla każdego innego
 * konta na tym komputerze. `chmod` po zapisie, bo tryb z `writeFileSync` działa
 * wyłącznie przy TWORZENIU pliku i nie naprawia plików już istniejących.
 */
function writeConfig(config: AppConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    console.warn('⚠️ Nie udało się zawęzić uprawnień config.json.');
  }
}

function loadOrCreateConfig(): AppConfig {
  let config: AppConfig | null = null;

  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig;
      if (parsed.nextAuthSecret) config = parsed;
    } catch {
      console.warn('⚠️ Config uszkodzony — regeneruję.');
    }
  }

  if (!config) {
    config = {
      nextAuthSecret: crypto.randomBytes(32).toString('base64'),
      garminIngestSecret: crypto.randomBytes(32).toString('base64'),
      createdAt: new Date().toISOString(),
    };
    writeConfig(config);
    console.log('🔑 Wygenerowano nowy config (NEXTAUTH_SECRET + GARMIN_INGEST_SECRET).');
    return config;
  }

  // Config sprzed tej zmiany: dosypujemy brakujący token, reszty nie ruszamy.
  if (!config.garminIngestSecret) {
    config.garminIngestSecret = crypto.randomBytes(32).toString('base64');
    writeConfig(config);
    console.log('🔑 Dopisano GARMIN_INGEST_SECRET do istniejącego configu.');
  } else {
    console.log('🔑 Config załadowany (sekrety istnieją).');
    writeConfig(config); // domyka uprawnienia na plikach sprzed tej zmiany
  }

  return config;
}

// ─── Migracje bazy danych ────────────────────────────────────────────────────

/**
 * Aplikuje migracje SQLite w osobnym procesie.
 *
 * Dlaczego child process zamiast bezpośrednio?
 * Better-sqlite3 jest natywnym modułem skompilowanym dla konkretnego ABI.
 * Electron i systemowy Node mają RÓŻNE ABI, ale współdzielą ten sam plik .node.
 *
 * ⚠️ Proces potomny to `process.execPath` (czyli **binarka Electrona**) z
 * `ELECTRON_RUN_AS_NODE=1`, a NIE systemowy `node`. W spakowanej apce
 * `better_sqlite3.node` jest zbudowany pod ABI Electrona (patrz AGENTS.md §6.3),
 * więc odpalenie tego skryptu zwykłym `node` wysypałoby migracje
 * na `NODE_MODULE_VERSION mismatch`. Nie zamieniać na `"node"`.
 */
function runMigrations(projectDir: string): void {
  console.log('🗄️  Uruchamianie migracji bazy danych...');

  const migrationsDir = path.join(projectDir, 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️ Brak folderu migracji — pomijam.');
    return;
  }

  const scriptPath = path.join(projectDir, 'scripts', 'run-migrations.js');
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Brak skryptu migracji: ${scriptPath}`);
    return;
  }

  const result = spawnSync(process.execPath, [scriptPath, dbPath, migrationsDir], {
    encoding: 'utf-8',
    timeout: 30000,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  if (result.stdout) {
    result.stdout.split('\n').filter(Boolean).forEach((line) =>
      console.log(`[Migrations] ${line}`)
    );
  }
  if (result.stderr) {
    result.stderr.split('\n').filter(Boolean).forEach((line) =>
      console.error(`[Migrations ERR] ${line}`)
    );
  }

  if (result.status !== 0) {
    console.error(`⚠️ Migracje zwróciły kod ${result.status} — apka spróbuje wystartować mimo to.`);
  }
}

// ─── Zmienne środowiskowe dla Next.js ────────────────────────────────────────

function buildNextEnv(config: AppConfig): NodeJS.ProcessEnv {
  const isDev = !app.isPackaged;
  return {
    ...process.env,
    // Zawsze używamy bazy Electrona (Application Support), nie projektowej dev.db
    DATABASE_URL: dbUrl,
    STORAGE_LOCAL_ROOT: uploadsPath,
    PORT: String(PORT),
    // Serwer ma słuchać WYŁĄCZNIE na tym komputerze. Bez tego wchodzi domyślne
    // ustawienie Next.js (`0.0.0.0`) i aplikacja jest widoczna dla każdego
    // w tej samej sieci Wi-Fi — razem z endpointami ingest, które nie chronią
    // się sesją, tylko tokenem.
    HOSTNAME: '127.0.0.1',
    NODE_ENV: isDev ? 'development' : 'production',
    NEXTAUTH_URL: `http://localhost:${PORT}`,
    NEXTAUTH_SECRET: config.nextAuthSecret,
    AUTH_SECRET: config.nextAuthSecret,
    // Bez tego /api/garmin/ingest odmawia — i słusznie, patrz AppConfig.
    GARMIN_INGEST_SECRET: config.garminIngestSecret ?? '',
    // Auth.js w produkcji domyślnie odrzuca localhost — wymuszamy zaufanie
    AUTH_TRUST_HOST: 'true',
    // OWNER_EMAIL nigdy nie jest hardcoded — każdy user zakłada konto przez /register
    OWNER_EMAIL: '',
    // Po tym `/settings` poznaje, że pokazać sekcję powiadomień systemowych
    // (w przeglądarce nie ma czego włączać — dymki pokazuje proces główny).
    HEALTHOS_DESKTOP: '1',
    // Klucz OAuth aplikacji do Kalendarza Google. Typ „Aplikacja desktopowa",
    // przy którym Google z założenia NIE traktuje sekretu jako tajnego —
    // bezpieczeństwa pilnuje PKCE. Szczegóły: lib/constants/google-oauth.ts.
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  };
}

// ─── Start serwera Next.js ───────────────────────────────────────────────────

function startNextServer(config: AppConfig) {
  const isDev = !app.isPackaged;
  const projectDir = isDev
    ? path.resolve(__dirname, '..')
    : path.join(process.resourcesPath!, 'app');

  // Uruchom migracje PRZED startem serwera (synchronicznie, max 30s)
  runMigrations(projectDir);

  const nextEnv = buildNextEnv(config);

  console.log(`🚀 Start Next.js (${isDev ? 'dev' : 'production'}) w: ${projectDir}`);

  if (isDev) {
    nextServerProcess = spawn('npm', ['run', 'dev'], {
      cwd: projectDir,
      env: nextEnv,
      shell: true,
    });
  } else {
    // Tryb produkcyjny: standalone server (mały footprint, samodzielny)
    // Używamy procesu Electrona jako Node (ELECTRON_RUN_AS_NODE=1) — wtedy ABI
    // natywnych modułów (better-sqlite3) zgadza się z naszym Electronem.
    const standaloneServer = path.join(projectDir, '.next', 'standalone', 'server.js');
    nextServerProcess = spawn(process.execPath, [standaloneServer], {
      cwd: path.dirname(standaloneServer),
      env: {
        ...nextEnv,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
  }

  if (nextServerProcess) {
    nextServerProcess.stdout?.on('data', (data) => {
      console.log(`[Next.js] ${data.toString().trim()}`);
    });
    nextServerProcess.stderr?.on('data', (data) => {
      console.error(`[Next.js ERR] ${data.toString().trim()}`);
    });
    nextServerProcess.on('exit', (code) => {
      console.log(`[Next.js] Proces zakończony z kodem: ${code}`);
    });
  }
}

// ─── Czekanie na serwer ──────────────────────────────────────────────────────

function waitForServer(callback: () => void) {
  const socket = net.connect({ port: PORT, host: '127.0.0.1' }, () => {
    socket.end();
    console.log('✅ Serwer gotowy — otwieram okno.');
    callback();
  });
  socket.on('error', () => {
    setTimeout(() => waitForServer(callback), 250);
  });
}

// ─── Powiadomienia o agendzie (poz. 9 etap 3) ────────────────────────────────

/**
 * Cała logika siedzi w `./notifications` — tutaj tylko wstrzykujemy to, co
 * zależy od okna. Dzięki temu `scripts/verify-notifications.js` uruchamia ten
 * sam kod bez GUI.
 */
function notifyDeps(): NotifyDeps {
  return {
    port: PORT,
    configPath,
    getSession: () =>
      mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.session : null,
    onOpenCalendar: () => {
      if (!mainWindow || mainWindow.isDestroyed()) createWindow();
      mainWindow?.loadURL(`http://localhost:${PORT}/calendar`);
      mainWindow?.show();
      mainWindow?.focus();
    },
  };
}

// ─── Okno aplikacji ──────────────────────────────────────────────────────────

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    title: 'healthOS',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: true,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

app.on('ready', () => {
  const config = loadOrCreateConfig();
  startNextServer(config);
  waitForServer(() => {
    createWindow();
    notificationTimer = startNotificationScheduler(notifyDeps());
  });
});

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    console.log('🛑 Zamykanie serwera Next.js...');
    nextServerProcess.kill('SIGTERM');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (notificationTimer) {
    clearInterval(notificationTimer);
    notificationTimer = null;
  }
  if (nextServerProcess) {
    nextServerProcess.kill('SIGTERM');
  }
});
