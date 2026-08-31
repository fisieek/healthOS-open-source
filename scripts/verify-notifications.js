/**
 * Weryfikacja powiadomień desktopowych (poz. 9 etap 3) — bez GUI i bez klikania.
 *
 * Po co: ścieżki „wyciągnij ciasteczko z sesji Electrona → zapytaj trasę →
 * pokaż dymek → zapamiętaj w config.json" nie da się sprawdzić ani `tsc`, ani
 * w przeglądarce. Ten skrypt uruchamia **ten sam** `dist-electron/notifications.js`,
 * którego używa apka, tyle że na sesji utworzonej w locie.
 *
 * Uruchomienie (wymaga wcześniejszego `npm run desktop:compile`):
 *
 *   1. Wystartuj standalone na bazie deweloperskiej (dane konta testowego):
 *      ELECTRON_RUN_AS_NODE=1 DATABASE_URL=file:$(pwd)/prisma/dev.db \
 *        NEXTAUTH_URL=http://localhost:3007 NEXTAUTH_SECRET=verify \
 *        AUTH_TRUST_HOST=true PORT=3007 \
 *        node_modules/.bin/electron .next/standalone/server.js
 *
 *   2. W drugim terminalu:
 *      node_modules/.bin/electron scripts/verify-notifications.js
 *
 * 🛑 Loguje się **wyłącznie** na `test@test.pl` (AGENTS.md §3). Nigdy nie
 * kierować go na bazę produkcyjną z Application Support.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, session } = require('electron');

const PORT = Number(process.env.VERIFY_PORT || 3007);
const ORIGIN = `http://localhost:${PORT}`;
const EMAIL = 'test@test.pl';
const PASSWORD = 'test';

const {
  checkNotifications,
  localDateKey,
} = require(path.resolve(__dirname, '..', 'dist-electron', 'notifications.js'));

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${actual}${ok ? '' : ` (oczekiwano: ${expected})`}`);
}

/** Logowanie przez Auth.js: najpierw CSRF, potem callback credentials. */
async function login() {
  const csrfRes = await fetch(`${ORIGIN}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers.getSetCookie();

  const body = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: ORIGIN,
  });

  const res = await fetch(`${ORIGIN}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies.map((c) => c.split(';')[0]).join('; '),
    },
    body,
    redirect: 'manual',
  });

  const cookies = res.headers.getSetCookie();
  const sessionCookie = cookies.find((c) => c.includes('session-token'));
  if (!sessionCookie) {
    throw new Error(`Logowanie nie zwróciło ciasteczka sesji (status ${res.status})`);
  }
  return sessionCookie;
}

/** Wkłada ciasteczko do świeżej sesji Electrona — tak jak zrobiłoby to okno. */
async function buildSession(setCookieHeader) {
  const partition = `verify-${Date.now()}`;
  const ses = session.fromPartition(partition);

  const [pair] = setCookieHeader.split(';');
  const idx = pair.indexOf('=');
  await ses.cookies.set({
    url: ORIGIN,
    name: pair.slice(0, idx).trim(),
    value: pair.slice(idx + 1).trim(),
    httpOnly: true,
  });
  return ses;
}

async function main() {
  const configPath = path.join(os.tmpdir(), `healthos-verify-config-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify({ nextAuthSecret: 'verify' }, null, 2));

  let opened = 0;
  const deps = {
    port: PORT,
    configPath,
    getSession: () => null,
    onOpenCalendar: () => { opened++; },
  };

  console.log('\n── 1. Bez sesji ────────────────────────────────────────────');
  check('brak zalogowanego okna', await checkNotifications(deps), 'no-session');

  console.log('\n── 2. Logowanie na konto testowe ───────────────────────────');
  const cookie = await login();
  const ses = await buildSession(cookie);
  deps.getSession = () => ses;
  console.log('✅ zalogowano jako', EMAIL);

  console.log('\n── 3. Przed ustawioną godziną ──────────────────────────────');
  // Ustawienia konta testowego to godzina 9 — udajemy, że jest 8 rano.
  const earlyMorning = new Date();
  earlyMorning.setHours(8, 0, 0, 0);
  check('cisza przed godziną', await checkNotifications(deps, earlyMorning), 'too-early');

  console.log('\n── 4. Po godzinie — powiadomienie ──────────────────────────');
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  check('dymek pokazany', await checkNotifications(deps, noon), 'shown');

  console.log('\n── 5. Drugie sprawdzenie tego samego dnia ──────────────────');
  check('bez powtórki', await checkNotifications(deps, noon), 'already-notified');

  console.log('\n── 6. Stan zapisany w config.json ──────────────────────────');
  const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  check('data zapamiętana', saved.notifiedOn?.[EMAIL], localDateKey(noon));
  check('secret nietknięty', saved.nextAuthSecret, 'verify');

  console.log('\n── 7. Nazajutrz znowu powiadamiamy ─────────────────────────');
  const tomorrow = new Date(noon.getTime() + 24 * 3600 * 1000);
  check('nowy dzień = nowy dymek', await checkNotifications(deps, tomorrow), 'shown');

  fs.unlinkSync(configPath);

  console.log(
    failures === 0
      ? '\n🎉 Wszystko przeszło.\n'
      : `\n💥 Nieudanych asercji: ${failures}\n`
  );
  app.exit(failures === 0 ? 0 : 1);
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error('💥 Błąd weryfikacji:', err);
    app.exit(1);
  })
);
