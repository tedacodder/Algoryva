#!/usr/bin/env bash
# Recreates a disposable database at the schema state before the verification migration, then runs the backfill assertions.
set -euo pipefail
BASE="${TEST_DB_HOST:-postgresql://postgres:scratchpw@localhost:5432}"
DB="algoryva_backfill_test"
case "$BASE" in *localhost*|*127.0.0.1*) ;; *) echo "refusing: test host must be localhost"; exit 1 ;; esac
psql "$BASE/postgres" -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
URL="$BASE/$DB"
for d in $(ls -d prisma/migrations/*/ | sort | grep -v -e 20261025120000 -e 20261026090000 -e 20261026100000); do
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$d/migration.sql"
done
psql "$URL" -v ON_ERROR_STOP=1 -f tests/migrations/backfill-solve-verification.sql
