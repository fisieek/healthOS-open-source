#!/bin/bash
#
# Przywrócenie bazy healthOS (SQLite) z kopii zapasowej.
#
# Używa `sqlite3 .restore`, czyli odwrotności `.backup` z db-backup.sh —
# w przeciwieństwie do `cp` radzi sobie z plikami -wal/-shm i nie zostawia
# bazy w niespójnym stanie, gdy aplikacja akurat działa.
#
# Użycie:
#   ./scripts/db-restore.sh [plik-kopii.db] [--to dev|desktop|<ścieżka>] [-y]
#
# Bez pliku bierze najnowszą kopię z backups/.
# Bez --to przywraca do bazy z DATABASE_URL (czyli zwykle prisma/dev.db).
#
# ⚠️  Przed nadpisaniem ZAWSZE robi kopię obecnego stanu do backups/,
#     więc nawet pomyłka jest odwracalna.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DESKTOP_DB="$HOME/Library/Application Support/healthOS/healthos.db"

SRC=""
TO=""
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes)  ASSUME_YES=1; shift ;;
    --to)      TO="${2:-}"; shift 2 ;;
    --to=*)    TO="${1#--to=}"; shift ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)         SRC="$1"; shift ;;
  esac
done

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ Brak polecenia sqlite3."
  exit 1
fi

# ── Baza docelowa ─────────────────────────────────────────────────────────────
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

case "$TO" in
  "")       TARGET_DB="$(resolve_from_env)" ;;
  dev)      TARGET_DB="prisma/dev.db" ;;
  desktop)  TARGET_DB="$DESKTOP_DB" ;;
  *)        TARGET_DB="$TO" ;;
esac

PREFIX="dev"
[ "$TARGET_DB" = "$DESKTOP_DB" ] && PREFIX="healthOS-PROD"

# ── Plik kopii ────────────────────────────────────────────────────────────────
if [ -z "$SRC" ]; then
  SRC="$(ls -t backups/*.db 2>/dev/null | head -n1 || true)"
  if [ -z "$SRC" ]; then
    echo "❌ Brak kopii w backups/. Wskaż plik: ./scripts/db-restore.sh <plik.db>"
    exit 1
  fi
  echo "Nie wskazano pliku — biorę najnowszą kopię:"
  echo "👉 $SRC"
fi

if [ ! -f "$SRC" ]; then
  echo "❌ Plik '$SRC' nie istnieje."
  exit 1
fi

# ── Kopia musi być prawdziwą, czytelną bazą SQLite ────────────────────────────
if [ "$(head -c 15 "$SRC" 2>/dev/null)" != "SQLite format 3" ]; then
  echo "❌ '$SRC' nie jest bazą SQLite (stare kopie .sql z czasów PostgreSQL nie pasują)."
  exit 1
fi

INTEGRITY="$(sqlite3 "$SRC" "PRAGMA integrity_check;" 2>&1 | head -n1)"
if [ "$INTEGRITY" != "ok" ]; then
  echo "❌ Kopia nie przechodzi kontroli spójności: $INTEGRITY"
  exit 1
fi

SRC_USERS="$(sqlite3 "$SRC" "SELECT count(*) FROM User;" 2>/dev/null || echo "?")"

# ── Podsumowanie przed nadpisaniem ────────────────────────────────────────────
echo ""
echo "=== Przywracanie bazy healthOS ==="
echo "Z kopii:    $SRC"
echo "            $(du -h "$SRC" | cut -f1), kont w bazie: $SRC_USERS, integrity_check: ok"
if [ -f "$TARGET_DB" ]; then
  CUR_USERS="$(sqlite3 "$TARGET_DB" "SELECT count(*) FROM User;" 2>/dev/null || echo "?")"
  echo "Do bazy:    $TARGET_DB"
  echo "            $(du -h "$TARGET_DB" | cut -f1), kont w bazie: $CUR_USERS  ← ZOSTANIE NADPISANA"
else
  echo "Do bazy:    $TARGET_DB (nie istnieje — zostanie utworzona)"
fi
echo ""

# ── Kopia bezpieczeństwa obecnego stanu ───────────────────────────────────────
SAFETY=""
if [ -f "$TARGET_DB" ]; then
  mkdir -p backups
  SAFETY="backups/${PREFIX}-preRestore-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$TARGET_DB" ".backup '$SAFETY'"
  echo "🛟 Obecny stan zapisany na wszelki wypadek: $SAFETY ($(du -h "$SAFETY" | cut -f1))"
  echo "   Cofnięcie: ./scripts/db-restore.sh $SAFETY --to $TARGET_DB"
  echo ""
fi

# ── Potwierdzenie ─────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" != "1" ]; then
  echo "⚠️  Przywrócenie CAŁKOWICIE nadpisze bazę $TARGET_DB."
  read -r -p "Kontynuować? (wpisz 'tak'): " CONFIRM
  if [ "$CONFIRM" != "tak" ]; then
    echo "❌ Anulowane. Nic nie zmieniono."
    [ -n "$SAFETY" ] && echo "   (kopia bezpieczeństwa $SAFETY zostaje — możesz ją usunąć)"
    exit 0
  fi
fi

# ── Przywrócenie ──────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$TARGET_DB")"
sqlite3 "$TARGET_DB" ".restore '$SRC'"

AFTER="$(sqlite3 "$TARGET_DB" "PRAGMA integrity_check;" 2>&1 | head -n1)"
if [ "$AFTER" != "ok" ]; then
  echo "❌ Baza po przywróceniu nie przechodzi kontroli spójności: $AFTER"
  [ -n "$SAFETY" ] && echo "👉 Cofnij: ./scripts/db-restore.sh $SAFETY --to $TARGET_DB -y"
  exit 1
fi

echo "✅ Przywrócono $TARGET_DB z $SRC (kont w bazie: $(sqlite3 "$TARGET_DB" "SELECT count(*) FROM User;" 2>/dev/null || echo "?"))"
echo "   Jeśli aplikacja działała w trakcie — zrestartuj ją."
