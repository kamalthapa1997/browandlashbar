function getListenHost(environment = process.env.NODE_ENV, host = process.env.HOST) {
  // Production traffic must reach Node only through the local nginx proxy.
  // Development keeps the existing Node default unless a local HOST is chosen.
  return environment === "production" ? "127.0.0.1" : host || undefined;
}

module.exports = { getListenHost };
