const assert = require("node:assert/strict");
const test = require("node:test");

const { getListenHost } = require("../config/serverBinding");

test("production always binds the backend to loopback", () => {
  assert.equal(getListenHost("production"), "127.0.0.1");
  assert.equal(getListenHost("production", "0.0.0.0"), "127.0.0.1");
});

test("development preserves the existing default or explicit local host behavior", () => {
  assert.equal(getListenHost("development"), undefined);
  assert.equal(getListenHost("development", "127.0.0.1"), "127.0.0.1");
});
