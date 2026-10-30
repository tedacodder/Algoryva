#!/usr/bin/env bash
# READ-ONLY. Compares the checksum Prisma recorded for each applied migration with the checksum of the file in this repository.
# A mismatch means a migration file was edited after it ran, which must be resolved before any deploy. Prisma's own check is
# `npx prisma migrate status`, which also needs a connection; run both.
set -euo pipefail
: "${PRODUCTION_READONLY_URL:?set PRODUCTION_READONLY_URL to a read-only connection string}"
psql "$PRODUCTION_READONLY_URL" -At -F '|' -v ON_ERROR_STOP=1 \
  -c "BEGIN READ ONLY; SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name; COMMIT;" \
  | grep -v '^BEGIN$\|^COMMIT$' > /tmp/recorded-checksums.txt
status=0
while IFS='|' read -r name recorded; do
  file="prisma/migrations/${name}/migration.sql"
  if [ ! -f "$file" ]; then echo "MISSING FILE  $name"; status=1; continue; fi
  local_sum=$(sha256sum "$file" | cut -d' ' -f1)
  if [ "$local_sum" = "$recorded" ]; then echo "ok            $name"; else echo "MISMATCH      $name (recorded $recorded, file $local_sum)"; status=1; fi
done < /tmp/recorded-checksums.txt
exit $status
