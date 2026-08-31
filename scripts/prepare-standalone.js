#!/usr/bin/env node
/**
 * Post-build helper: prepares .next/standalone for Electron packaging.
 *
 * Next.js standalone output doesn't auto-bundle:
 * - .next/static (static assets)
 * - dynamically-imported packages like @prisma/adapter-better-sqlite3
 *
 * This script copies them into the standalone directory so that
 * `node .next/standalone/server.js` works as a self-contained app.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const standalone = path.join(projectRoot, '.next', 'standalone');

if (!fs.existsSync(standalone)) {
  console.error('❌ .next/standalone not found. Run `npm run build` first.');
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Source missing: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('📦 Przygotowywanie .next/standalone...');

// 1. Static files
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standalone, '.next', 'static');
console.log('  → kopiowanie .next/static');
copyDir(staticSrc, staticDest);

// 1b. public/ (already in standalone, but copy in case)
const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standalone, 'public');
if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
  console.log('  → kopiowanie public');
  copyDir(publicSrc, publicDest);
}

// 2. Prisma adapters (dynamic imports, not auto-bundled)
const prismaPackages = [
  '@prisma/adapter-better-sqlite3',
  '@prisma/driver-adapter-utils',
];
for (const pkg of prismaPackages) {
  const src = path.join(projectRoot, 'node_modules', pkg);
  const dest = path.join(standalone, 'node_modules', pkg);
  console.log(`  → kopiowanie ${pkg}`);
  copyDir(src, dest);
}

// 3. Resolve symlinks in standalone — electron-builder/codesign can't follow them
// across asar boundaries, so we materialize them as real directories.
function resolveSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const target = fs.realpathSync(p);
        const stat = fs.statSync(target);
        fs.unlinkSync(p);
        if (stat.isDirectory()) {
          copyDir(target, p);
        } else {
          fs.copyFileSync(target, p);
        }
        console.log(`  ↪ rozwinięto symlink: ${path.relative(standalone, p)}`);
      } catch (err) {
        console.warn(`  ⚠️ nie udało się rozwinąć ${p}:`, err.message);
      }
    } else if (entry.isDirectory()) {
      resolveSymlinks(p);
    }
  }
}
console.log('  → rozwijanie symlinków...');
resolveSymlinks(standalone);

// 4. Rebuild better-sqlite3 for Electron ABI (so spawned standalone server,
// running under ELECTRON_RUN_AS_NODE, can load it).

// 4. Build better-sqlite3 for Electron ABI in main node_modules,
// then copy the binary into standalone.
//
// Why this approach: electron-rebuild requires a proper package.json with
// dependencies declared. Next.js standalone produces a minimal package.json
// that confuses electron-rebuild. So we build in the main project (which
// works reliably), then copy the resulting .node file into standalone.

console.log('  → rebuild better-sqlite3 dla Electron ABI (main node_modules)...');
const { execSync } = require('child_process');
const electronVersion = require(path.join(projectRoot, 'node_modules/electron/package.json')).version;
console.log(`     (Electron ${electronVersion})`);

const electronRebuild = path.join(projectRoot, 'node_modules', '.bin', 'electron-rebuild');
try {
  execSync(
    `"${electronRebuild}" --version ${electronVersion} --only better-sqlite3 --force`,
    { cwd: projectRoot, stdio: 'inherit' }
  );
  console.log('  ✅ better-sqlite3 zrebuildowany dla Electrona');
} catch (err) {
  console.error('  ⚠️ rebuild się nie udał:', err.message);
  process.exit(1);
}

// 4b. Copy the freshly-built binary into standalone's better-sqlite3.
// Standalone has its own copy without binding.gyp etc., so we don't
// rebuild there — just replace the .node file.
console.log('  → kopiowanie binary better-sqlite3 do standalone...');
const sourceBsq = path.join(projectRoot, 'node_modules', 'better-sqlite3');
const standaloneBsq = path.join(standalone, 'node_modules', 'better-sqlite3');
if (fs.existsSync(standaloneBsq)) {
  // Remove standalone's old build dir, replace with our Electron-built one
  const oldBuild = path.join(standaloneBsq, 'build');
  if (fs.existsSync(oldBuild)) {
    fs.rmSync(oldBuild, { recursive: true, force: true });
  }
  copyDir(path.join(sourceBsq, 'build'), oldBuild);
  console.log('  ✅ skopiowano build/ do standalone');
}

// 4c. Webpack bundles reference better-sqlite3 via hashed name in
// .next/standalone/.next/node_modules/. Copy the binary there too.
const innerNodeModules = path.join(standalone, '.next', 'node_modules');
if (fs.existsSync(innerNodeModules)) {
  for (const name of fs.readdirSync(innerNodeModules)) {
    if (name.startsWith('better-sqlite3')) {
      const target = path.join(innerNodeModules, name);
      if (fs.statSync(target).isDirectory()) {
        console.log(`  → kopiowanie binary do hashed copy: ${name}`);
        const buildDest = path.join(target, 'build');
        if (fs.existsSync(buildDest)) {
          fs.rmSync(buildDest, { recursive: true, force: true });
        }
        copyDir(path.join(sourceBsq, 'build'), buildDest);
      }
    }
  }
}

// 6. Clean extended attributes (xattr) — codesign hates them
console.log('  → czyszczenie xattr...');
try {
  execSync(`xattr -cr "${standalone}"`, { stdio: 'inherit' });
} catch (err) {
  console.warn('  ⚠️ xattr cleanup się nie udał:', err.message);
}

console.log('✅ Standalone gotowe.');
