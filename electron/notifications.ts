/**
 * Powiadomienia o agendzie (poz. 9 etap 3) — proces główny Electrona.
 *
 * Wydzielone z `main.ts` z dwóch powodów:
 *  1. `main.ts` odpowiada za cykl życia apki i serwer — to inna sprawa;
 *  2. **testowalność** — tutaj nic nie sięga do globalnego `mainWindow`,
 *     wszystko wchodzi przez `NotifyDeps`, więc `scripts/verify-notifications.js`
 *     uruchamia dokładnie ten sam kod bez otwierania okna i bez logowania ręką.
 */

import { Notification, type Session } from 'electron';
import * as fs from 'fs';

/** Jak często sprawdzamy, czy wybiła godzina z ustawień. */
const POLL_MS = 15 * 60 * 1000;

/** Pierwsze sprawdzenie po starcie — z opóźnieniem, żeby zdążyła wstać sesja. */
const FIRST_CHECK_MS = 30 * 1000;

export interface NotifyDeps {
  port: number;
  configPath: string;
  /** Sesja okna — z niej bierzemy ciasteczko zalogowanego użytkownika. */
  getSession: () => Session | null;
  /** Co zrobić po kliknięciu w dymek (w apce: otworzyć `/calendar`). */
  onOpenCalendar: () => void;
}

export interface NotifyPayload {
  account: string;
  prefs: { enabled: boolean; hour: number; leadDays: number };
  message: { title: string; body: string } | null;
}

/**
 * Wynik pojedynczego sprawdzenia. Nazwany wariant zamiast `void` — dzięki temu
 * log mówi, *dlaczego* nie było powiadomienia, a skrypt weryfikacyjny ma co
 * asertować.
 */
export type CheckResult =
  | 'no-session'
  | 'unauthorized'
  | 'disabled'
  | 'nothing-to-report'
  | 'too-early'
  | 'already-notified'
  | 'unsupported'
  | 'shown'
  | 'error';

/** `YYYY-MM-DD` w czasie **lokalnym** — dzień użytkownika, nie UTC. */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface StoredConfig {
  notifiedOn?: Record<string, string>;
  [key: string]: unknown;
}

function readConfig(configPath: string): StoredConfig | null {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StoredConfig;
  } catch {
    return null;
  }
}

/**
 * Zapisuje stan powiadomień, **domiksowując** go do configu odczytanego z dysku.
 * Nigdy nie nadpisujemy całym obiektem z pamięci — w pliku siedzi
 * `nextAuthSecret`, którego utrata wylogowałaby wszystkich i unieważniła sesje.
 */
function rememberNotified(configPath: string, account: string, dateKey: string): void {
  const config = readConfig(configPath);
  if (!config) return;
  config.notifiedOn = { ...(config.notifiedOn ?? {}), [account]: dateKey };
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
    // W configu leżą sekrety — zapis stanu powiadomień nie może rozluźnić uprawnień.
    try {
      fs.chmodSync(configPath, 0o600);
    } catch {
      /* nie blokujemy powiadomienia z powodu uprawnień pliku */
    }
  } catch (err) {
    console.warn('⚠️ Nie udało się zapisać stanu powiadomień:', err);
  }
}

function alreadyNotifiedToday(configPath: string, account: string, now: Date): boolean {
  const config = readConfig(configPath);
  return config?.notifiedOn?.[account] === localDateKey(now);
}

/**
 * Pobiera treść powiadomienia z apki, podszywając się pod zalogowane okno.
 *
 * Ciasteczka bierzemy z sesji `BrowserWindow`, więc trasa widzi dokładnie tego
 * użytkownika, który jest zalogowany — bez osobnego sekretu i bez zgadywania,
 * o które z kont na tej instalacji chodzi. Nikt niezalogowany = 401 = cisza.
 */
export async function fetchNotifyPayload(
  deps: NotifyDeps
): Promise<NotifyPayload | 'no-session' | 'unauthorized' | 'error'> {
  const session = deps.getSession();
  if (!session) return 'no-session';

  const origin = `http://localhost:${deps.port}`;
  const cookies = await session.cookies.get({ url: origin });
  if (cookies.length === 0) return 'no-session';

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const res = await fetch(`${origin}/api/health/agenda/notify`, {
    headers: { Cookie: cookieHeader },
  });

  if (res.status === 401) return 'unauthorized';
  if (!res.ok) {
    console.warn(`⚠️ /api/health/agenda/notify zwróciło ${res.status}`);
    return 'error';
  }
  return (await res.json()) as NotifyPayload;
}

/**
 * Jedno sprawdzenie: czy jest co pokazać, czy wybiła godzina i czy dziś już
 * nie pokazaliśmy. Wywoływane co kwadrans — same warunki decydują, że dymek
 * pojawia się najwyżej raz dziennie.
 */
export async function checkNotifications(
  deps: NotifyDeps,
  now: Date = new Date()
): Promise<CheckResult> {
  try {
    const payload = await fetchNotifyPayload(deps);
    if (typeof payload === 'string') return payload;

    if (!payload.prefs.enabled) return 'disabled';
    if (!payload.message) return 'nothing-to-report';

    // Przed ustawioną godziną nie zawracamy głowy. Uruchomienie apki po tej
    // godzinie daje powiadomienie od razu — to jest to „przy starcie" z planu.
    if (now.getHours() < payload.prefs.hour) return 'too-early';

    if (alreadyNotifiedToday(deps.configPath, payload.account, now)) {
      return 'already-notified';
    }

    if (!Notification.isSupported()) return 'unsupported';

    const notification = new Notification({
      title: payload.message.title,
      body: payload.message.body,
      silent: false,
    });
    notification.on('click', () => deps.onOpenCalendar());
    notification.show();

    rememberNotified(deps.configPath, payload.account, localDateKey(now));
    console.log(`🔔 Powiadomienie: ${payload.message.title}`);
    return 'shown';
  } catch (err) {
    // Powiadomienia są dodatkiem — ich awaria nie ma ruszać reszty apki.
    console.warn('⚠️ Sprawdzanie powiadomień nie powiodło się:', err);
    return 'error';
  }
}

export function startNotificationScheduler(deps: NotifyDeps): NodeJS.Timeout {
  setTimeout(() => void checkNotifications(deps), FIRST_CHECK_MS);
  return setInterval(() => void checkNotifications(deps), POLL_MS);
}
