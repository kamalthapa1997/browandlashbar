#!/usr/bin/env bash
# Run only from a clean, committed control checkout during an authorized
# production release. This script is intentionally not invoked by CI/tests.
set -Eeuo pipefail

RELEASE_ROOT="${RELEASE_ROOT:-/home/handsomelotus1/apps/merobrowandlashbar}"
SHARED_ENV_FILE="${SHARED_ENV_FILE:-$RELEASE_ROOT/shared/.env}"
SERVICE_NAME="${SERVICE_NAME:-merobrowandlashbar.service}"
MIN_FREE_KB="${MIN_FREE_KB:-2097152}" # 2 GiB; no automatic deletion occurs.
RELEASE_SHA="${1:-}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"

fail() { printf 'Deployment failed: %s\n' "$*" >&2; exit 1; }
note() { printf '==> %s\n' "$*"; }

[[ -n "$RELEASE_SHA" ]] || fail "usage: $0 <committed-release-sha>"
[[ "$PUBLIC_ORIGIN" =~ ^https:// ]] || fail "PUBLIC_ORIGIN must be the approved HTTPS origin"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "run from a Git checkout"
[[ -z "$(git status --porcelain)" ]] || fail "refusing a dirty Git tree"
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "release SHA must be a full 40-character commit SHA"
git cat-file -e "$RELEASE_SHA^{commit}" 2>/dev/null || fail "release SHA is not a commit"
[[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] || fail "release SHA must equal clean HEAD"
[[ "$(git branch --show-current)" != "main" ]] || fail "refusing to deploy main without an approved release branch"
[[ -f package-lock.json ]] || fail "package-lock.json is required"
[[ -f "$SHARED_ENV_FILE" ]] || fail "shared production environment file is missing"
[[ "$(node -p 'process.versions.node.split(".")[0]')" == "22" ]] || fail "Node 22 is required"
[[ "$(df -Pk "$RELEASE_ROOT" | awk 'NR==2 {print $4}')" -ge "$MIN_FREE_KB" ]] || fail "free disk space is below ${MIN_FREE_KB} KiB"

releases_dir="$RELEASE_ROOT/releases"
release_dir="$releases_dir/$RELEASE_SHA"
previous_target=""
[[ -L "$RELEASE_ROOT/current" ]] && previous_target="$(readlink "$RELEASE_ROOT/current")"
[[ -n "$previous_target" ]] || fail "a known-good current release symlink is required before activation"
[[ ! -e "$release_dir" ]] || fail "release directory already exists: $release_dir"
activated=0

rollback() {
  if [[ "$activated" == "1" && -n "$previous_target" ]]; then
    note "activation failed; restoring $previous_target"
    ln -sfn "$previous_target" "$RELEASE_ROOT/current.next"
    mv -Tf "$RELEASE_ROOT/current.next" "$RELEASE_ROOT/current"
    systemctl restart "$SERVICE_NAME"
  fi
}
trap rollback ERR

note "creating immutable release $RELEASE_SHA"
mkdir -p "$releases_dir" "$RELEASE_ROOT/shared"
mkdir "$release_dir"
git archive --format=tar "$RELEASE_SHA" | tar -x -C "$release_dir"

cd "$release_dir"
npm ci
npm run build
[[ -f build/index.html ]] || fail "frontend build output is missing"
if find build/static -type f -name "*.map" -print -quit | grep -q .; then
  fail "production source maps were generated"
fi
NODE_ENV=production DOTENV_CONFIG_PATH="$SHARED_ENV_FILE" \
  node -r dotenv/config -e 'require("./server/src/config/environment").validateEnvironment()'
node --check server/index.js
printf '{"sha":"%s"}\n' "$RELEASE_SHA" > build/release.json

note "validating nginx before activation"
sudo nginx -t
sudo nginx -T 2>&1 | grep -Fq "root $RELEASE_ROOT/current/build;" \
  || fail "active nginx configuration does not serve the current release"
systemctl cat "$SERVICE_NAME" | grep -Fq "$RELEASE_ROOT/current/server/index.js" \
  || fail "active systemd service does not run the current release"
ln -s "releases/$RELEASE_SHA" "$RELEASE_ROOT/current.next"
mv -Tf "$RELEASE_ROOT/current.next" "$RELEASE_ROOT/current"
activated=1

note "activating backend from current release"
sudo systemctl restart "$SERVICE_NAME"
curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/release.json" >/dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/gallery" >/dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/booking" >/dev/null
grep -Fq "$RELEASE_SHA" build/release.json || fail "release marker does not match active SHA"
trap - ERR
note "release $RELEASE_SHA is active"
