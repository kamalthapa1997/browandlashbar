# Immutable release deployment

This is an authorized-production-runbook artifact; Phase 7 did not run it.

The control checkout must be clean, committed, on an approved non-`main`
release branch, and checked out at the exact SHA being deployed. Run:

```bash
PUBLIC_ORIGIN=https://merobrowandlashbar.com \
  bash infrastructure/deploy/deploy-release.sh <full-commit-sha>
```

The script refuses an uncommitted tree, a SHA other than `HEAD`, Node outside
major 22, a missing lockfile/shared environment, less than 2 GiB free disk, a
failed `npm ci`/build/config check/nginx check, or a failed health check.

It archives the committed SHA into `releases/<sha>`, builds there, writes a
release marker, atomically switches `current`, restarts the service, and checks
the API plus frontend routes. A failed activation restores the prior `current`
symlink and restarts the previous backend. Releases are retained. Before the
first use, migrate the known-good live release into this layout and create its
`current` symlink; the script refuses activation without rollback coverage.

Rollback never rebuilds or deletes data:

```bash
PUBLIC_ORIGIN=https://merobrowandlashbar.com \
  bash infrastructure/deploy/rollback-release.sh <known-good-full-commit-sha>
```

Before first use, an authorized infrastructure operator must install the
repository systemd/nginx templates, replace only documented placeholders, and
validate nginx. The nginx root and systemd working directory must both point to
`/home/handsomelotus1/apps/merobrowandlashbar/current`.
