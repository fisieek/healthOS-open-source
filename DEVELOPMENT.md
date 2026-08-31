# Notatki deweloperskie

Rzeczy, których nie widać z kodu, a które kosztowały sporo czasu, żeby ustalić.
Warto przeczytać przed pierwszą poważniejszą zmianą - zwłaszcza sekcję o wersji
desktopowej.

> Ten plik powstał jako instrukcja dla agentów AI pracujących nad projektem
> i część jego tonu stąd pochodzi. Dla człowieka czyta się tak samo.

---

## Next.js - uwaga na wersję

Projekt korzysta z nowej wersji Next.js, w której API, konwencje i układ plików
potrafią różnić się od tego, co znasz. Zanim zaczniesz pisać, zajrzyj do
`node_modules/next/dist/docs/` i zwracaj uwagę na ostrzeżenia o wycofywanych API.

---

## Instalacja zależności i `.npmrc`

W repo jest `.npmrc` z `legacy-peer-deps=true`. To nie jest zapomniany plik -
bez niego `npm ci` **przerywa się błędem ERESOLVE**:

```
While resolving: @base-ui/react@1.4.1
Found: date-fns@3.6.0
Could not resolve dependency: peerOptional date-fns@"^4.0.0"
```

`@base-ui/react` deklaruje `date-fns@^4` jako zależność **opcjonalną**, a projekt
używa v3. npm mimo to odmawia instalacji. Flaga przywraca zachowanie sprzed npm 7
i daje dokładnie to samo drzewo zależności (`date-fns@3.6.0`).

Jeśli kiedyś zaktualizujesz `date-fns` do v4, sprawdź zmiany w obsłudze stref
czasowych - to główna niezgodność między v3 a v4 - i dopiero wtedy usuń `.npmrc`.

---

## Baza danych

Projekt używa **SQLite** przez `@prisma/adapter-better-sqlite3`.

| Tryb | Ścieżka bazy |
|---|---|
| Web dev (`npm run dev`) | `prisma/dev.db` |
| Desktop dev (`npm run desktop:dev`) | `~/Library/Application Support/healthOS/healthos.db` |
| Desktop produkcja | `~/Library/Application Support/healthOS/healthos.db` |

Ścieżkę bazy webowej ustawia `DATABASE_URL` w `.env.local`.

Electron wymusza nazwę katalogu przez `app.setName('healthOS')` - bez tego
folder nazywałby się `health-os`, zgodnie z polem `name` w `package.json`.

**Bazy webowa i desktopowa są niezależne.** Zmiany w jednej nie pojawią się
w drugiej. Można skopiować `prisma/dev.db` do Application Support, jeśli
potrzebujesz tych samych danych po obu stronach.

### Migracje

Używamy własnego skryptu `scripts/run-migrations.js` (nie Prisma CLI), który
aplikuje migracje z `prisma/migrations/` przez `better-sqlite3`. Ten sam skrypt
wywołuje Electron przed startem Next.js - dlatego nie da się go zastąpić
`prisma migrate`.

> **🛑 Uwaga! Nie uruchamiaj poleceń kasujących dane:** `prisma migrate reset`,
> `prisma db push --force`, `prisma db push --accept-data-loss`.
> SQLite to jeden plik - po takiej komendzie nie ma czego odzyskiwać,
> chyba że masz kopię: `npm run db:backup`.

### Kopie zapasowe

Polecenia `npm run db:backup` i `npm run db:restore` opisuje README - tutaj to,
czego z nich nie widać. Oba (`scripts/db-backup.sh`, `scripts/db-restore.sh`)
działają przez `sqlite3 .backup` / `.restore`, więc radzą sobie z uruchomioną
aplikacją i plikami `-wal`/`-shm`.

Backup sprawdza `PRAGMA integrity_check` na powstałym pliku. Restore przyjmuje
`--to desktop`, żeby wskazać bazę desktopową, odmawia przyjęcia pliku, który nie
jest bazą SQLite (stare kopie `.sql` z czasów PostgreSQL nie przejdą), wymaga
wpisania `tak` (albo `-y`) i **zawsze** zapisuje obecny stan bazy jako
`backups/<prefiks>-preRestore-<data>.db`, żeby dało się cofnąć pomyłkę.

### Konta

Do wszelkich testów używaj osobnego konta testowego. Skrypty weryfikacyjne
w `scripts/` (`verify-notifications.js`, `verify-google-calendar.ts`) zakładają
adres `test@test.pl` z hasłem `test` - załóż je przez `/register`.
Nigdy nie testuj na koncie, na którym trzymasz prawdziwe dane - zwłaszcza
operacji zapisu, usuwania i synchronizacji integracji.

---

## Uruchamianie lokalne

Instalację i start opisuje README. Tutaj trzy rzeczy, których w nim nie ma:

- **Nie ma serwera bazy do uruchomienia** - SQLite to plik.
- **Jeśli katalog `.next` został usunięty**, zbuduj raz projekt (`npm run build`)
  przed pierwszym `npm run dev`. Next.js z Webpackiem na macOS ma problem
  z tworzeniem zagnieżdżonych struktur cache od zera w trybie deweloperskim;
  jeden build produkcyjny poprawnie inicjalizuje foldery i manifesty.
- **`npm run dev` uruchamia `next dev --webpack`.** Flaga jest celowa - Turbopack
  crashuje przy transformacji arkuszy Tailwind CSS v4.

> **⚠️ Uwaga! Nie usuwaj katalogu `.next` po udanym buildzie.** Usunięcie
> lub uszkodzenie go psuje serwer Webpack i powoduje błędy `ENOENT` (np. brak `pages-manifest.json`)
> oraz **500 Internal Server Error** na wszystkich żądaniach.
>
> Jeśli aplikacja nagle zwraca 500 albo zgłasza brak plików w `.next`:
> ```bash
> rm -rf .next && npm run build
> ```
> i uruchom `npm run dev` ponownie.

---

## Pułapka: przeterminowany klient Prismy

Po `npx prisma generate` nowe pola i warianty enumów **mogą nadal nie być widoczne
dla TypeScriptu**.

**Objaw:** `Property 'X' does not exist on type` dla pola, które ewidentnie jest
w `schema.prisma`.

**Przyczyna:** w `app/generated/prisma` zalegają pliki ze starego układu Prismy
(m.in. `client.ts` z treścią `export * from "@prisma/client"`), których
`prisma generate` **nie nadpisuje**. TypeScript woli `client.ts` od świeżego
`client.d.ts`, więc pliki projektu biorą typy z pakietu npm zamiast
z wygenerowanego klienta.

**Naprawa** - katalog jest w całości generowany, więc można go skasować:

```bash
rm -rf app/generated/prisma && npx prisma generate
```

Po regeneracji **zrestartuj `npm run dev`** - serwer trzyma stary klient w pamięci
i zwraca `PrismaClientValidationError` mimo poprawnych typów.

---

## Wersja desktopowa (Electron + Next.js standalone)

Architektura: **Electron jako powłoka** + **serwer Next.js standalone jako proces
potomny**. Electron ładuje `http://localhost:41872` w `BrowserWindow`.

### Przebieg startu

`electron/main.ts` kompiluje się do `dist-electron/main.js`. Electron na starcie:

1. Wymusza `app.setName('healthOS')`
2. Generuje lub odczytuje `~/Library/Application Support/healthOS/config.json`
   (`NEXTAUTH_SECRET` i `GARMIN_INGEST_SECRET`, oba losowane per instalacja;
   plik zapisywany z uprawnieniami `0600`)
3. Uruchamia migracje przez `scripts/run-migrations.js` (osobny proces Node)
4. Spawnuje `node .next/standalone/server.js` z `ELECTRON_RUN_AS_NODE=1`
   i `HOSTNAME=127.0.0.1`
5. Czeka na port 41872 i otwiera okno

### Skrypty

| Komenda | Co robi |
|---|---|
| `npm run desktop:dev` | Electron uruchamia `next dev` w tle |
| `npm run desktop:build` | `next build` → `prepare-standalone.js` → `tsc electron/main.ts` → `electron-builder` |
| `npm run desktop:prepare` | sam `prepare-standalone.js` |
| `npm run desktop:compile` | kompilacja `electron/main.ts` |

### Niezgodność ABI `better-sqlite3`

Electron ma własne ABI Node.js (Electron 36 = `NODE_MODULE_VERSION` 135),
systemowy Node 25 ma 141. `better-sqlite3` to moduł natywny - musi być zbudowany
**pod konkretne ABI**. Binarka zbudowana dla Node nie załaduje się pod Electronem
i odwrotnie.

**Rozwiązanie:**

1. **Buduj w głównym `node_modules`.** `electron-rebuild` wymaga pełnego
   `package.json` z zależnościami. Standalone ma minimalny `package.json`,
   z którym `electron-rebuild` zwraca „No native modules found".
2. **Skopiuj binarkę** z `node_modules/better-sqlite3/build/Release/better_sqlite3.node`
   do **dwóch** miejsc w standalone:
   - `.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
   - `.next/standalone/.next/node_modules/better-sqlite3-<hash>/build/Release/better_sqlite3.node`

Całość jest zautomatyzowana w `scripts/prepare-standalone.js`.

**Czego nie robić:**

- ❌ `node-gyp --target=<electron-version>` w `.next/standalone/` - node-gyp ignoruje
  target przy niekompletnym `package.json` i buduje pod systemowe ABI
- ❌ `npm rebuild better-sqlite3` przy pracy z desktopem - zbuduje pod Node ABI
  i Electron przestanie działać
- ❌ rebuild wewnątrz standalone - główny `node_modules` jest źródłem prawdy

> **🛑 Uwaga! SIGKILL przy ładowaniu `better_sqlite3.node` to najczęściej
> zepsuty podpis Electrona, a nie problem z ABI.** Proces ginie bez wyjątku,
> więc `try/catch` nic nie łapie, a objaw wygląda identycznie jak niezgodność ABI.
>
> ```bash
> codesign -v node_modules/electron/dist/Electron.app
> ```
>
> Jeśli zgłasza „code has no resources but signature indicates they must be present":
>
> ```bash
> xattr -cr node_modules/electron
> codesign --force --deep --sign - node_modules/electron/dist/Electron.app
> ```
>
> Samego `.node` podpisywać nie trzeba - linker arm64 robi to sam przy `electron-rebuild`.

**`npm run desktop:dev` ma nierozwiązywalny konflikt ABI.** Migracje odpalają się
binarką Electrona (ABI 135), a `next dev` systemowym Node (ABI 141) - oba czytają
ten sam plik `better_sqlite3.node`, więc któryś zawsze dostanie złe ABI. Do testów
desktopu używaj spakowanej aplikacji (`desktop:build`), gdzie wszystko chodzi
pod Electronem.

Po przełączeniu z desktopu z powrotem na web dev może być potrzebne
`npm rebuild better-sqlite3`, żeby wrócić do Node ABI.

### Co jest w standalone

Standalone zawiera **kopię plików źródłowych** (`app/`, `components/`, `lib/`).
To nie jest śmietnik - renderowanie po stronie serwera wymaga plików TS/TSX
w czasie działania. Plus `node_modules/` z `next`, `react`, `better-sqlite3`.

`prepare-standalone.js` dokłada ręcznie `.next/static/` oraz binarkę
`better-sqlite3`. `@prisma/adapter-better-sqlite3` jest wbudowany w chunki
webpacka i nie musi być w `node_modules`.

### macOS 26+ i `com.apple.provenance`

macOS 26 (Tahoe) automatycznie dodaje atrybut rozszerzony `com.apple.provenance`
przy każdej operacji kopiowania. `codesign` odrzuca takie pliki błędem
„resource fork, Finder information, or similar detritus not allowed".

`xattr -cr` przed podpisem **nie wystarcza** - macOS dodaje atrybut z powrotem
przy każdej kolejnej operacji.

**Decyzja:** wyłączamy podpisywanie desktopowego builda (`mac.identity: null`
w `package.json`). Konsekwencja: przy pierwszym uruchomieniu macOS wymaga
**prawego kliknięcia → Otwórz**. Alternatywą jest Apple Developer ID
z notaryzacją - omija problem, ale wymaga konta ($99/rok).

### Pułapki `electron-builder`

Domyślne `files: ["**/*"]` kopiuje **cały projekt** (z `node_modules`, 1,5+ GB)
do paczki. A jeśli jednocześnie użyjesz `extraResources` z `to:` wskazującym
do wnętrza projektu, dostajesz rekursywną kopię projektu w sobie.

Sprawdzona konfiguracja - zaczynamy od wykluczenia wszystkiego, potem jawna lista:

```json
"files": [
  "!**/*",
  "dist-electron/**/*",
  "package.json",
  ".next/standalone/**/*",
  "prisma/migrations/**/*",
  "scripts/run-migrations.js"
]
```

Inne pułapki:

- `npmRebuild: false` - wyłącza rebuild modułów natywnych przez electron-builder;
  zostawiamy własny pipeline
- `asar: false` - przy xattrach macOS 26 i tak nie działa poprawnie, a bez asara
  łatwiej debugować
- hook `afterPack` - przydatny do `xattr -cr` po rozpakowaniu, przed podpisem

### Rekursywne puchnięcie standalone

Drugie, niezależne źródło rekursywnej kopii. Next.js w trybie standalone śledzi
**całe drzewo projektu** i kopiuje pliki źródłowe do `.next/standalone/`.
Bez wykluczeń wciąga też `dist-desktop/` - czyli poprzednio zbudowaną aplikację
i DMG. Każdy kolejny build pakuje w siebie poprzedni i **rośnie wykładniczo**.
Zaobserwowane: DMG 368 MB → 705 MB → (kolejny byłby ~1,7 GB).

Fix jest już w `next.config.ts`:

```ts
outputFileTracingExcludes: {
  "**/*": [
    "dist-desktop/**", "dist-electron/**",
    "backups/**", "storage/**", "scratch/**", ".next_old_*/**",
  ],
},
```

Po fiksie standalone spadło z 1,0 GB do ~90 MB, DMG do ~130 MB, aplikacja do ~330 MB.

**Sanity check po buildzie:** `du -sh .next/standalone` powinno dać ~90–100 MB.
Jeśli widzisz setki MB - sprawdź `du -sh .next/standalone/*`, czy nie wpadł tam
`dist-desktop`.

### Dlaczego Electron 36, nie najnowszy

Electron 42 ma nowe API V8 (`v8::External::New` z trzema argumentami),
a `better-sqlite3@12` używa starego, dwuargumentowego → kompilacja crashuje.
Trzymamy `electron@36.9.5`.

### Sprzątanie po nieudanym buildzie

Zawsze przed kolejną próbą:

```bash
rm -rf .next dist-desktop dist-electron
rm -rf ~/.electron-gyp ~/Library/Caches/node-gyp
rm -rf node_modules/better-sqlite3/build
xattr -cr node_modules/electron
```

Bez tego śmieci z poprzednich prób mieszają się z nowym buildem - np. zła wersja
`better_sqlite3.node` albo zła kopia w cache node-gyp.

### Smoke test przed `electron-builder`

Zanim spakujesz DMG, sprawdź, że serwer standalone uruchamia się pod Electronem:

```bash
ELECTRON_RUN_AS_NODE=1 \
  DATABASE_URL=file:/tmp/test.db \
  NEXTAUTH_URL=http://localhost:3006 \
  NEXTAUTH_SECRET=test \
  AUTH_TRUST_HOST=true \
  PORT=3006 \
  node_modules/.bin/electron .next/standalone/server.js
```

W drugim terminalu `curl http://localhost:3006/api/setup/status` musi zwrócić JSON.
Jeśli nie - DMG też nie zadziała, a oszczędzasz 5–10 minut pakowania.

---

## Błędy, których warto unikać

1. **Nie hardcoduj `OWNER_EMAIL`** w kodzie Electrona. Każdy użytkownik zakłada
   konto przez `/register`.
2. **Sekrety generowane per instalacja** w
   `Application Support/healthOS/config.json` - `NEXTAUTH_SECRET` oraz
   `GARMIN_INGEST_SECRET`. Zaszycie któregokolwiek w kodzie oznacza, że każda
   kopia aplikacji ma ten sam sekret. Przy tokenie ingest było dokładnie tak do
   sierpnia 2026 - w kodzie siedziała stała wartość domyślna, przez co
   `/api/garmin/ingest` przyjmował zapis do bazy dowolnego konta od każdego, kto
   znał ją z kodu. Plik zapisujemy z uprawnieniami `0600` - domyślne
   `0644` czyni oba sekrety czytelnymi dla każdego innego konta na tym Macu.
3. **`next/font/google` nie działa offline** - w wersji desktopowej używaj fontów
   systemowych (`-apple-system, BlinkMacSystemFont, "SF Pro Text"…`).
4. **`outputFileTracingRoot`** sprawia, że Next dziedziczy całe drzewo plików
   projektu w standalone. To zachowanie prawidłowe, nie błąd.
5. **Stare katalogi `.next_old_*` potrafią crashować skaner Tailwind oxide** -
   usuń je przed buildem.
6. **`AUTH_TRUST_HOST=true`** musi być ustawione w produkcji, inaczej Auth.js
   odrzuca żądania z localhost.
7. **`HOSTNAME=127.0.0.1` musi być ustawione przy starcie serwera.** Standalone
   server Next.js bez tej zmiennej bierze `0.0.0.0`, czyli aplikacja staje się
   dostępna dla każdego w tej samej sieci Wi-Fi - łącznie z endpointami ingest,
   które nie chronią się sesją, tylko tokenem. To samo dotyczy trybu webowego,
   stąd `-H 127.0.0.1` przy `dev` i `start` w `package.json`.
