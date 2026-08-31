#!/usr/bin/env node
/**
 * Jednorazowa, IDEMPOTENTNA migracja danych: wolny tekst → słowniki medyczne.
 *
 * Z istniejących wizyt (MedicalVisit) i badań (HealthDocument) tworzy wpisy
 * słownikowe (MedicalDoctor / MedicalFacility / BodyPart) i podpina je przez FK.
 * Stare kolumny tekstowe (doctorName, facility, reason, doctor, laboratory)
 * ZOSTAJĄ nietknięte jako kopia zapasowa.
 *
 * BEZPIECZEŃSTWO:
 *   - Robi kopię pliku bazy do backups/ PRZED jakąkolwiek zmianą.
 *   - Cała migracja w jednej transakcji; asercje liczności; ROLLBACK przy błędzie.
 *   - Uruchamiać NAJPIERW na kopii prisma/dev.db, dopiero po weryfikacji na realnych bazach.
 *   - Aplikacja (Electron) musi być zamknięta, gdy migrujesz healthos.db.
 *
 * Użycie:
 *   node scripts/migrate-medical-dictionaries.js <ścieżka-do-.db> [--no-backup]
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

const dbPath = path.resolve(process.argv[2] || "prisma/dev.db");
const noBackup = process.argv.includes("--no-backup");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Baza nie istnieje: ${dbPath}`);
  process.exit(1);
}

// cuid-podobny identyfikator (spójny z resztą: TEXT PK)
function makeId(prefix) {
  return prefix + crypto.randomBytes(12).toString("hex");
}

function backupDb(srcPath) {
  const backupsDir = path.resolve(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  // checkpoint WAL, żeby kopia była kompletna
  try {
    const tmp = new Database(srcPath);
    tmp.pragma("wal_checkpoint(TRUNCATE)");
    tmp.close();
  } catch (e) {
    console.warn("  ⚠ checkpoint WAL nieudany (kontynuuję):", e.message);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(srcPath, path.extname(srcPath));
  const dest = path.join(backupsDir, `${base}-predict-${ts}.db`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

console.log(`\n🗂  Migracja słowników medycznych dla: ${dbPath}`);

if (!noBackup) {
  const backupPath = backupDb(dbPath);
  console.log(`  ✅ Kopia zapasowa: ${backupPath}`);
} else {
  console.log("  ⚠ Pominięto backup (--no-backup)");
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// Statementy pomocnicze
const users = db.prepare("SELECT id FROM User").all();

const upsertDoctor = db.prepare(
  `INSERT INTO MedicalDoctor (id, userId, name, specialization, createdAt, updatedAt)
   VALUES (@id, @userId, @name, @specialization, current_timestamp, current_timestamp)
   ON CONFLICT(userId, name) DO NOTHING`
);
const getDoctor = db.prepare("SELECT id FROM MedicalDoctor WHERE userId = ? AND name = ?");
const upsertFacility = db.prepare(
  `INSERT INTO MedicalFacility (id, userId, name, createdAt, updatedAt)
   VALUES (@id, @userId, @name, current_timestamp, current_timestamp)
   ON CONFLICT(userId, name) DO NOTHING`
);
const getFacility = db.prepare("SELECT id FROM MedicalFacility WHERE userId = ? AND name = ?");
const upsertBodyPart = db.prepare(
  `INSERT INTO BodyPart (id, userId, name, createdAt, updatedAt)
   VALUES (@id, @userId, @name, current_timestamp, current_timestamp)
   ON CONFLICT(userId, name) DO NOTHING`
);
const getBodyPart = db.prepare("SELECT id FROM BodyPart WHERE userId = ? AND name = ?");

function resolveDoctor(userId, name, specialization) {
  const n = (name || "").trim();
  if (!n) return null;
  upsertDoctor.run({ id: makeId("md_"), userId, name: n, specialization: (specialization || "").trim() || null });
  return getDoctor.get(userId, n).id;
}
function resolveFacility(userId, name) {
  const n = (name || "").trim();
  if (!n) return null;
  upsertFacility.run({ id: makeId("mf_"), userId, name: n });
  return getFacility.get(userId, n).id;
}
function resolveBodyPart(userId, name) {
  const n = (name || "").trim();
  if (!n) return null;
  upsertBodyPart.run({ id: makeId("bp_"), userId, name: n });
  return getBodyPart.get(userId, n).id;
}

const updVisit = db.prepare(
  "UPDATE MedicalVisit SET doctorId = ?, facilityId = ?, bodyPartId = ? WHERE id = ?"
);
const updDoc = db.prepare(
  "UPDATE HealthDocument SET performingDoctorId = ?, facilityId = ? WHERE id = ?"
);

// Liczby PRZED (do asercji)
const before = {
  users: users.length,
  visits: db.prepare("SELECT COUNT(*) c FROM MedicalVisit").get().c,
  docs: db.prepare("SELECT COUNT(*) c FROM HealthDocument").get().c,
};

const run = db.transaction(() => {
  let visitCount = 0;
  let docCount = 0;

  for (const { id: userId } of users) {
    const visits = db
      .prepare("SELECT id, doctorName, specialization, facility, reason FROM MedicalVisit WHERE userId = ?")
      .all(userId);
    for (const v of visits) {
      const doctorId = resolveDoctor(userId, v.doctorName, v.specialization);
      const facilityId = resolveFacility(userId, v.facility);
      const bodyPartId = resolveBodyPart(userId, v.reason);
      updVisit.run(doctorId, facilityId, bodyPartId, v.id);
      visitCount++;
    }

    const docs = db
      .prepare("SELECT id, doctor, laboratory FROM HealthDocument WHERE userId = ?")
      .all(userId);
    for (const d of docs) {
      const performingDoctorId = resolveDoctor(userId, d.doctor, null);
      const facilityId = resolveFacility(userId, d.laboratory);
      updDoc.run(performingDoctorId, facilityId, d.id);
      docCount++;
    }
  }

  // ─── ASERCJE ───────────────────────────────────────────────────────────────
  const after = {
    visits: db.prepare("SELECT COUNT(*) c FROM MedicalVisit").get().c,
    docs: db.prepare("SELECT COUNT(*) c FROM HealthDocument").get().c,
  };
  const assert = (cond, msg) => { if (!cond) throw new Error("ASERCJA: " + msg); };

  assert(after.visits === before.visits, `liczba wizyt zmieniona (${before.visits} → ${after.visits})`);
  assert(after.docs === before.docs, `liczba badań zmieniona (${before.docs} → ${after.docs})`);
  assert(visitCount === before.visits, `przetworzono ${visitCount}/${before.visits} wizyt`);
  assert(docCount === before.docs, `przetworzono ${docCount}/${before.docs} badań`);

  // każda wizyta ma doctorId + bodyPartId (bo doctorName i reason są NOT NULL)
  const visitsMissingDoctor = db.prepare(
    "SELECT COUNT(*) c FROM MedicalVisit WHERE TRIM(doctorName) <> '' AND doctorId IS NULL"
  ).get().c;
  const visitsMissingBody = db.prepare(
    "SELECT COUNT(*) c FROM MedicalVisit WHERE TRIM(reason) <> '' AND bodyPartId IS NULL"
  ).get().c;
  const visitsMissingFacility = db.prepare(
    "SELECT COUNT(*) c FROM MedicalVisit WHERE facility IS NOT NULL AND TRIM(facility) <> '' AND facilityId IS NULL"
  ).get().c;
  assert(visitsMissingDoctor === 0, `${visitsMissingDoctor} wizyt bez doctorId`);
  assert(visitsMissingBody === 0, `${visitsMissingBody} wizyt bez bodyPartId`);
  assert(visitsMissingFacility === 0, `${visitsMissingFacility} wizyt z placówką bez facilityId`);

  const docsMissingDoctor = db.prepare(
    "SELECT COUNT(*) c FROM HealthDocument WHERE doctor IS NOT NULL AND TRIM(doctor) <> '' AND performingDoctorId IS NULL"
  ).get().c;
  const docsMissingFacility = db.prepare(
    "SELECT COUNT(*) c FROM HealthDocument WHERE laboratory IS NOT NULL AND TRIM(laboratory) <> '' AND facilityId IS NULL"
  ).get().c;
  assert(docsMissingDoctor === 0, `${docsMissingDoctor} badań z lekarzem bez performingDoctorId`);
  assert(docsMissingFacility === 0, `${docsMissingFacility} badań z placówką bez facilityId`);

  return {
    doctors: db.prepare("SELECT COUNT(*) c FROM MedicalDoctor").get().c,
    facilities: db.prepare("SELECT COUNT(*) c FROM MedicalFacility").get().c,
    bodyParts: db.prepare("SELECT COUNT(*) c FROM BodyPart").get().c,
    visitCount,
    docCount,
  };
});

try {
  const stats = run();
  // dodatkowa kontrola integralności FK
  const fkIssues = db.prepare("PRAGMA foreign_key_check").all();
  if (fkIssues.length > 0) {
    console.error("❌ Naruszenia FK po migracji:", fkIssues);
    process.exit(1);
  }
  console.log("  ✅ Migracja danych zakończona (transakcja zatwierdzona).");
  console.log(`     Wizyty przetworzone: ${stats.visitCount}, badania: ${stats.docCount}`);
  console.log(`     Słowniki → lekarze: ${stats.doctors}, placówki: ${stats.facilities}, części ciała: ${stats.bodyParts}`);
  console.log("     (Stare kolumny tekstowe pozostały nietknięte jako backup.)\n");
} catch (err) {
  console.error("❌ ROLLBACK —", err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
