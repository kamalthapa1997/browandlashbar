#!/usr/bin/env bash
# Run only during an authorized recovery. It never rebuilds or deletes a release.
set -Eeuo pipefail

RELEASE_ROOT="${RELEASE_ROOT:-/home/handsomelotus1/apps/merobrowandlashbar}"
SERVICE_NAME="${SERVICE_NAME:-merobrowandlashbar.service}"
TARGET_SHA="${1:-}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"

[[ -n "$TARGET_SHA" ]] || { echo "usage: $0 <known-good-release-sha>" >&2; exit 1; }
[[ "$PUBLIC_ORIGIN" =~ ^https:// ]] || { echo "PUBLIC_ORIGIN must be the approved HTTPS origin" >&2; exit 1; }
[[ -d "$RELEASE_ROOT/releases/$TARGET_SHA" ]] || { echo "known-good release is missing" >&2; exit 1; }
[[ -f "$RELEASE_ROOT/releases/$TARGET_SHA/build/release.json" ]] || { echo "release marker is missing" >&2; exit 1; }

ln -s "releases/$TARGET_SHA" "$RELEASE_ROOT/current.next"
mv -Tf "$RELEASE_ROOT/current.next" "$RELEASE_ROOT/current"
sudo systemctl restart "$SERVICE_NAME"
curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/release.json" | grep -Fq "$TARGET_SHA"
echo "rollback active: $TARGET_SHA"
