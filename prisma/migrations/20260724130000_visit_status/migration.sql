-- Migracja: status wizyty (Zaplanowane / Wykonane / Anulowane)
-- Addytywna. Istniejące wizyty = DONE (Wykonane).
ALTER TABLE "MedicalVisit" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE';
