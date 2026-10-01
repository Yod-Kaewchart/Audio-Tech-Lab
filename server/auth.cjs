'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt), HASH_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const usernameOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value);
const passwordOK = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const emailOK = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(status, message) { return Object.assign(new Error(message), { status }); }
function createAuth(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const dbPath = path.join(directory, 'users.json'), sessions = new Map(), attempts = new Map(), registrations = new Map();
  function save(db) {
    fs.writeFileSync(dbPath + '.tmp', JSON.stringify(db, null, 2), { mode: 0o600 });
    fs.renameSync(dbPath + '.tmp', dbPath);
  }
  function read() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
  function hashSync(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: crypto.scryptSync(password, salt, 64, HASH_OPTIONS).toString('hex') };
  }
  if (!fs.existsSync(dbPath)) {
    const password = crypto.randomBytes(18).toString('base64url');
    const admin = { id: crypto.randomUUID(), username: 'yod', role: 'admin', mustChange: true, version: 1, ...hashSync(password) };
    save({ users: [admin] });
    fs.writeFileSync(path.join(directory, 'first-login.txt'), 'Audio Tech Labs Web Demo\r\nUsername: yod\r\nTemporary password: ' + password + '\r\nChange your password after signing in.\r\n', { mode: 0o600 });
  }
  const dummy = hashSync(crypto.randomBytes(24).toString('hex'));
  const publicUser = user => ({ username: user.username, email: user.email || '', role: user.role, status: user.status || 'active', mustChange: user.mustChange, emailVerified: !!user.emailVerified, createdAt: user.createdAt || null, lastLoginAt: user.lastLoginAt || null });
  async function verify(password, user) {
    const record = user || dummy;
    const result = await scrypt(password, record.salt, 64, HASH_OPTIONS);
    return crypto.timingSafeEqual(result, Buffer.from(record.hash, 'hex')) && !!user;
  }
  let hashing = 0;
  async function limitedVerify(password, user) {
    if (hashing >= 4) throw fail(429, 'Please wait before trying again');
    hashing++;
    try { return await verify(password, user); } finally { hashing--; }
  }
  function secureCookie(req, token, maxAge = 28800) {
    const secure = req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;
    return 'atl_session=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (secure ? '; Secure' : '');
  }
  function sessionFor(req) {
    const values = String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith('atl_session='));
    if (values.length !== 1) return null;
    const token = values[0].slice('atl_session='.length);
    if (!/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const key = digest(token), session = sessions.get(key), now = Date.now();
    if (!session || now > session.expires || now - session.seen > 30 * 60 * 1000) { sessions.delete(key); return null; }
    const user = read().users.find(x => x.id === session.userId);
    if (!user || session.version !== user.version) { sessions.delete(key); return null; }
    session.seen = now;
    return { user, session, key };
  }
  function csrf(req, auth) {
    const value = String(req.headers['x-csrf-token'] || '');
    if (!/^[a-zA-Z0-9_-]{43}$/.test(value) || !crypto.timingSafeEqual(Buffer.from(value), Buffer.from(auth.session.csrf))) throw fail(403, 'Invalid security token');
  }
  function requireUser(req, { allowPasswordChange = false } = {}) {
    const auth = sessionFor(req);
    if (!auth) throw fail(401, 'Please sign in');
    if (req.method !== 'GET' && req.method !== 'HEAD') csrf(req, auth);
    if (auth.user.mustChange && !allowPasswordChange) throw fail(403, 'Change your temporary password first');
    return auth;
  }
  function originOK(req, allowedOrigins) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins().has(origin)) throw fail(403, 'Origin is not allowed');
  }
  let mutation = Promise.resolve();
  function mutate(fn) {
    const work = mutation.then(fn);
    mutation = work.catch(() => {});
    return work;
  }
  async function handle(req, res, route, json, send, allowedOrigins) {
    if (!route.startsWith('/auth/') && route !== '/admin/users' && !route.startsWith('/admin/users/')) return false;
    originOK(req, allowedOrigins);
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON request required');
    if (req.method === 'POST' && route === '/auth/register') {
      const data = await json(req, 16384), username = String(data.username || '').trim().toLowerCase(), email = String(data.email || '').trim().toLowerCase();
      if (!usernameOK(username) || !emailOK(email) || !passwordOK(data.password)) throw fail(400, 'Use a valid username, email, and a password of 12–128 characters');
      const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 80), now = Date.now();
      const entry = registrations.get(ip);
      if (entry && entry.until > now && entry.count >= 5) throw fail(429, 'Too many registrations. Try again in 15 minutes');
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(data.password, salt, 64, HASH_OPTIONS)).toString('hex');
      let user;
      await mutate(async () => {
        const db = read();
        if (db.users.some(x => x.username === username)) throw fail(409, 'Username already exists');
        if (db.users.some(x => String(x.email || '').toLowerCase() === email)) throw fail(409, 'Email already exists');
        if (db.users.length >= 100) throw fail(409, 'Account limit reached');
        const nowISO = new Date().toISOString();
        user = { id: crypto.randomUUID(), username, email, role: 'user', status: 'active', emailVerified: false, createdAt: nowISO, updatedAt: nowISO, lastLoginAt: null, mustChange: false, version: 1, salt, hash };
        db.users.push(user); save(db);
      });
      registrations.set(ip, { count: entry && entry.until > now ? entry.count + 1 : 1, until: now + 15 * 60 * 1000 });
      send(res, 201, { ok: true, user: publicUser(user) }); return true;
    }
    if (req.method === 'POST' && route === '/auth/login') {
      const data = await json(req, 16384), login = String(data.username || '').trim().toLowerCase();
      if (!usernameOK(login) && !emailOK(login)) throw fail(401, 'Incorrect username/email or password');
      const password = typeof data.password === 'string' && data.password.length <= 128 ? data.password : '';
      const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 80);
      const now = Date.now(), keys = ['login:' + login, 'ip:' + ip];
      for (const key of keys) { const entry = attempts.get(key); if (entry && entry.until > now && entry.count >= 8) throw fail(429, 'Too many attempts. Try again in 15 minutes'); }
      const user = read().users.find(x => x.username === login || String(x.email || '').toLowerCase() === login);
      if (!await limitedVerify(password, user)) {
        if (attempts.size >= 8192 && keys.some(key => !attempts.has(key))) throw fail(429, 'Please try again later');
        for (const key of keys) { const prior = attempts.get(key); attempts.set(key, { count: prior && prior.until > now ? prior.count + 1 : 1, until: now + 15 * 60 * 1000 }); }
        throw fail(401, 'Incorrect username/email or password');
      }
      if ((user.status || 'active') !== 'active') throw fail(403, 'Account is disabled');
      if (sessions.size >= 1000) throw fail(429, 'Too many active sessions');
      const token = crypto.randomBytes(32).toString('base64url'), securityToken = crypto.randomBytes(32).toString('base64url');
      sessions.set(digest(token), { userId: user.id, version: user.version, csrf: securityToken, seen: now, expires: now + 8 * 60 * 60 * 1000 });
      res.setHeader('Set-Cookie', secureCookie(req, token));
      send(res, 200, { user: publicUser(user), csrf: securityToken }); return true;
    }
    const auth = requireUser(req, { allowPasswordChange: true });
    if (req.method === 'GET' && route === '/auth/me') { send(res, 200, { user: publicUser(auth.user), csrf: auth.session.csrf }); return true; }
    if (req.method === 'POST' && route === '/auth/logout') {
      sessions.delete(auth.key); res.setHeader('Set-Cookie', secureCookie(req, '', 0)); send(res, 200, { ok: true }); return true;
    }
    if (req.method === 'POST' && route === '/auth/password') {
      const data = await json(req, 16384);
      if (!passwordOK(data.newPassword) || data.newPassword === data.currentPassword) throw fail(400, 'Use a different password with 12–128 characters');
      if (typeof data.currentPassword !== 'string' || data.currentPassword.length > 128 || !await limitedVerify(data.currentPassword, auth.user)) throw fail(401, 'Current password is incorrect');
      const priorVersion = auth.user.version;
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(data.newPassword, salt, 64, HASH_OPTIONS)).toString('hex');
      await mutate(async () => {
        const db = read(), user = db.users.find(x => x.id === auth.user.id);
        if (user.version !== priorVersion) throw fail(401, 'Please sign in again');
        Object.assign(user, { salt, hash, mustChange: false, version: user.version + 1 }); save(db);
        for (const [key, value] of sessions) if (value.userId === user.id && key !== auth.key) sessions.delete(key);
        auth.session.version = user.version; auth.user = user;
      });
      if (auth.user.role === 'admin') fs.rmSync(path.join(directory, 'first-login.txt'), { force: true });
      send(res, 200, { user: publicUser(auth.user), csrf: auth.session.csrf }); return true;
    }
    if (route === '/admin/users' || route.startsWith('/admin/users/')) {
      if (auth.user.role !== 'admin' || auth.user.mustChange) throw fail(403, 'Administrator access required');
      if (req.method === 'GET' && route === '/admin/users') { send(res, 200, { users: read().users.map(user => ({ id: user.id, ...publicUser(user) })) }); return true; }
      if (req.method === 'DELETE') {
        const userId = decodeURIComponent(route.slice('/admin/users/'.length));
        if (!userId || userId === auth.user.id) throw fail(400, 'Administrator account cannot be deleted');
        let deleted;
        await mutate(async () => {
          const db = read(), index = db.users.findIndex(x => x.id === userId);
          if (index < 0) throw fail(404, 'User not found');
          if (db.users[index].role === 'admin') throw fail(400, 'Administrator account cannot be deleted');
          deleted = db.users[index]; db.users.splice(index, 1); save(db);
          for (const [key, value] of sessions) if (value.userId === userId) sessions.delete(key);
        });
        send(res, 200, { ok: true, user: { id: deleted.id, username: deleted.username } }); return true;
      }
      if (req.method === 'POST') {
        const data = await json(req, 16384), username = String(data.username || '').trim().toLowerCase();
        if (!usernameOK(username) || !passwordOK(data.password)) throw fail(400, 'Use a username of 3–32 letters/numbers and a password of 12–128 characters');
        const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(data.password, salt, 64, HASH_OPTIONS)).toString('hex');
        await mutate(async () => { const db = read(); if (db.users.some(x => x.username === username)) throw fail(409, 'Username already exists'); if (db.users.length >= 100) throw fail(409, 'Account limit reached'); db.users.push({ id: crypto.randomUUID(), username, role: 'user', mustChange: true, version: 1, salt, hash }); save(db); });
        send(res, 201, { ok: true, username }); return true;
      }
    }
    throw fail(404, 'Not found');
  }
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) if (now > value.expires || now - value.seen > 30 * 60 * 1000) sessions.delete(key);
    for (const [key, value] of attempts) if (now > value.until) attempts.delete(key);
    for (const [key, value] of registrations) if (now > value.until) registrations.delete(key);
  }, 60000); timer.unref();
  return { handle, requireUser, originOK, ownerId: () => read().users.find(x => x.role === 'admin').id, close: () => clearInterval(timer) };
}
module.exports = { createAuth, fail };

