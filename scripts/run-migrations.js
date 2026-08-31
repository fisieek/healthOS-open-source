#!/usr/bin/env node
/**
 * Standalone migration runner for Electron.
 *
 * Called by electron/main.ts via child_process.spawnSync.
 *
 * ⚠️ Uruchamiany binarką Electrona z ELECTRON_RUN_AS_NODE=1, nie systemowym node —
 * `better_sqlite3.node` w paczce jest zbudowany pod ABI Electrona (AGENTS.md §6.3).
 * Ręcznie odpalisz go tak samo:
 *   ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron scripts/run-migrations.js <db> <migrations>
 * Zwykły `node scripts/run-migrations.js` zadziała TYLKO gdy better-sqlite3 jest
 * aktualnie zbudowany pod Node (czyli po `npm rebuild better-sqlite3`).
 *
 * Args:
 *   process.argv[2] = absolute path to .db file
 *   process.argv[3] = absolute path to migrations directory
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Find better-sqlite3: try standard CJS resolution first, then look in
// .next/standalone/node_modules (production packaged app).
function findBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch {}
  // In packaged app: scripts/run-migrations.js is in Resources/app/scripts/,
  // but better-sqlite3 lives in Resources/app/.next/standalone/node_modules/
  const standalonePath = path.resolve(
    __dirname,
    '..',
    '.next',
    'standalone',
    'node_modules',
    'better-sqlite3'
  );
  if (fs.existsSync(standalonePath)) {
    return require(standalonePath);
  }
  throw new Error(
    'Cannot find better-sqlite3 module (looked in CJS paths and ' +
    standalonePath + ')'
  );
}

const Database = findBetterSqlite3();

const dbPath = process.argv[2];
const migrationsDir = process.argv[3];

if (!dbPath || !migrationsDir) {
  console.error('Usage: run-migrations.js <db-path> <migrations-dir>');
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  console.warn(`Migrations dir not found: ${migrationsDir} — skipping.`);
  process.exit(0);
}

const db = new Database(dbPath);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    );
  `);

  const migrations = fs.readdirSync(migrationsDir)
    .filter((name) => {
      const sub = path.join(migrationsDir, name);
      return fs.statSync(sub).isDirectory() &&
             fs.existsSync(path.join(sub, 'migration.sql'));
    })
    .sort();

  const applied = db.prepare(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL'
  ).all();
  const appliedSet = new Set(applied.map((r) => r.migration_name));

  for (const name of migrations) {
    if (appliedSet.has(name)) {
      console.log(`  ✓ ${name} (już zaaplikowana)`);
      continue;
    }

    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const id = crypto.randomUUID();

    console.log(`  → ${name} (aplikowanie...)`);
    try {
      db.exec('BEGIN');
      db.exec(sql);
      db.prepare(`
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
        VALUES (?, ?, current_timestamp, ?, 1)
      `).run(id, checksum, name);
      db.exec('COMMIT');
      console.log(`  ✅ ${name} (zaaplikowana)`);
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      if (err.message && err.message.includes('already exists')) {
        db.prepare(`
          INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
          VALUES (?, ?, current_timestamp, ?, 1)
        `).run(id, checksum, name);
        console.log(`  ⓘ ${name} (tabele już istniały, zarejestrowano jako zaaplikowaną)`);
      } else {
        console.error(`  ❌ ${name} —`, err.message);
        throw err;
      }
    }
  }

  seedNutrientsAndBackfill(db);

  console.log('✅ Migracje zakończone.');
} finally {
  db.close();
}

function seedNutrientsAndBackfill(db) {
  // Sprawdź, czy tabela Nutrient istnieje
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Nutrient'").get();
  if (!tableCheck) return;

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM Nutrient').get();
  if (countRow && countRow.cnt > 0) {
    console.log('  ⓘ Tabela Nutrient posiada już dane (pomijam seedowanie).');
    backfillIngredients(db);
    return;
  }

  console.log('  → Seedowanie nutrientów...');

  const nutrientsToSeed = [
    // Witaminy
    { slug: "vitamin-c", name: "Witamina C", nameEn: "Vitamin C", category: "VITAMIN", defaultUnit: "mg", rda: 80, upperLimit: 2000, aliases: ["witamina c", "kwas askorbinowy", "vitamin c", "ascorbic acid", "kwas l-askorbinowy"], sortOrder: 1 },
    { slug: "vitamin-d", name: "Witamina D", nameEn: "Vitamin D", category: "VITAMIN", defaultUnit: "μg", rda: 20, upperLimit: 100, aliases: ["witamina d", "cholekalcyferol", "vitamin d", "cholecalciferol", "d3", "witamina d3", "ergokalcyferol"], sortOrder: 2 },
    { slug: "vitamin-b6", name: "Witamina B6", nameEn: "Vitamin B6", category: "VITAMIN", defaultUnit: "mg", rda: 1.4, upperLimit: 100, aliases: ["witamina b6", "pyridoxine", "pirydoksyna", "vitamin b6", "chlorowodorek pirydoksyny"], sortOrder: 3 },
    { slug: "vitamin-b12", name: "Witamina B12", nameEn: "Vitamin B12", category: "VITAMIN", defaultUnit: "μg", rda: 2.5, upperLimit: null, aliases: ["witamina b12", "vitamin b12", "metylokobalamina", "cyanocobalamin", "kobalamina", "cyjanokobalamina"], sortOrder: 4 },
    { slug: "vitamin-a", name: "Witamina A", nameEn: "Vitamin A", category: "VITAMIN", defaultUnit: "μg", rda: 800, upperLimit: 3000, aliases: ["witamina a", "retinol", "vitamin a", "octan retinylu", "palmitynian retinylu"], sortOrder: 5 },
    { slug: "vitamin-e", name: "Witamina E", nameEn: "Vitamin E", category: "VITAMIN", defaultUnit: "mg", rda: 12, upperLimit: 300, aliases: ["witamina e", "tokoferol", "vitamin e", "tocopherol", "octan d-alfa-tokoferylu"], sortOrder: 6 },
    { slug: "vitamin-k", name: "Witamina K", nameEn: "Vitamin K", category: "VITAMIN", defaultUnit: "μg", rda: 75, upperLimit: null, aliases: ["witamina k", "menachinon", "filochinon", "vitamin k", "k2", "k1", "k2 mk7", "k2 mk-7"], sortOrder: 7 },
    { slug: "thiamin", name: "Tiamina (B1)", nameEn: "Thiamin", category: "VITAMIN", defaultUnit: "mg", rda: 1.1, upperLimit: null, aliases: ["tiamina", "witamina b1", "thiamin", "thiamine", "chlorowodorek tiaminy"], sortOrder: 8 },
    { slug: "riboflavin", name: "Ryboflawina (B2)", nameEn: "Riboflavin", category: "VITAMIN", defaultUnit: "mg", rda: 1.4, upperLimit: null, aliases: ["ryboflawina", "witamina b2", "riboflavin", "riboflavine"], sortOrder: 9 },
    { slug: "niacin", name: "Niacyna (B3)", nameEn: "Niacin", category: "VITAMIN", defaultUnit: "mg", rda: 16, upperLimit: 35, aliases: ["niacyna", "witamina b3", "niacin", "nicotinamide", "kwas nikotynowy", "amid kwasu nikotynowego"], sortOrder: 10 },
    { slug: "pantothenic-acid", name: "Kwas pantotenowy (B5)", nameEn: "Pantothenic acid", category: "VITAMIN", defaultUnit: "mg", rda: 6, upperLimit: null, aliases: ["kwas pantotenowy", "witamina b5", "pantothenic acid", "pantotenian wapnia", "d-pantotenian wapnia"], sortOrder: 11 },
    { slug: "folic-acid", name: "Kwas foliowy (B9)", nameEn: "Folic acid", category: "VITAMIN", defaultUnit: "μg", rda: 200, upperLimit: 1000, aliases: ["kwas foliowy", "foliany", "witamina b9", "folic acid", "folate", "l-metylofolian wapnia"], sortOrder: 12 },
    { slug: "biotin", name: "Biotyna (B7)", nameEn: "Biotin", category: "VITAMIN", defaultUnit: "μg", rda: 50, upperLimit: null, aliases: ["biotyna", "witamina b7", "witamina h", "biotin", "d-biotyna"], sortOrder: 13 },
    // Minerały
    { slug: "magnesium", name: "Magnez", nameEn: "Magnesium", category: "MINERAL", defaultUnit: "mg", rda: 375, upperLimit: 350, aliases: ["magnez", "magnesium", "tlenek magnezu", "cytrynian magnezu", "mleczan magnezu", "magnesium citrate", "diglicynian magnezu", "chelat magnezu"], sortOrder: 14 },
    { slug: "zinc", name: "Cynk", nameEn: "Zinc", category: "MINERAL", defaultUnit: "mg", rda: 10, upperLimit: 25, aliases: ["cynk", "zinc", "picolinate", "cynk pikolinian", "gluconate", "glukonian cynku", "tlenek cynku"], sortOrder: 15 },
    { slug: "iron", name: "Żelazo", nameEn: "Iron", category: "MINERAL", defaultUnit: "mg", rda: 14, upperLimit: 45, aliases: ["zelazo", "iron", "diglicynian zelaza", "siarczan zelaza"], sortOrder: 16 },
    { slug: "calcium", name: "Wapń", nameEn: "Calcium", category: "MINERAL", defaultUnit: "mg", rda: 800, upperLimit: 2500, aliases: ["wapn", "calcium", "weglan wapnia", "cytrynian wapnia"], sortOrder: 17 },
    { slug: "potassium", name: "Potas", nameEn: "Potassium", category: "MINERAL", defaultUnit: "mg", rda: 2000, upperLimit: null, aliases: ["potas", "potassium", "chlorek potasu", "cytrynian potasu"], sortOrder: 18 },
    { slug: "selenium", name: "Selen", nameEn: "Selenium", category: "MINERAL", defaultUnit: "μg", rda: 55, upperLimit: 300, aliases: ["selen", "selenium", "l-selenometionina", "selenian sodu"], sortOrder: 19 },
    { slug: "iodine", name: "Jod", nameEn: "Iodine", category: "MINERAL", defaultUnit: "μg", rda: 150, upperLimit: 600, aliases: ["jod", "iodine", "jodek potasu"], sortOrder: 20 },
    { slug: "copper", name: "Miedź", nameEn: "Copper", category: "MINERAL", defaultUnit: "mg", rda: 1, upperLimit: 5, aliases: ["miedz", "copper", "glukonian miedzi"], sortOrder: 21 },
    { slug: "manganese", name: "Mangan", nameEn: "Manganese", category: "MINERAL", defaultUnit: "mg", rda: 2, upperLimit: 11, aliases: ["mangan", "manganese", "siarczan manganu"], sortOrder: 22 },
    { slug: "chromium", name: "Chrom", nameEn: "Chromium", category: "MINERAL", defaultUnit: "μg", rda: 40, upperLimit: null, aliases: ["chrom", "chromium", "pikolinian chromu"], sortOrder: 23 },
    // Kwasy tłuszczowe
    { slug: "omega-3", name: "Kwasy Omega-3", nameEn: "Omega-3 fatty acids", category: "FATTY_ACID", defaultUnit: "mg", rda: 250, upperLimit: 5000, aliases: ["omega-3", "omega 3", "epa", "dha", "kwas omega-3", "fish oil", "olej rybi", "kwas eikozapentaenowy", "kwas dokozaheksaenowy"], sortOrder: 24 },
    // Inne
    { slug: "ashwagandha", name: "Ashwagandha", nameEn: "Ashwagandha", category: "HERB", defaultUnit: "mg", rda: null, upperLimit: null, aliases: ["ashwagandha", "witania ospala", "withania somnifera", "ksm-66"], sortOrder: 25 },
    { slug: "creatine", name: "Kreatyna", nameEn: "Creatine", category: "OTHER", defaultUnit: "g", rda: 5, upperLimit: null, aliases: ["kreatyna", "creatine", "monohydrat kreatyny", "jablczan kreatyny", "creatine monohydrate"], sortOrder: 26 }
  ];

  try {
    db.exec('BEGIN');
    const stmt = db.prepare(`
      INSERT INTO Nutrient (id, slug, name, nameEn, category, defaultUnit, rda, upperLimit, aliases, sortOrder, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
    `);

    for (const n of nutrientsToSeed) {
      const id = 'n_' + n.slug.replace(/-/g, '_');
      stmt.run(id, n.slug, n.name, n.nameEn, n.category, n.defaultUnit, n.rda, n.upperLimit, JSON.stringify(n.aliases), n.sortOrder);
    }
    db.exec('COMMIT');
    console.log(`  [Seed] ✅ Zaseedowano ${nutrientsToSeed.length} nutrientów.`);
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('  [Seed] ❌ Błąd podczas seedowania nutrientów:', err.message);
  }

  backfillIngredients(db);
}

function normalizeStr(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[()[\],./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchNutrientStr(rawName, nutrients) {
  const target = normalizeStr(rawName);
  if (!target) return null;

  // 1) exact match
  for (const n of nutrients) {
    if (normalizeStr(n.name) === target) return n;
    for (const alias of n.aliases) {
      if (normalizeStr(alias) === target) return n;
    }
  }

  // 2) word-level
  const targetTokens = new Set(target.split(" "));
  for (const n of nutrients) {
    const candidates = [n.name, ...n.aliases];
    for (const c of candidates) {
      const cn = normalizeStr(c);
      if (!cn) continue;
      if (cn.includes(" ") && target.includes(cn)) return n;
      if (!cn.includes(" ") && targetTokens.has(cn)) return n;
    }
  }
  return null;
}

function backfillIngredients(db) {
  console.log('  → Sprawdzanie niepowiązanych składników suplementów (backfill)...');
  const unmapped = db.prepare('SELECT id, name FROM SupplementIngredient WHERE nutrientId IS NULL').all();
  if (unmapped.length === 0) {
    console.log('  ✓ Brak niepowiązanych składników.');
    return;
  }

  const nutrientsRaw = db.prepare('SELECT id, name, aliases FROM Nutrient').all();
  const nutrients = nutrientsRaw.map(n => ({
    id: n.id,
    name: n.name,
    aliases: JSON.parse(n.aliases || '[]')
  }));

  let matched = 0;
  try {
    db.exec('BEGIN');
    const updateStmt = db.prepare('UPDATE SupplementIngredient SET nutrientId = ? WHERE id = ?');
    for (const ing of unmapped) {
      const hit = matchNutrientStr(ing.name, nutrients);
      if (hit) {
        updateStmt.run(hit.id, ing.id);
        matched++;
      }
    }
    db.exec('COMMIT');
    console.log(`  [Backfill] ✅ Zmapowano ${matched}/${unmapped.length} składników.`);
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('  [Backfill] ❌ Błąd podczas backfillu składników:', err.message);
  }
}

