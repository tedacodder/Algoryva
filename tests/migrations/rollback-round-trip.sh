#!/usr/bin/env bash
# Proves the three new migrations and their rollbacks leave the schema exactly as it was. Uses disposable *_test databases only.
set -euo pipefail
BASE="${TEST_DB_HOST:-postgresql://postgres:scratchpw@localhost:5432}"
DB="algoryva_rollback_test"
case "$BASE" in *localhost*|*127.0.0.1*) ;; *) echo "refusing: test host must be localhost"; exit 1 ;; esac
psql "$BASE/postgres" -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
URL="$BASE/$DB"
NEW="20261025120000_telegram_link 20261026090000_solve_verification 20261026100000_bot_features 20261026110000_community_growth 20261026120000_bot_rewards 20261026130000_clubs"
for d in $(ls -d prisma/migrations/*/ | sort); do n=$(basename "$d"); case " $NEW " in *" $n "*) continue ;; esac; psql "$URL" -v ON_ERROR_STOP=1 -q -f "$d/migration.sql"; done
# pg_dump writes a random \restrict token per dump; it is not schema, so it is removed before comparing.
pg_dump --schema-only --no-owner "$URL" | grep -vE '^\\(un)?restrict ' > /tmp/schema-before.sql
for m in $NEW; do psql "$URL" -v ON_ERROR_STOP=1 -q -f "prisma/migrations/$m/migration.sql"; done
for m in $(echo $NEW | tr ' ' '\n' | tac); do psql "$URL" -v ON_ERROR_STOP=1 -q -f "ops/rollback/$m.down.sql"; done
pg_dump --schema-only --no-owner "$URL" | grep -vE '^\\(un)?restrict ' > /tmp/schema-after.sql
if diff -u /tmp/schema-before.sql /tmp/schema-after.sql > /tmp/schema.diff; then echo "round trip: schema identical"; else echo "round trip: DIFFERENCES"; cat /tmp/schema.diff; exit 1; fi
