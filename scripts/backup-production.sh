#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${LNKDIT_BACKUP_DATABASE_URL:?Configure the dedicated backup database connection secret}"
: "${LNKDIT_BACKUP_KEY:?Configure the backup encryption key secret}"
: "${SUPABASE_BACKUP_SERVICE_ROLE_KEY:?Configure the private storage backup secret}"
: "${NEXT_PUBLIC_SUPABASE_URL:?Configure the Supabase project URL}"
OUTPUT_DIR="${1:?Provide a destination directory}"
mkdir -p "$OUTPUT_DIR"
BACKUP_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$BACKUP_TEMP_DIR"' EXIT
export PGDATABASE="$LNKDIT_BACKUP_DATABASE_URL"
docker run --rm --user "$(id -u):$(id -g)" --env PGDATABASE --volume "$BACKUP_TEMP_DIR:/backup" postgres:17 pg_dump --format=custom --no-owner --no-acl --schema=public --schema=auth --schema=storage --schema=lnkdit_private --file=/backup/database.dump
node scripts/backup-storage.cjs "$BACKUP_TEMP_DIR/assets"
node - "$BACKUP_TEMP_DIR" <<'NODE'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2];const db=fs.readFileSync(path.join(root,'database.dump'));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({format:1,project:'yeplwaainflckcrjsauw',createdAt:new Date().toISOString(),databaseSha256:crypto.createHash('sha256').update(db).digest('hex')}),{mode:0o600});
NODE
tar -czf "$BACKUP_TEMP_DIR/archive.tgz" -C "$BACKUP_TEMP_DIR" database.dump assets manifest.json
BACKUP_NAME="lnkdit-$(date -u +%Y%m%dT%H%M%SZ).tgz.enc"
node scripts/backup-crypto.cjs encrypt "$BACKUP_TEMP_DIR/archive.tgz" "$OUTPUT_DIR/$BACKUP_NAME"
node scripts/backup-crypto.cjs decrypt "$OUTPUT_DIR/$BACKUP_NAME" "$BACKUP_TEMP_DIR/verification.tgz"
cmp "$BACKUP_TEMP_DIR/archive.tgz" "$BACKUP_TEMP_DIR/verification.tgz"
sha256sum "$OUTPUT_DIR/$BACKUP_NAME" > "$OUTPUT_DIR/$BACKUP_NAME.sha256"
echo "Encrypted database and asset backup created and decryption verified."
