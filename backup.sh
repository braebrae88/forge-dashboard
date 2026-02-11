#!/bin/bash
# FORGE Dashboard Backup Script
# Runs daily to protect critical business data

BACKUP_DIR="/Users/admin/.openclaw/workspace/forge-dashboard/backups"
DB_FILE="/Users/admin/.openclaw/workspace/forge-dashboard/forge.db"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
KEEP_DAYS=30

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Use SQLite backup command to create a clean, consolidated backup
# This properly handles WAL mode and creates a self-contained backup file
sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/forge_${TIMESTAMP}.db'"

# Also keep a "latest" copy for quick recovery
sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/forge_latest.db'"

# Export to JSON for human-readable backup (and easy recovery)
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/tasks_${TIMESTAMP}.json" "SELECT * FROM tasks;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/pipeline_${TIMESTAMP}.json" "SELECT * FROM sales_pipeline;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/cio_targets_${TIMESTAMP}.json" "SELECT * FROM cio_targets;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/notes_${TIMESTAMP}.json" "SELECT * FROM notes;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/leads_${TIMESTAMP}.json" "SELECT * FROM leads;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/actions_${TIMESTAMP}.json" "SELECT * FROM actions;"
sqlite3 "$DB_FILE" ".mode json" ".output $BACKUP_DIR/activity_${TIMESTAMP}.json" "SELECT * FROM activity_log;"

# Keep latest JSON copies too
cp "$BACKUP_DIR/tasks_${TIMESTAMP}.json" "$BACKUP_DIR/tasks_latest.json"
cp "$BACKUP_DIR/pipeline_${TIMESTAMP}.json" "$BACKUP_DIR/pipeline_latest.json"
cp "$BACKUP_DIR/cio_targets_${TIMESTAMP}.json" "$BACKUP_DIR/cio_targets_latest.json"
cp "$BACKUP_DIR/notes_${TIMESTAMP}.json" "$BACKUP_DIR/notes_latest.json"
cp "$BACKUP_DIR/leads_${TIMESTAMP}.json" "$BACKUP_DIR/leads_latest.json"

# Clean up backups older than 30 days (keep latest copies forever)
find "$BACKUP_DIR" -name "forge_2*.db" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "*_2*.json" -mtime +$KEEP_DAYS -delete

echo "Backup completed: $TIMESTAMP"
echo "Database size: $(du -h $BACKUP_DIR/forge_${TIMESTAMP}.db | cut -f1)"
echo "Total backup size: $(du -sh $BACKUP_DIR | cut -f1)"
