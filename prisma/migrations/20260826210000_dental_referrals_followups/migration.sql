-- Migracja zbiorcza grupy C: stomatologia w słownikach, skierowania powiązane
-- z leczeniem, badania kontrolne proponowane przez AI, leki w epizodach.
--
-- Cztery pozycje w JEDNEJ migracji, żeby zrobić jeden przebieg na bazie produkcyjnej
-- zamiast czterech (poz. 8b, 12a, 7a, 5c z fixes.md).
--
-- ADDYTYWNA: wyłącznie ADD COLUMN + CREATE INDEX + backfill UPDATE.
-- Zero DROP, zero przebudowy tabel, zero utraty danych.
-- Daty przez strftime('%Y-%m-%dT%H:%M:%f+00:00','now') — Prisma nie parsuje
-- formatu CURRENT_TIMESTAMP (brak „T" i strefy).
--
-- Zweryfikowane przed napisaniem: żadna z ruszanych tabel nie ma constraintów CHECK,
-- więc kolumny enumowe wchodzą jako zwykły TEXT z DEFAULT.

-- ─── poz. 8b — lek może należeć do epizodu leczenia ──────────────────────────
-- Bez backfillu: nie mamy skąd zgadnąć, do którego leczenia należał dany lek.
ALTER TABLE "Medication" ADD COLUMN "episodeId" TEXT
  REFERENCES "CareEpisode" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Medication_episodeId_idx" ON "Medication" ("episodeId");

-- ─── poz. 12a — DentalRecord dołącza do słowników i epizodów ─────────────────
-- Dotąd wyspa: dentysta i placówka jako wolny tekst, brak statusu, brak updatedAt.
-- Stare kolumny tekstowe („dentist", „facility") ZOSTAJĄ jako backup — tak samo
-- jak przy wizytach. Przepięcie na słowniki robi osobny skrypt (nie SQL, bo to
-- upsert po [userId, name]).
ALTER TABLE "DentalRecord" ADD COLUMN "updatedAt"   DATETIME;
ALTER TABLE "DentalRecord" ADD COLUMN "status"      TEXT NOT NULL DEFAULT 'DONE';
ALTER TABLE "DentalRecord" ADD COLUMN "plannedDate" DATETIME;
ALTER TABLE "DentalRecord" ADD COLUMN "dentistId"   TEXT
  REFERENCES "MedicalDoctor" ("id") ON DELETE SET NULL;
ALTER TABLE "DentalRecord" ADD COLUMN "facilityId"  TEXT
  REFERENCES "MedicalFacility" ("id") ON DELETE SET NULL;
ALTER TABLE "DentalRecord" ADD COLUMN "episodeId"   TEXT
  REFERENCES "CareEpisode" ("id") ON DELETE SET NULL;

-- `updatedAt` musi wejść jako nullable — ADD COLUMN NOT NULL bez wartości domyślnej
-- wysadza się na niepustej tabeli. Backfill z createdAt daje sensowną wartość
-- początkową; od tej chwili pilnuje jej Prisma (@updatedAt).
UPDATE "DentalRecord" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "DentalRecord_userId_date_idx" ON "DentalRecord" ("userId", "date");
CREATE INDEX IF NOT EXISTS "DentalRecord_episodeId_idx"   ON "DentalRecord" ("episodeId");

-- ─── poz. 7a — skierowanie wie, z czego wynika i czym zostało zrealizowane ───
ALTER TABLE "Referral" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Referral" ADD COLUMN "episodeId"  TEXT
  REFERENCES "CareEpisode" ("id") ON DELETE SET NULL;
ALTER TABLE "Referral" ADD COLUMN "bodyPartId" TEXT
  REFERENCES "BodyPart" ("id") ON DELETE SET NULL;
ALTER TABLE "Referral" ADD COLUMN "fulfilledByVisitId" TEXT
  REFERENCES "MedicalVisit" ("id") ON DELETE SET NULL;
ALTER TABLE "Referral" ADD COLUMN "fulfilledByDocumentId" TEXT
  REFERENCES "HealthDocument" ("id") ON DELETE SET NULL;

-- `isUsed` NIE jest usuwane (byłoby destrukcyjne) — zostaje jako [legacy].
-- Nowy kod pisze oba pola, czyta wyłącznie `status`.
-- Idempotentne: ponowne wykonanie ustawi to samo.
UPDATE "Referral" SET "status" = 'FULFILLED' WHERE "isUsed" = 1;

CREATE INDEX IF NOT EXISTS "Referral_episodeId_idx"  ON "Referral" ("episodeId");
CREATE INDEX IF NOT EXISTS "Referral_bodyPartId_idx" ON "Referral" ("bodyPartId");

-- ─── poz. 5c — kontrola zalecona w opisie badania ────────────────────────────
-- `followUpDate`/`followUpNote` — dotąd miał to tylko MedicalVisit.
-- `aiSuggestions` trzyma ostatnie propozycje AI wraz z decyzją użytkownika,
-- żeby po odświeżeniu strony nie znikły i żeby nie pytać drugi raz o odrzucone.
ALTER TABLE "HealthDocument" ADD COLUMN "followUpDate"  DATETIME;
ALTER TABLE "HealthDocument" ADD COLUMN "followUpNote"  TEXT;
ALTER TABLE "HealthDocument" ADD COLUMN "aiSuggestions" JSONB;
