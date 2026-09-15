const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const configPath = path.join(
  __dirname,
  "../../../infrastructure/nginx/merobrowandlashbar-site.conf.template",
);
const config = fs.readFileSync(configPath, "utf8");

test("nginx frontend template has the reviewed CSP and complete browser headers", () => {
  const csp = config.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1];

  assert.equal(
    csp,
    "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; worker-src 'self' blob:; form-action 'self'; frame-ancestors 'none'",
  );
  assert.match(config, /add_header X-Frame-Options "DENY" always;/);
  assert.match(config, /add_header X-Content-Type-Options "nosniff" always;/);
  assert.match(config, /add_header Referrer-Policy "strict-origin-when-cross-origin" always;/);
  assert.match(config, /add_header Permissions-Policy "accelerometer=\(\), camera=\(\), geolocation=\(\), gyroscope=\(\), microphone=\(\), payment=\(\), usb=\(\)" always;/);
  assert.match(config, /add_header Strict-Transport-Security "max-age=31536000" always;/);
});

test("nginx template separates static headers from the Express API and redirects HTTP", () => {
  assert.match(config, /return 301 https:\/\/\$host\$request_uri;/);
  assert.match(config, /location = \/api \{[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:5001;/);
  assert.match(config, /location = \/api\/ \{[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:5001;/);
  assert.match(config, /location \^~ \/api\/ \{[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:5001;/);
  assert.match(config, /location \/ \{[\s\S]*try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(config, /Express owns API security headers/);
});
