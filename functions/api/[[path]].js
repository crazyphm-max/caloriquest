// API do CaloriQuest — Cloudflare Pages Functions + banco D1.
// Rotas: POST register | POST login | POST logout | GET me | GET state | PUT state
// Sessão via cookie HttpOnly; senha com PBKDF2 (100 mil iterações, SHA-256).

const enc = new TextEncoder();
const SESSION_DAYS = 180;
const MAX_STATE_BYTES = 512 * 1024;

const bufToHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBuf = (hex) =>
  new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return bufToHex(a.buffer);
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBuf(saltHex), iterations: 100000 },
    key, 256
  );
  return bufToHex(bits);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

const sessionCookie = (token, maxAgeSec) =>
  `cq_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;

async function currentUser(request, env) {
  const token = getCookie(request, "cq_session");
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
}

async function createSession(env, userId) {
  const token = randomHex(32);
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  ).bind(token, userId).run();
  // limpeza oportunista de sessões vencidas
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  return token;
}

async function readCredentials(request) {
  const body = await request.json().catch(() => null);
  const email = (body?.email || "").trim().toLowerCase();
  const password = body?.password || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: json({ error: "E-mail inválido" }, 400) };
  if (password.length < 6)
    return { error: json({ error: "A senha precisa ter pelo menos 6 caracteres" }, 400) };
  return { email, password };
}

async function handleRegister(request, env) {
  const cred = await readCredentials(request);
  if (cred.error) return cred.error;
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(cred.email).first();
  if (exists) return json({ error: "Esse e-mail já tem conta — use Entrar" }, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(cred.password, salt);
  const res = await env.DB.prepare(
    "INSERT INTO users (email, pass_hash, salt) VALUES (?, ?, ?)"
  ).bind(cred.email, hash, salt).run();

  const token = await createSession(env, res.meta.last_row_id);
  return json({ email: cred.email }, 200, {
    "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400),
  });
}

async function handleLogin(request, env) {
  const cred = await readCredentials(request);
  if (cred.error) return cred.error;
  const user = await env.DB.prepare(
    "SELECT id, email, pass_hash, salt FROM users WHERE email = ?"
  ).bind(cred.email).first();
  const wrong = json({ error: "E-mail ou senha incorretos" }, 401);
  if (!user) return wrong;
  const hash = await hashPassword(cred.password, user.salt);
  if (hash !== user.pass_hash) return wrong;

  const token = await createSession(env, user.id);
  return json({ email: user.email }, 200, {
    "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400),
  });
}

async function handleLogout(request, env) {
  const token = getCookie(request, "cq_session");
  if (token)
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

async function handleGetState(user, env) {
  const row = await env.DB.prepare("SELECT data FROM states WHERE user_id = ?")
    .bind(user.id).first();
  return new Response(row ? row.data : "{}", {
    headers: { "Content-Type": "application/json" },
  });
}

async function handlePutState(request, user, env) {
  const body = await request.text();
  if (body.length > MAX_STATE_BYTES)
    return json({ error: "Dados grandes demais" }, 413);
  try { JSON.parse(body); } catch { return json({ error: "JSON inválido" }, 400); }
  await env.DB.prepare(
    `INSERT INTO states (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
  ).bind(user.id, body).run();
  return json({ ok: true });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = (params.path || []).join("/");
  const method = request.method;

  try {
    if (method === "POST" && path === "register") return await handleRegister(request, env);
    if (method === "POST" && path === "login") return await handleLogin(request, env);
    if (method === "POST" && path === "logout") return await handleLogout(request, env);

    // daqui pra baixo, precisa estar logado
    const user = await currentUser(request, env);
    if (method === "GET" && path === "me")
      return user ? json({ email: user.email }) : json({ error: "Não autenticado" }, 401);
    if (!user) return json({ error: "Não autenticado" }, 401);
    if (method === "GET" && path === "state") return await handleGetState(user, env);
    if (method === "PUT" && path === "state") return await handlePutState(request, user, env);

    return json({ error: "Rota não encontrada" }, 404);
  } catch (e) {
    return json({ error: "Erro interno no servidor" }, 500);
  }
}
