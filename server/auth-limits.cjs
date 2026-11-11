'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const HASH_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function limited(retryAfter, message = 'Please wait before trying again') {
  return Object.assign(new Error(message), { status: 429, retryAfter: Math.max(1, Math.ceil(retryAfter)) });
}

// At most two ~32 MiB scrypt operations run at once, leaving capacity in the
// default libuv pool for other work. Both active and waiting work are bounded.
function createScryptGate({ concurrency = 2, maxWaiting = 8, derive = scrypt } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(maxWaiting) || maxWaiting < 0) throw new Error('Invalid scrypt gate limits');
  let active = 0;
  const waiting = [];
  function start(item) {
    active++;
    Promise.resolve().then(() => derive(item.password, item.salt, 64, HASH_OPTIONS)).then(item.resolve, item.reject).finally(() => {
      active--;
      if (waiting.length) start(waiting.shift());
    });
  }
  return (password, salt) => new Promise((resolve, reject) => {
    const item = { password, salt, resolve, reject };
    if (active < concurrency) start(item);
    else if (waiting.length < maxWaiting) waiting.push(item);
    else reject(limited(1));
  });
}
const sharedScrypt = createScryptGate();

// Invalid requests have their own circuit breaker. Valid identities consume
// their quotas before the separate hash-work circuit breaker is reserved.
// No client IP is trusted here.
function createRegistrationLimiter({ now = Date.now, windowMs = 15 * 60 * 1000, perIdentity = 5, globalLimit = 300, maxEntries = 4096 } = {}) {
  const entries = new Map();
  let global = { count: 0, until: 0 }, invalid = { count: 0, until: 0 };
  const key = (type, value) => type + ':' + crypto.createHash('sha256').update(value).digest('hex');
  function prune(time = now()) { for (const [id, value] of entries) if (value.until <= time) entries.delete(id); }
  function reserveRequest() {
    const time = now();
    if (global.until <= time) global = { count: 0, until: time + windowMs };
    if (global.count >= globalLimit) throw limited((global.until - time) / 1000, 'Too many registrations. Try again later');
    global.count++;
    const reservedWindow = global; let refunded = false;
    return () => { if (!refunded) { refunded = true; if (global === reservedWindow) global.count--; } };
  }
  function reserveInvalidRequest() {
    const time = now();
    if (invalid.until <= time) invalid = { count: 0, until: time + windowMs };
    if (invalid.count >= globalLimit) throw limited((invalid.until - time) / 1000, 'Too many invalid registration requests. Try again later');
    invalid.count++;
  }
  function reserveIdentity(username, email) {
    const time = now(), ids = [key('user', username), key('email', email)];
    for (const id of ids) {
      const entry = entries.get(id);
      if (entry && entry.until > time && entry.count >= perIdentity) throw limited((entry.until - time) / 1000, 'Too many registration attempts. Try again later');
    }
    const needed = ids.filter(id => !entries.has(id) || entries.get(id).until <= time).length;
    if (entries.size + needed > maxEntries) {
      prune(time);
      if (entries.size + ids.filter(id => !entries.has(id)).length > maxEntries) throw limited(windowMs / 1000, 'Too many registrations. Try again later');
    }
    for (const id of ids) {
      const prior = entries.get(id);
      entries.set(id, prior && prior.until > time ? { count: prior.count + 1, until: prior.until } : { count: 1, until: time + windowMs });
    }
  }
  function reserve(username, email) { reserveIdentity(username, email); reserveRequest(); }
  return { reserveRequest, reserveInvalidRequest, reserveIdentity, reserve, prune };
}
module.exports = { sharedScrypt, createScryptGate, createRegistrationLimiter, limited };
