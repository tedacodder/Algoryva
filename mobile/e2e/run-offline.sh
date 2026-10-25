#!/usr/bin/env bash
# Offline end-to-end check. Needs: an Android phone or emulator with USB debugging, adb and Maestro installed,
# the Algoryva development build installed, and the local website running (npm run dev -- -H 0.0.0.0).
# The phone must already have the content downloaded and be signed in to a TEST account.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1. Turning airplane mode ON"
adb shell cmd connectivity airplane-mode enable
sleep 3
maestro test e2e/maestro/01-study-offline.yaml

echo "2. Turning airplane mode OFF"
adb shell cmd connectivity airplane-mode disable
echo "   Waiting for the sync to run (up to 90 seconds)..."
sleep 90
maestro test e2e/maestro/02-after-reconnect.yaml

echo "3. Check the website shows the offline changes (manual): sign in to the test account on the website and look at the topic."
