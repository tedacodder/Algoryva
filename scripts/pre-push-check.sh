#!/usr/bin/env bash
# Pre-push gate. Run it AFTER committing on your feature branch and BEFORE pushing. It refuses to pass when anything is unsafe.
# Usage: bash scripts/pre-push-check.sh [base-branch] [--skip-tests]      (base defaults to origin/main)
set -uo pipefail

BASE="origin/main"; SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    -*) ;;
    *) BASE="$arg" ;;
  esac
done

fail=0
say() { printf '[%s] %s\n' "$1" "$2"; }
bad() { say FAIL "$1"; fail=1; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not a git repository"; exit 2; }
branch="$(git rev-parse --abbrev-ref HEAD)"
case "$branch" in main|master) bad "you are on '$branch'. Push from a feature branch instead." ;; esac

# 1. Files that must never be committed.
hazards="$(git status --porcelain=v1 --untracked-files=all | awk '{print $2}' | grep -E '(^|/)(\.env($|\.)|node_modules/|\.next/|\.venv/|__pycache__/|\.pem$|\.key$|-backup-)' | grep -v '^\.env\.example$' || true)"
[ -n "$hazards" ] && bad "files that must not be committed:
$hazards"
tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '^\.env\.example$' || true)"
[ -n "$tracked_env" ] && bad "environment files are tracked by git: $tracked_env"

# 2. Unresolved merge state and conflict markers.
[ -n "$(git diff --name-only --diff-filter=U)" ] && bad "unresolved merge conflicts are in progress"
for f in $(git diff --name-only "$BASE" HEAD 2>/dev/null); do
  [ -f "$f" ] && grep -qE '^(<<<<<<< |=======$|>>>>>>> )' "$f" && bad "conflict marker left in $f"
done

# 3. Does the branch merge cleanly with the base? Uses git's in-memory merge: nothing in your working tree changes.
if git rev-parse --verify --quiet "$BASE" >/dev/null; then
  if git merge-tree --help >/dev/null 2>&1 && git merge-tree --write-tree "$BASE" HEAD >/tmp/pp-merge.$$ 2>&1; then
    say OK "merges cleanly with $BASE"
  elif grep -q 'CONFLICT' /tmp/pp-merge.$$ 2>/dev/null; then
    bad "merge conflicts with $BASE:"; grep 'CONFLICT' /tmp/pp-merge.$$ | head -20
  else
    say WARN "could not run the merge check (git 2.38 or newer is needed). Run: git merge --no-commit --no-ff $BASE, then git merge --abort"
  fi
  rm -f /tmp/pp-merge.$$
else
  say WARN "base '$BASE' not found: run git fetch origin, or pass the base branch as the first argument"
fi

# 4. Secrets in what this branch adds.
if git rev-parse --verify --quiet "$BASE" >/dev/null; then
  added="$(git diff "$BASE"...HEAD | grep '^+' | grep -v '^+++' || true)"
  if echo "$added" | grep -qE 'BOT_TOKEN=[0-9]{5,}:[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(SECRET|KEY|TOKEN|PASSWORD)=[A-Za-z0-9+/_=-]{32,}'; then
    bad "a secret-looking value is in this branch's added lines"
  else
    say OK "no secret-looking values in added lines"
  fi
fi

# 5. Tests. Placeholder secrets are used only when none are set, so nothing real is needed to test.
if [ "$SKIP_TESTS" -eq 0 ]; then
  export TELEGRAM_BOT_API_SECRET="${TELEGRAM_BOT_API_SECRET:-$(openssl rand -base64 48)}"
  export TELEGRAM_CHAT_KEY="${TELEGRAM_CHAT_KEY:-$(openssl rand -base64 32)}"
  export CRON_SECRET="${CRON_SECRET:-$(openssl rand -base64 48)}"
  export SITE_URL="${SITE_URL:-https://algoryva.example.test}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:unused@localhost:5432/unused}"
  run() {
    local name="$1"; shift
    local log; log="$(mktemp)"
    if "$@" >"$log" 2>&1; then say OK "$name"; else bad "$name"; tail -n 15 "$log"; fi
    rm -f "$log"
  }
  run "website typecheck" npm run typecheck
  run "website lint" npm run lint
  run "website unit tests" npx vitest run
  if [ -n "${TEST_DATABASE_URL:-}" ]; then
    run "website integration tests" npx vitest run --config vitest.integration.config.ts
  else
    say WARN "integration tests skipped: set TEST_DATABASE_URL to a local *_test database to run them"
  fi
  [ -d bot-js ] && run "bot-js tests" bash -c 'cd bot-js && npm test'
  [ -x bot/.venv/bin/python ] && run "bot python tests" bash -c 'cd bot && .venv/bin/python -m pytest -q'
fi

echo
git diff --stat "$BASE"...HEAD 2>/dev/null | tail -n 1
if [ "$fail" -eq 0 ]; then
  echo "READY TO PUSH: $branch"
else
  echo "NOT READY: fix the FAIL lines above, commit the fix, and run this check again."
  exit 1
fi
