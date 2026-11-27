#!/usr/bin/env bash
# Beide Harnesses gegen dasselbe Repo laufen lassen.
#
#   bash tests/run-all.sh [repo]
#
# Exit 0 nur, wenn beide Harnesses alle Pruefungen bestehen.

set -uo pipefail

HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO=${1:-$(cd -- "$HERE/.." && pwd)}

status=0

bash "$HERE/scripts/run.sh" "$REPO" || status=1

RUNNER=''
if command -v bun >/dev/null 2>&1; then
    RUNNER=$(command -v bun)
elif [ -n "${FREEBUFF_BUN:-}" ] && [ -x "${FREEBUFF_BUN}" ]; then
    RUNNER="$FREEBUFF_BUN"
elif node -e 'process.exit(0)' >/dev/null 2>&1; then
    RUNNER=node
fi

if [ -z "$RUNNER" ]; then
    printf '\nKein JavaScript-Runner gefunden: bun (oder node) installieren.\n' >&2
    exit 1
fi

printf '\n== Extension-Lifecycle ==\n'
"$RUNNER" "$HERE/extension/lifecycle.mjs" "$REPO" || status=1

exit "$status"
