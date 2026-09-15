const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "../../..");
const packageJson = require(path.join(root, "package.json"));
const nginx = fs.readFileSync(
  path.join(root, "infrastructure/nginx/merobrowandlashbar-site.conf.template"),
  "utf8",
);
const deploy = fs.readFileSync(
  path.join(root, "infrastructure/deploy/deploy-release.sh"),
  "utf8",
);
const rollback = fs.readFileSync(
  path.join(root, "infrastructure/deploy/rollback-release.sh"),
  "utf8",
);
const systemd = fs.readFileSync(
  path.join(root, "infrastructure/systemd/merobrowandlashbar.service.template"),
  "utf8",
);
const productionEnv = fs.readFileSync(path.join(root, ".env.production.example"), "utf8");

test("production build disables source maps and declares Node 22", () => {
  assert.equal(packageJson.engines.node, ">=22 <23");
  assert.match(packageJson.scripts.build, /^GENERATE_SOURCEMAP=false /);
  assert.equal(packageJson.scripts.deploy, "bash infrastructure/deploy/deploy-release.sh");
});

test("nginx template serves the active release and keeps API/static paths out of SPA fallback", () => {
  assert.match(nginx, /root .*\/current\/build;/);
  assert.match(nginx, /location = \/api \{/);
  assert.match(nginx, /location = \/api\/ \{/);
  assert.match(nginx, /location \^~ \/api\/ \{/);
  assert.match(nginx, /location ~\* \\.map\$ \{[\s\S]*return 404;/);
  assert.match(nginx, /location ~\* \^\/static\/ \{[\s\S]*try_files \$uri =404;/);
  assert.match(nginx, /Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(nginx, /location = \/index\.html \{[\s\S]*Cache-Control "no-cache"/);
  assert.match(nginx, /server_tokens off;/);
});

test("deployment model is SHA-only, immutable, preflighted, and rollback-capable", () => {
  assert.match(deploy, /refusing a dirty Git tree/);
  assert.match(deploy, /full 40-character commit SHA/);
  assert.match(deploy, /git archive --format=tar/);
  assert.match(deploy, /npm ci/);
  assert.match(deploy, /MIN_FREE_KB.*2097152/);
  assert.match(deploy, /validateEnvironment\(\)/);
  assert.match(deploy, /sudo nginx -t/);
  assert.match(deploy, /known-good current release symlink is required/);
  assert.match(deploy, /active systemd service does not run the current release/);
  assert.match(deploy, /active nginx configuration does not serve the current release/);
  assert.match(deploy, /mv -Tf .*current\.next.*current/);
  assert.match(deploy, /activation failed; restoring/);
  assert.match(rollback, /known-good release is missing/);
  assert.match(rollback, /curl .*api\/health/);
});

test("systemd and production environment templates use shared configuration and active releases", () => {
  assert.match(systemd, /WorkingDirectory=.*\/current/);
  assert.match(systemd, /EnvironmentFile=.*\/shared\/\.env/);
  assert.match(systemd, /Environment=NODE_ENV=production/);
  assert.match(systemd, /ExecStart=__NODE_22_BINARY__/);
  for (const variable of [
    "MONGODB_URI",
    "JWT_SECRET",
    "SQUARE_ENVIRONMENT=production",
    "SQUARE_TOKEN_ENCRYPTION_KEY",
    "CLOUDINARY_API_SECRET",
    "GOOGLE_PLACES_API_KEY",
  ]) {
    assert.match(productionEnv, new RegExp(variable));
  }
});
