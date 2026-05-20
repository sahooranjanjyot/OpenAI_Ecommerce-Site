#!/bin/sh
# GroceryOS Database Backup Script (G-021)
# Runs hourly incremental + daily full backups
# Retains: 24 hourly, 7 daily, 4 weekly backups

BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)
HOUR=$(date +%H)
DAY=$(date +%u)   # 1=Monday ... 7=Sunday

mkdir -p "$BACKUP_DIR/hourly" "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# ── Hourly incremental backup ─────────────────────────────────────────────────
pg_dump \
  -h postgres -U groceryos -d groceryos \
  --format=custom \
  --compress=9 \
  -f "$BACKUP_DIR/hourly/backup_${DATE}.dump"

echo "[$(date)] Hourly backup created: backup_${DATE}.dump"

# ── Keep only last 24 hourly backups ──────────────────────────────────────────
ls -t "$BACKUP_DIR/hourly/"*.dump 2>/dev/null | tail -n +25 | xargs rm -f

# ── Daily full backup at midnight (HOUR == 00) ────────────────────────────────
if [ "$HOUR" = "00" ]; then
  cp "$BACKUP_DIR/hourly/backup_${DATE}.dump" "$BACKUP_DIR/daily/daily_${DATE}.dump"
  ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | tail -n +8 | xargs rm -f
  echo "[$(date)] Daily backup created: daily_${DATE}.dump"
fi

# ── Weekly backup on Sunday midnight ─────────────────────────────────────────
if [ "$HOUR" = "00" ] && [ "$DAY" = "7" ]; then
  cp "$BACKUP_DIR/hourly/backup_${DATE}.dump" "$BACKUP_DIR/weekly/weekly_${DATE}.dump"
  ls -t "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | tail -n +5 | xargs rm -f
  echo "[$(date)] Weekly backup created: weekly_${DATE}.dump"
fi

# ── Verify backup integrity ────────────────────────────────────────────────────
pg_restore --list "$BACKUP_DIR/hourly/backup_${DATE}.dump" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup integrity: OK"
else
  echo "[$(date)] WARNING: Backup verification FAILED!" >&2
fi

# ── Loop: run every hour ──────────────────────────────────────────────────────
sleep 3600
exec "$0"
