-- Migracja: epizody leczenia (CareEpisode).
--
-- Cel: BodyPart zostaje słownikiem anatomicznym („Kolano lewe" istnieje raz per user),
-- a leczenie staje się osobnym, zamykalnym wątkiem. Dzięki temu „Uraz łąkotki 2026"
-- i „Ból kolana 2031" to dwa różne epizody tej samej części ciała, bez mieszania historii.
--
-- ADDYTYWNA: CREATE TABLE + ADD COLUMN + backfill INSERT/UPDATE.
-- Zero DROP, zero przebudowy tabel, zero utraty danych. Wzorowana na
-- 20260724140000_visit_planned_date (która też zawiera backfill UPDATE).

CREATE TABLE IF NOT EXISTS "CareEpisode" (
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "userId"     TEXT     NOT NULL,
  "bodyPartId" TEXT     NOT NULL,
  "title"      TEXT     NOT NULL,
  "status"     TEXT     NOT NULL DEFAULT 'ACTIVE',
  "startDate"  DATETIME NOT NULL,
  "endDate"    DATETIME,
  "outcome"    TEXT,
  "notes"      TEXT,
  "createdAt"  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')),
  "updatedAt"  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')),
  CONSTRAINT "CareEpisode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CareEpisode_bodyPartId_fkey"
    FOREIGN KEY ("bodyPartId") REFERENCES "BodyPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CareEpisode_userId_bodyPartId_idx" ON "CareEpisode" ("userId", "bodyPartId");
CREATE INDEX IF NOT EXISTS "CareEpisode_userId_status_idx"     ON "CareEpisode" ("userId", "status");

-- Podpięcie istniejących rekordów. SQLite dopuszcza ADD COLUMN z REFERENCES,
-- gdy domyślną wartością jest NULL — jest.
ALTER TABLE "MedicalVisit"   ADD COLUMN "episodeId" TEXT REFERENCES "CareEpisode" ("id") ON DELETE SET NULL;
ALTER TABLE "HealthDocument" ADD COLUMN "episodeId" TEXT REFERENCES "CareEpisode" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "MedicalVisit_episodeId_idx"   ON "MedicalVisit" ("episodeId");
CREATE INDEX IF NOT EXISTS "HealthDocument_episodeId_idx" ON "HealthDocument" ("episodeId");

-- ─── Backfill (idempotentny) ──────────────────────────────────────────────────
-- Dla każdej części ciała, która ma już jakieś wizyty lub badania, a NIE ma jeszcze
-- żadnego epizodu — tworzymy jeden epizod ACTIVE o tytule równym nazwie części ciała,
-- z datą startu = data najstarszego powiązanego rekordu.
-- Warunek NOT EXISTS sprawia, że ponowne uruchomienie migracji nic nie zmieni.
INSERT INTO "CareEpisode" ("id", "userId", "bodyPartId", "title", "status", "startDate", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))),
  bp."userId",
  bp."id",
  bp."name",
  'ACTIVE',
  COALESCE(
    (SELECT MIN(x."d") FROM (
       SELECT v."date" AS "d" FROM "MedicalVisit"   v WHERE v."bodyPartId" = bp."id"
       UNION ALL
       SELECT d."studyDate"   FROM "HealthDocument" d WHERE d."bodyPartId" = bp."id"
     ) x),
    strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
  ),
  strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now'),
  strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
FROM "BodyPart" bp
WHERE
  (
    EXISTS (SELECT 1 FROM "MedicalVisit"   v WHERE v."bodyPartId" = bp."id")
    OR
    EXISTS (SELECT 1 FROM "HealthDocument" d WHERE d."bodyPartId" = bp."id")
  )
  AND NOT EXISTS (SELECT 1 FROM "CareEpisode" e WHERE e."bodyPartId" = bp."id");

-- Podpięcie rekordów do właśnie utworzonych epizodów. Ruszamy WYŁĄCZNIE rekordy
-- bez epizodu i tylko tam, gdzie dana część ciała ma dokładnie jeden epizod —
-- czyli nigdy nie nadpisujemy ręcznych przypisań użytkownika.
UPDATE "MedicalVisit"
SET "episodeId" = (
  SELECT e."id" FROM "CareEpisode" e WHERE e."bodyPartId" = "MedicalVisit"."bodyPartId"
)
WHERE "episodeId" IS NULL
  AND "bodyPartId" IS NOT NULL
  AND (SELECT COUNT(*) FROM "CareEpisode" e WHERE e."bodyPartId" = "MedicalVisit"."bodyPartId") = 1;

UPDATE "HealthDocument"
SET "episodeId" = (
  SELECT e."id" FROM "CareEpisode" e WHERE e."bodyPartId" = "HealthDocument"."bodyPartId"
)
WHERE "episodeId" IS NULL
  AND "bodyPartId" IS NOT NULL
  AND (SELECT COUNT(*) FROM "CareEpisode" e WHERE e."bodyPartId" = "HealthDocument"."bodyPartId") = 1;
