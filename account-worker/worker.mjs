const FLOW = '__Host-ua_oauth';
const SESSION = '__Host-ua_session';
const FLOW_SECONDS = 600;
const SESSION_SECONDS = 7 * 86400;
const opaque = /^[a-f0-9]{64}$/;
const discordId = /^\d{17,20}$/;
const encoder = new TextEncoder();
const permissions = 'camera=(), microphone=(), geolocation=()';
// Some browsers apply form-action to the OAuth redirect as well as the original POST.
const policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self' https://discord.com; base-uri 'none'; frame-ancestors 'none'";

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async token => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));

function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}

function readCookie(request, name) {
  const part = (request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  const value = part?.slice(name.length + 1);
  return value && opaque.test(value) ? value : null;
}

function headers(privateResponse = true) {
  const result = new Headers({
    'Content-Security-Policy': policy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': permissions,
    'X-Frame-Options': 'DENY',
  });
  if (privateResponse) result.set('Cache-Control', 'private, no-store');
  return result;
}

function redirect(location, cookies = []) {
  const delivery = headers();
  delivery.set('Location', location);
  for (const value of cookies) delivery.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers: delivery });
}

const failLogin = (reason, clear = true) => redirect(`/login?status=${reason}`, clear ? [cookie(FLOW, '', 0)] : []);

function json(value, status = 200) {
  return Response.json(value, { status, headers: headers() });
}

function settings(env) {
  try {
    const origin = new URL(env.SITE_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.SITE_ORIGIN) return null;
    if (!discordId.test(env.DISCORD_CLIENT_ID ?? '') || !env.DISCORD_CLIENT_SECRET) return null;
    return { origin: origin.origin, clientId: env.DISCORD_CLIENT_ID, secret: env.DISCORD_CLIENT_SECRET };
  } catch { return null; }
}

async function asset(request, env, path, noStore = false) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = '';
  const response = await env.SITE.fetch(new Request(url, request));
  const delivery = new Headers(response.headers);
  for (const [name, value] of headers(noStore)) delivery.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: delivery });
}

async function currentAccount(request, env) {
  const token = readCookie(request, SESSION);
  if (!token) return null;
  return env.ACCOUNTS.prepare(`SELECT a.username, a.display_name AS displayName,
    a.created_at AS joinedAt FROM sessions s JOIN accounts a ON a.discord_id = s.discord_id
    WHERE s.session_hash = ? AND s.expires_at > ?`).bind(await hash(token), Date.now()).first();
}

async function begin(request, env, config) {
  const state = randomToken();
  const previous = readCookie(request, FLOW);
  const insert = env.ACCOUNTS.prepare('INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)')
    .bind(await hash(state), Date.now() + FLOW_SECONDS * 1000);
  if (previous) {
    await env.ACCOUNTS.batch([env.ACCOUNTS.prepare('DELETE FROM oauth_states WHERE state_hash = ?').bind(await hash(previous)), insert]);
  } else await insert.run();
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${config.origin}/auth/discord/callback`, response_type: 'code', scope: 'identify', state });
  return redirect(authorize.href, [cookie(FLOW, state, FLOW_SECONDS)]);
}

async function discordProfile(config, code, call) {
  const token = await call('https://discord.com/api/v10/oauth2/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, grant_type: 'authorization_code', code, redirect_uri: `${config.origin}/auth/discord/callback` }),
  });
  if (!token.ok) return null;
  const grant = await token.json();
  if (typeof grant?.access_token !== 'string' || grant.access_token.length > 4096 || !/^[A-Za-z0-9._~-]+$/.test(grant.access_token) || String(grant.token_type).toLowerCase() !== 'bearer') return null;
  const profile = await call('https://discord.com/api/v10/users/@me', {
    redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${grant.access_token}` },
  });
  if (!profile.ok) return null;
  const user = await profile.json();
  if (typeof user?.id !== 'string' || !discordId.test(user.id) || typeof user.username !== 'string' || !user.username || user.username.length > 64) return null;
  const displayName = typeof user.global_name === 'string' && user.global_name.trim() ? user.global_name.slice(0, 80) : user.username;
  return { id: user.id, username: user.username, displayName };
}

async function finish(request, env, config, url, call) {
  const state = url.searchParams.get('state');
  if (!state || !opaque.test(state) || state !== readCookie(request, FLOW)) return failLogin('expired', false);
  const consumed = await env.ACCOUNTS.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING state_hash')
    .bind(await hash(state), Date.now()).first();
  if (!consumed) return failLogin('expired');
  if (url.searchParams.get('error') === 'access_denied') return failLogin('cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return failLogin('failed');
  const user = await discordProfile(config, code, call);
  if (!user) return failLogin('failed');

  const token = randomToken();
  const now = Date.now();
  const previous = readCookie(request, SESSION);
  const statements = [env.ACCOUNTS.prepare(`INSERT INTO accounts (discord_id, username, display_name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name, last_login_at = excluded.last_login_at`)
    .bind(user.id, user.username, user.displayName, now, now)];
  if (previous) statements.push(env.ACCOUNTS.prepare('DELETE FROM sessions WHERE session_hash = ?').bind(await hash(previous)));
  statements.push(env.ACCOUNTS.prepare('INSERT INTO sessions (session_hash, discord_id, expires_at) VALUES (?, ?, ?)')
    .bind(await hash(token), user.id, now + SESSION_SECONDS * 1000));
  await env.ACCOUNTS.batch(statements);
  return redirect('/account', [cookie(FLOW, '', 0), cookie(SESSION, token, SESSION_SECONDS)]);
}

export function createHandler(call = fetch) {
  return async (request, env) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const config = settings(env);
    try {
      if (path === '/auth/discord' || path === '/auth/logout') {
        if (method !== 'POST') return new Response(null, { status: 405, headers: { ...Object.fromEntries(headers()), Allow: 'POST' } });
        if (path === '/auth/discord' && !config) return failLogin('unavailable', false);
        if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin || (config && url.origin !== config.origin)) return json({ error: 'Forbidden' }, 403);
        if (path === '/auth/discord') {
          const ip = request.headers.get('CF-Connecting-IP');
          if (!ip || !(await env.AUTH_LIMIT.limit({ key: ip })).success) return failLogin('busy', false);
          return await begin(request, env, config);
        }
        const token = readCookie(request, SESSION);
        if (token) await env.ACCOUNTS.prepare('DELETE FROM sessions WHERE session_hash = ?').bind(await hash(token)).run();
        return redirect('/login?status=signed-out', [cookie(SESSION, '', 0), cookie(FLOW, '', 0)]);
      }
      if (path === '/auth/discord/callback') {
        if (method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (!config || url.origin !== config.origin) return failLogin('unavailable');
        return await finish(request, env, config, url, call);
      }
      if (path === '/api/account') {
        if (method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const account = await currentAccount(request, env);
        return account ? json({ account }) : json({ error: 'Sign in required' }, 401);
      }
      if (method !== 'GET' && method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
      if (path === '/login' || path === '/login.html') {
        if (!url.searchParams.has('status') && await currentAccount(request, env)) return redirect('/account');
        return await asset(request, env, '/login.html', true);
      }
      if (path === '/account' || path === '/account.html') {
        if (!(await currentAccount(request, env))) return redirect('/login');
        return await asset(request, env, '/account.html', true);
      }
      if (path === '/') return await asset(request, env, '/index.html');
      if (path === '/privacy') return await asset(request, env, '/privacy.html');
      if (/^\/(?:[a-z-]+\.(?:css|js)|index\.html|privacy\.html|assets\/[a-z0-9._-]+)$/i.test(path)) return await asset(request, env, path);
      return new Response('Not found', { status: 404, headers: headers() });
    } catch {
      if (path === '/auth/discord/callback' || path === '/auth/discord') return failLogin('unavailable');
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
  };
}

export default {
  fetch: createHandler(),
  async scheduled(_event, env) {
    const now = Date.now();
    await env.ACCOUNTS.batch([
      env.ACCOUNTS.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
      env.ACCOUNTS.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(now),
    ]);
  },
};
