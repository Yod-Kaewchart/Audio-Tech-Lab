'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createOpenAICredentialStore } = require('./openai-credential-store.cjs');

test('OpenAI credential store sends secrets only over child stdin and returns fingerprints only', () => {
  const key = 'sk-test-' + 'A'.repeat(28) + 'A7xQ';
  let present = false, encryptedInput = '', lastArgs = [];
  const store = createOpenAICredentialStore({
    directory: 'C:\\runtime\\openai-credentials', platform: 'win32', env: { SystemRoot: 'C:\\Windows' },
    exists: () => present,
    spawn: (_exe, args, options) => {
      lastArgs = args;
      const action = args[args.indexOf('-Action') + 1];
      if (action === 'write') { encryptedInput = options.input; present = true; return { status: 0, stdout: '{"ok":true}' }; }
      if (action === 'read') return { status: 0, stdout: encryptedInput };
      if (action === 'delete') { present = false; return { status: 0, stdout: '{"ok":true}' }; }
      throw new Error('Unexpected action');
    }
  });
  const userId = '11111111-1111-4111-8111-111111111111';
  store.write(userId, key);
  assert.equal(encryptedInput, key);
  assert.equal(lastArgs.join(' ').includes(key), false);
  assert.deepEqual(store.status(userId), { connected: true, fingerprint: '••••A7xQ' });
  assert.equal(store.read(userId), key);
  assert.equal(store.delete(userId), true);
  assert.deepEqual(store.status(userId), { connected: false, fingerprint: null });
});

test('Credential store failures never disclose child output or accept malformed keys', () => {
  const leaked = 'sensitive-child-output';
  const store = createOpenAICredentialStore({
    directory: 'C:\\runtime\\openai-credentials', platform: 'win32', env: { SystemRoot: 'C:\\Windows' },
    exists: () => true,
    spawn: () => ({ status: 1, stdout: leaked, stderr: leaked })
  });
  const userId = '22222222-2222-4222-8222-222222222222';
  assert.throws(() => store.write(userId, 'not-a-key'), /valid OpenAI API key/);
  assert.throws(() => store.read(userId), error => error.message === 'OpenAI credential store is unavailable' && !error.message.includes(leaked));
});
