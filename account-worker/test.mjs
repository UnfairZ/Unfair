import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker, { createHandler } from './worker.mjs';

const origin = 'https://ua.example';
const profile = { id: '123456789012345678', username: 'ua_test', global_name: 'Test name' };
const schema = await readFile(new URL('./migrations/0001_accounts.sql', import.meta.url), 'utf8');
const cookieHeader = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(`${name}=`));
const tokenOf = (response, name) => cookieHeader(response, name).split(';')[0];
const flowName = '__Host-ua_oauth';
const sessionName = '__Host-ua_session';
const req = (path, init) => new Request(origin + path, init);

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const accounts = {
    prepare(sql) {
      return { bind(...args) {
        return { first: async () => db.prepare(sql).get(...args) ?? null, run: async () => db.prepare(sql).run(...args) };
      } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        for (const statement of statements) await statement.run();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = {
    SITE_ORIGIN: origin, DISCORD_CLIENT_ID: profile.id, DISCORD_CLIENT_SECRET: 'fake-test-secret',
    AUTH_LIMIT: { limit: async () => ({ success: true }) }, ACCOUNTS: accounts,
    SITE: { fetch: async request => new Response(new URL(request.url).pathname) },
  };
  const calls = [];
  const handler = createHandler(async (url, init) => {
    calls.push(url);
    if (url.endsWith('/token')) {
      assert.equal(init.body.get('redirect_uri'), `${origin}/auth/discord/callback`);
      return Response.json({ access_token: 'test.value', refresh_token: 'not-retained', token_type: 'Bearer' });
    }
    assert.equal(init.headers.Authorization, 'Bearer test.value');
    return Response.json(profile);
  });
  return { db, env, calls, handler };
}

function requestStart(f, headers = {}, extra = {}) {
  return f.handler(req('/auth/discord', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.1', ...headers }, ...extra }), f.env);
}

async function start(f, headers) {
  const response = await requestStart(f, headers);
  assert.equal(response.status, 303);
  const url = new URL(response.headers.get('Location'));
  assert.equal(url.origin, 'https://discord.com');
  assert.equal(url.searchParams.get('scope'), 'identify');
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/auth/discord/callback`);
  assert.match(cookieHeader(response, flowName), /Secure; HttpOnly; SameSite=Lax; Max-Age=600/);
  const flow = tokenOf(response, flowName);
  return { flow, callback: `/auth/discord/callback?state=${url.searchParams.get('state')}&code=local-test` };
}

const cookies = Cookie => ({ headers: { Cookie } });

test('signs in using Discord identity, protects pages and data, and invalidates the session at logout', async t => {
  const f = fixture(); t.after(() => f.db.close());
  assert.equal((await f.handler(req('/account'), f.env)).headers.get('Location'), '/login');
  assert.equal((await f.handler(req('/api/account'), f.env)).status, 401);
  const flow = await start(f);
  const result = await f.handler(req(flow.callback, cookies(flow.flow)), f.env);
  assert.equal(result.headers.get('Location'), '/account');
  const session = tokenOf(result, sessionName);
  assert.match(cookieHeader(result, sessionName), /Secure; HttpOnly; SameSite=Lax; Max-Age=604800/);
  assert.notEqual(f.db.prepare('SELECT session_hash FROM sessions').get().session_hash, session.split('=')[1]);
  const page = await f.handler(req('/account.html', cookies(session)), f.env);
  assert.equal(await page.text(), '/account.html');
  assert.equal(page.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await f.handler(req('/login', cookies(session)), f.env)).headers.get('Location'), '/account');
  const data = await f.handler(req('/api/account', cookies(session)), f.env);
  assert.equal(data.headers.get('Cache-Control'), 'private, no-store');
  const { account } = await data.json();
  assert.equal(account.username, profile.username);
  assert.equal(account.displayName, profile.global_name);
  assert.equal(f.calls.length, 2);

  const logout = await f.handler(req('/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: session } }), f.env);
  assert.equal(logout.headers.get('Location'), '/login?status=signed-out');
  assert.match(cookieHeader(logout, sessionName), /Max-Age=0/);
  assert.equal((await f.handler(req('/api/account', cookies(session)), f.env)).status, 401);
});

test('rejects mismatched, expired, and already-consumed login states before exchanging a code', async t => {
  const f = fixture(); t.after(() => f.db.close());
  const first = await start(f);
  assert.equal((await f.handler(req(first.callback, cookies(`${flowName}=${'f'.repeat(64)}`)), f.env)).headers.get('Location'), '/login?status=expired');
  const accepted = await f.handler(req(first.callback, cookies(first.flow)), f.env);
  assert.equal(accepted.headers.get('Location'), '/account');
  assert.equal((await f.handler(req(first.callback, cookies(first.flow)), f.env)).headers.get('Location'), '/login?status=expired');
  const second = await start(f);
  f.db.exec('UPDATE oauth_states SET expires_at = 0');
  assert.equal((await f.handler(req(second.callback, cookies(second.flow)), f.env)).headers.get('Location'), '/login?status=expired');
  assert.equal(f.calls.length, 2);
});

test('enforces sign-in origin and rate limits, rotates sessions, and removes expired rows', async t => {
  const f = fixture(); t.after(() => f.db.close());
  assert.equal((await requestStart(f, { Origin: 'https://elsewhere.example' })).status, 403);
  f.env.AUTH_LIMIT.limit = async () => ({ success: false });
  assert.equal((await requestStart(f)).headers.get('Location'), '/login?status=busy');
  f.env.AUTH_LIMIT.limit = async () => ({ success: true });
  const first = await start(f);
  const oldSession = tokenOf(await f.handler(req(first.callback, cookies(first.flow)), f.env), sessionName);
  const second = await start(f);
  const newSession = tokenOf(await f.handler(req(second.callback, cookies(`${second.flow}; ${oldSession}`)), f.env), sessionName);
  assert.notEqual(newSession, oldSession);
  assert.equal((await f.handler(req('/api/account', cookies(oldSession)), f.env)).status, 401);
  assert.equal((await f.handler(req('/api/account', cookies(newSession)), f.env)).status, 200);
  await start(f);
  f.db.exec('UPDATE sessions SET expires_at = 0; UPDATE oauth_states SET expires_at = 0');
  assert.equal((await f.handler(req('/api/account', cookies(newSession)), f.env)).status, 401);
  await worker.scheduled(null, f.env);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM oauth_states').get().n, 0);
});
