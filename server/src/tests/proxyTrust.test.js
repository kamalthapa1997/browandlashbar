const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { configureTrustProxy } = require("../app");

function createRequest({ environment, remoteAddress, headers = {} }) {
  const app = express();
  configureTrustProxy(app, environment);
  const request = Object.create(express.request);
  request.app = app;
  request.socket = { remoteAddress };
  request.connection = request.socket;
  request.headers = headers;
  return request;
}

test("direct development requests ignore forwarded client headers", () => {
  const request = createRequest({
    environment: "development",
    remoteAddress: "127.0.0.1",
    headers: {
      "x-forwarded-for": "203.0.113.10",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(request.ip, "127.0.0.1");
  assert.deepEqual(request.ips, []);
  assert.equal(request.protocol, "http");
});

test("production trusts the local Nginx hop and uses its client forwarding headers", () => {
  const request = createRequest({
    environment: "production",
    remoteAddress: "127.0.0.1",
    headers: {
      "x-forwarded-for": "203.0.113.10",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(request.ip, "203.0.113.10");
  assert.deepEqual(request.ips, ["203.0.113.10"]);
  assert.equal(request.protocol, "https");
});

test("production ignores spoofed forwarded headers from an untrusted direct peer", () => {
  const request = createRequest({
    environment: "production",
    remoteAddress: "198.51.100.20",
    headers: {
      "x-forwarded-for": "203.0.113.10",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(request.ip, "198.51.100.20");
  assert.deepEqual(request.ips, []);
  assert.equal(request.protocol, "http");
});
