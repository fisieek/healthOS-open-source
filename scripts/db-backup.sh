#!/bin/bash
#
# Kopia zapasowa bazy healthOS (SQLite).
#
# Używa `sqlite3 .backup` zamiast `cp`, bo to jedyny sposób, który daje spójny
# plik także wtedy, gdy aplikacja jest uruchomiona i akurat coś zapisuje.
#
# Użycie:
#   ./scripts/db-backup.sh [dev|desktop|<ścieżka do .db>] [etykieta]
#
# Bez argumentów bierze bazę z DATABASE_URL (a gdy jej nie ma — prisma/dev.db).
# Etykieta trafia do nazwy pliku, np. "preEtapB".
#
#   ./scripts/db-backup.sh                     → backups/dev-20260830-214500.db
#   ./scripts/db-backup.sh dev preEtapB        → backups/dev-preEtapB-20260830-214500.db
#   ./scripts/db-backup.sh desktop preEtapB    → backups/healthOS-PROD-preEtapB-...db

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DESKTOP_DB="$HOME/Library/Application Support/healthOS/healthos.db"

# ── Wybór bazy ────────────────────────────────────────────────────────────────
TARGET="${1:-}"
LABEL="${2:-}"

resolve_from_env() {
  local url=""
  for f in .env.local .env; do
    [ -f "$f" ] || continue
    url=$(grep -E '^ *DATABASE_URL=' "$f" | tail -n1 | cut -d= -f2- | tr -d '"'"'" || true)
    [ -n "$url" ] && break
  done
  url="${url#file:}"
  [ -z "$url" ] && url="prisma/dev.db"
  echo "$url"
}

case "$TARGET" in
  ""|dev)   DB_PATH=$( [ -z "$TARGET" ] && resolve_from_env || echo "prisma/dev.db" ); PREFIX="dev" ;;
  desktop)  DB_PATH="$DESKTOP_DB"; PREFIX="healthOS-PROD" ;;
  *)        DB_PATH="$TARGET";     PREFIX="$(basename "$DB_PATH" .db)" ;;
esac

# Gdy domyślna ścieżka z DATABASE_URL wskazuje jednak na bazę desktopową
[ "$DB_PATH" = "$DESKTOP_DB" ] && PREFIX="healthOS-PROD"

echo "=== Kopia zapasowa bazy healthOS ==="

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ Brak polecenia sqlite3. Na macOS jest w systemie; w razie czego: brew install sqlite"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Nie znaleziono bazy: $DB_PATH"
  echo "👉 Wskaż ją wprost: ./scripts/db-backup.sh <ścieżka do .db>"
  exit 1
fi

# ── Nazwa pliku (konwencja z katalogu backups/) ───────────────────────────────
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -n "$LABEL" ]; then
  BACKUP_FILE="backups/${PREFIX}-${LABEL}-${STAMP}.db"
else
  BACKUP_FILE="backups/${PREFIX}-${STAMP}.db"
fi

echo "Źródło:     $DB_PATH ($(du -h "$DB_PATH" | cut -f1))"
echo "Docelowy:   $BACKUP_FILE"

# ── Kopia ─────────────────────────────────────────────────────────────────────
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Powstały plik jest pusty — kopia nieudana."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ── Sprawdzenie, że kopia jest czytelna ───────────────────────────────────────
INTEGRITY="$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1 | head -n1)"
if [ "$INTEGRITY" != "ok" ]; then
  echo "❌ Kopia nie przechodzi kontroli spójności: $INTEGRITY"
  echo "   Plik zostawiam do obejrzenia: $BACKUP_FILE"
  exit 1
fi

TABLES="$(sqlite3 "$BACKUP_FILE" "SELECT count(*) FROM sqlite_master WHERE type='table';")"

echo "✅ Gotowe. Rozmiar: $(du -h "$BACKUP_FILE" | cut -f1), tabel: $TABLES, integrity_check: ok"
