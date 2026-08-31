-- Integracja z Kalendarzem Google (poz. 9 etap 4 z fixes.md).
--
-- ADDYTYWNA: ADD COLUMN + CREATE TABLE + CREATE INDEX.
-- Zero DROP, zero przebudowy tabel, zero backfillu (nie ma czego wypełniać —
-- adresy placówek wpisuje użytkownik, a stan synchronizacji rodzi się pusty).
--
-- Daty przez strftime('%Y-%m-%dT%H:%M:%f+00:00','now') — Prisma nie parsuje
-- formatu CURRENT_TIMESTAMP (brak „T" i strefy). Patrz AGENTS.md, pułapka 2.

-- ─── Adres placówki ─────────────────────────────────────────────────────────
-- Dotąd placówka miała WYŁĄCZNIE nazwę („Synevo"), więc nie było czego wysłać
-- jako „miejsce" zdarzenia. Nullable, bo dla istniejących wpisów nie mamy skąd
-- wziąć adresu — użytkownik uzupełnia je w Słownikach medycznych.
ALTER TABLE "MedicalFacility" ADD COLUMN "address" TEXT;

-- ─── Mapowanie: pozycja agendy → zdarzenie w Google ─────────────────────────
-- `agendaItemId` to stabilny klucz z collectAgendaItems() (np. „visit-<id>"),
-- a nie surowe id rekordu: jedna wizyta z zaplanowaną kontrolą daje dwie
-- niezależne pozycje agendy, a więc dwa osobne zdarzenia.
--
-- Ta tabela to STAN SYNCHRONIZACJI, nie dokumentacja medyczna. Jej utrata
-- oznacza tylko tyle, że przy następnym wysyłce nie wiemy, co już poszło —
-- żadne dane pacjenta w niej nie mieszkają.
--
-- Enum DataSourceType.GOOGLE_CALENDAR nie wymaga tu NICZEGO: sprawdzone, że
-- tabela DataSource nie ma constraintu CHECK, więc wariant wchodzi jako zwykły
-- TEXT (fixes.md, nagłówek grupy C).
CREATE TABLE IF NOT EXISTS "CalendarSync" (
  "id"               TEXT     NOT NULL PRIMARY KEY,
  "userId"           TEXT     NOT NULL,
  "agendaItemId"     TEXT     NOT NULL,
  "googleEventId"    TEXT     NOT NULL,
  "googleCalendarId" TEXT     NOT NULL,
  "lastHash"         TEXT     NOT NULL,
  "lastPushedAt"     DATETIME NOT NULL,
  "createdAt"        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')),
  CONSTRAINT "CalendarSync_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Klucz jednoznaczności: jedna pozycja agendy = najwyżej jedno zdarzenie.
-- To on gwarantuje, że zmiana terminu PRZESUWA zdarzenie, zamiast tworzyć drugie.
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSync_userId_agendaItemId_key"
  ON "CalendarSync" ("userId", "agendaItemId");

CREATE INDEX IF NOT EXISTS "CalendarSync_userId_idx"
  ON "CalendarSync" ("userId");
