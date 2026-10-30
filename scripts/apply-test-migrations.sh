#!/usr/bin/env bash
# Applies every migration, in order, to a DISPOSABLE test database. Refuses anything that is not a localhost database named *_test.
set -euo pipefail
URL="${TEST_DATABASE_URL:?set TEST_DATABASE_URL to a localhost *_test database}"
python3 - "$URL" <<'PY'
import sys
from urllib.parse import urlsplit
u = urlsplit(sys.argv[1]); db = u.path.lstrip("/")
if u.hostname not in ("localhost", "127.0.0.1") or not db.endswith("_test"):
    sys.exit("refusing: TEST_DATABASE_URL must point at localhost and a database whose name ends in _test")
PY
for dir in $(ls -d prisma/migrations/*/ | sort); do
  echo "applying $(basename "$dir")"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$dir/migration.sql"
done
