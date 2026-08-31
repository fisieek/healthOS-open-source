#!/usr/bin/env node
/**
 * IDEMPOTENTNA migracja danych: wolny tekst → słowniki medyczne, dla stomatologii.
 *
 * Z istniejących zabiegów (DentalRecord) tworzy wpisy słownikowe
 * (MedicalDoctor / MedicalFacility) i podpina je przez FK `dentistId` / `facilityId`.
 * Stare kolumny tekstowe (`dentist`, `facility`) ZOSTAJĄ nietknięte jako kopia
 * zapasowa — tak samo jak przy wizytach.
 *
 * Dlaczego osobny skrypt, a nie SQL w migracji: to upsert po [userId, name],
 * czyli logika, a nie zmiana struktury.
 *
 * BEZPIECZEŃSTWO:
 *   - Robi kopię pliku bazy do backups/ PRZED jakąkolwiek zmianą.
 *   - Cała migracja w jednej transakcji; ROLLBACK przy błędzie.
 *   - Rusza WYŁĄCZNIE rekordy, które mają tekst, a nie mają jeszcze FK —
 *     ponowne uruchomienie nie zmieni niczego.
 *   - Aplikacja (Electron) musi być zamknięta, gdy migrujesz healthos.db.
 *
 * Użycie:
 *   node scripts/migrate-dental-dictionaries.js <ścieżka-do-.db> [--dry-run] [--no-backup]
 *   (domyślnie: prisma/dev.db)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function findBetterSqlite3() {
  try {
    return require("better-sqlite3");
  } catch {}
  const standalonePath = path.resolve(
    __dirname, "..", ".next", "standalone", "node_modules", "better-sqlite3"
  );
  if (fs.existsSync(standalonePath)) return require(standalonePath);
  throw new Error("Cannot find better-sqlite3 module");
}
const Database = findBetterSqlite3();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noBackup = args.includes("--no-backup");
const dbPath = path.resolve(args.find((a) => !a.startsWith("--")) || "prisma/dev.db");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Baza nie istnieje: ${dbPath}`);
  process.exit(1);
}

function makeId(prefix) {
  return prefix + crypto.randomBytes(12).toString("hex");
}

/** Format daty, który Prisma sparsuje. CURRENT_TIMESTAMP NIE działa — brak „T" i strefy. */
const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%f+00:00','now')";

function backupDb(srcPath) {
  const backupsDir = path.resolve(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  try {
    const tmp = new Database(srcPath);
    tmp.pragma("wal_checkpoint(TRUNCATE)");
    tmp.close();
  } catch (e) {
    console.warn("  ⚠ checkpoint WAL nieudany (kontynuuję):", e.message);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(srcPath, path.extname(srcPath));
  const dest = path.join(backupsDir, `${base}-preDentalDict-${ts}.db`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

console.log(`\n🦷 Migracja słowników stomatologicznych dla: ${dbPath}`);
if (dryRun) console.log("  🔍 TRYB PODGLĄDU (--dry-run) — nic nie zostanie zapisane.\n");

if (!dryRun && !noBackup) {
  console.log(`  ✅ Kopia zapasowa: ${backupDb(dbPath)}`);
} else if (!dryRun) {
  console.log("  ⚠ Pominięto backup (--no-backup)");
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const insertDoctor = db.prepare(
  `INSERT INTO MedicalDoctor (id, userId, name, specialization, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ${NOW_SQL}, ${NOW_SQL})
   ON CONFLICT(userId, name) DO NOTHING`
);
const getDoctor = db.prepare(
  "SELECT id FROM MedicalDoctor WHERE userId = ? AND name = ?"
);
const insertFacility = db.prepare(
  `INSERT INTO MedicalFacility (id, userId, name, createdAt, updatedAt)
   VALUES (?, ?, ?, ${NOW_SQL}, ${NOW_SQL})
   ON CONFLICT(userId, name) DO NOTHING`
);
const getFacility = db.prepare(
  "SELECT id FROM MedicalFacility WHERE userId = ? AND name = ?"
);
const setDentalRefs = db.prepare(
  "UPDATE DentalRecord SET dentistId = COALESCE(?, dentistId), facilityId = COALESCE(?, facilityId) WHERE id = ?"
);

// Bierzemy wyłącznie rekordy, które mają jeszcze co przepiąć.
const rows = db
  .prepare(
    `SELECT id, userId, dentist, facility, dentistId, facilityId
     FROM DentalRecord
     WHERE (dentist  IS NOT NULL AND TRIM(dentist)  <> '' AND dentistId  IS NULL)
        OR (facility IS NOT NULL AND TRIM(facility) <> '' AND facilityId IS NULL)`
  )
  .all();

console.log(`  Zabiegów do przepięcia: ${rows.length}`);

if (rows.length === 0) {
  console.log("  ✓ Nic do zrobienia — słowniki już podpięte.\n");
  db.close();
  process.exit(0);
}

const stats = { doctorsCreated: 0, facilitiesCreated: 0, recordsUpdated: 0 };

const run = db.transaction(() => {
  for (const row of rows) {
    let dentistId = null;
    let facilityId = null;

    const dentistName = (row.dentist || "").trim();
    if (dentistName && !row.dentistId) {
      let existing = getDoctor.get(row.userId, dentistName);
      if (!existing) {
        // Nowy wpis dostaje specjalizację „Stomatolog"; istniejącego lekarza
        // (np. utworzonego z wizyt) NIE nadpisujemy.
        insertDoctor.run(makeId("dnt"), row.userId, dentistName, "Stomatolog");
        existing = getDoctor.get(row.userId, dentistName);
        stats.doctorsCreated++;
      }
      dentistId = existing ? existing.id : null;
    }

    const facilityName = (row.facility || "").trim();
    if (facilityName && !row.facilityId) {
      let existing = getFacility.get(row.userId, facilityName);
      if (!existing) {
        insertFacility.run(makeId("dnf"), row.userId, facilityName);
        existing = getFacility.get(row.userId, facilityName);
        stats.facilitiesCreated++;
      }
      facilityId = existing ? existing.id : null;
    }

    if (dentistId || facilityId) {
      setDentalRefs.run(dentistId, facilityId, row.id);
      stats.recordsUpdated++;
    }
    console.log(
      `    · ${row.id}  dentysta="${dentistName || "—"}"  placówka="${facilityName || "—"}"`
    );
  }

  if (dryRun) {
    // Podgląd: pokazujemy skutki, ale nic nie utrwalamy.
    throw new Error("__DRY_RUN__");
  }
});

try {
  run();
  console.log(
    `\n  ✅ Gotowe. Lekarzy utworzonych: ${stats.doctorsCreated}, placówek: ${stats.facilitiesCreated}, zabiegów zaktualizowanych: ${stats.recordsUpdated}\n`
  );
} catch (err) {
  if (err.message === "__DRY_RUN__") {
    console.log(
      `\n  🔍 Podgląd zakończony — wycofano. Powstałoby: lekarzy ${stats.doctorsCreated}, placówek ${stats.facilitiesCreated}, aktualizacji ${stats.recordsUpdated}\n`
    );
  } else {
    console.error("\n  ❌ Błąd — wycofano wszystkie zmiany:", err.message, "\n");
    process.exitCode = 1;
  }
} finally {
  db.close();
}
