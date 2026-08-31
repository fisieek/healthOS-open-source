#!/usr/bin/env node
/**
 * Reset password for a user in Electron's local DB.
 * Usage: node scripts/reset-electron-password.js <email> <new-password>
 */

const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/reset-electron-password.js <email> <password>');
  process.exit(1);
}

const dbPath = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'healthOS',
  'healthos.db'
);

console.log(`DB: ${dbPath}`);
console.log(`Email: ${email}`);

const db = new Database(dbPath);
const hash = bcrypt.hashSync(password, 10);

const result = db
  .prepare('UPDATE User SET passwordHash = ?, updatedAt = current_timestamp WHERE email = ?')
  .run(hash, email);

if (result.changes === 0) {
  console.error(`❌ No user found with email: ${email}`);
  process.exit(1);
}

console.log(`✅ Password reset for ${email}`);
db.close();
