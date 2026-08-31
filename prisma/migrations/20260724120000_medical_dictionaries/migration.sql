-- Migracja: słowniki medyczne (Lekarz / Placówka / Powód-Część ciała) + status badań
--
-- ⚠️ WYŁĄCZNIE ADDYTYWNA. Zero przebudowy tabel (żadnego DROP TABLE HealthDocument /
-- MedicalVisit). Nowe kolumny FK dodane przez ALTER TABLE ADD COLUMN z klauzulą
-- REFERENCES — SQLite na to pozwala, bo kolumny są nullable (domyślnie NULL).
-- Istniejące dane (wizyty, badania) pozostają nietknięte; stare kolumny tekstowe
-- (doctorName / facility / reason / doctor / laboratory) zostają jako kopia zapasowa.

-- CreateTable: słownik lekarzy per-user
CREATE TABLE "MedicalDoctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalDoctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: słownik placówek per-user
CREATE TABLE "MedicalFacility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalFacility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: słownik „Powód / Część ciała" per-user (oś grupowania)
CREATE TABLE "BodyPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BodyPart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: słowniki
CREATE INDEX "MedicalDoctor_userId_idx" ON "MedicalDoctor"("userId");
CREATE UNIQUE INDEX "MedicalDoctor_userId_name_key" ON "MedicalDoctor"("userId", "name");
CREATE INDEX "MedicalFacility_userId_idx" ON "MedicalFacility"("userId");
CREATE UNIQUE INDEX "MedicalFacility_userId_name_key" ON "MedicalFacility"("userId", "name");
CREATE INDEX "BodyPart_userId_idx" ON "BodyPart"("userId");
CREATE UNIQUE INDEX "BodyPart_userId_name_key" ON "BodyPart"("userId", "name");

-- AlterTable HealthDocument: status + planowany termin + FK (addytywnie)
ALTER TABLE "HealthDocument" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE';
ALTER TABLE "HealthDocument" ADD COLUMN "plannedDate" DATETIME;
ALTER TABLE "HealthDocument" ADD COLUMN "bodyPartId" TEXT REFERENCES "BodyPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthDocument" ADD COLUMN "visitId" TEXT REFERENCES "MedicalVisit" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthDocument" ADD COLUMN "orderingDoctorId" TEXT REFERENCES "MedicalDoctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthDocument" ADD COLUMN "performingDoctorId" TEXT REFERENCES "MedicalDoctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthDocument" ADD COLUMN "facilityId" TEXT REFERENCES "MedicalFacility" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "HealthDocument_userId_status_idx" ON "HealthDocument"("userId", "status");
CREATE INDEX "HealthDocument_bodyPartId_idx" ON "HealthDocument"("bodyPartId");
CREATE INDEX "HealthDocument_visitId_idx" ON "HealthDocument"("visitId");

-- AlterTable MedicalVisit: FK do słowników (addytywnie)
ALTER TABLE "MedicalVisit" ADD COLUMN "doctorId" TEXT REFERENCES "MedicalDoctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalVisit" ADD COLUMN "facilityId" TEXT REFERENCES "MedicalFacility" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalVisit" ADD COLUMN "bodyPartId" TEXT REFERENCES "BodyPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MedicalVisit_userId_bodyPartId_idx" ON "MedicalVisit"("userId", "bodyPartId");
