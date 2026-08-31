-- Migracja: planowany termin wizyty (opcjonalny).
-- Addytywna. Zero przebudowy tabel, zero DROP. Umożliwia zapisanie
-- ZAPLANOWANEJ wizyty bez ustalonej jeszcze daty (kolumna NULL = „termin nieustalony").
-- Wzorowane na `plannedDate` w HealthDocument (badania).
ALTER TABLE "MedicalVisit" ADD COLUMN "plannedDate" DATETIME;

-- Backfill: istniejące wizyty zaplanowane/anulowane dostają plannedDate = date,
-- żeby po wdrożeniu nadal pokazywały swój dotychczasowy termin (bez tego byłyby
-- błędnie oznaczone jako „termin nieustalony"). Wykonane (DONE) zostają z NULL —
-- dla nich terminem jest kolumna `date`. Bezpieczne: tylko kopiuje istniejącą datę.
UPDATE "MedicalVisit" SET "plannedDate" = "date" WHERE "status" IN ('PLANNED', 'CANCELLED');
