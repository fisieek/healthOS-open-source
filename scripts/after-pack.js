/**
 * electron-builder afterPack hook.
 * Removes macOS extended attributes (xattr) that are added during unzip
 * and break codesign (`resource fork, Finder information, or similar detritus
 * not allowed`).
 */

const { execSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = context.appOutDir;
  console.log(`  → afterPack: czyszczenie xattr w ${appPath}`);
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`  ⚠️ xattr cleanup failed:`, err.message);
  }
};
