// Sincronização com a nuvem (Cloudflare Pages Functions + D1).
// Se o app estiver hospedado sem a API (GitHub Pages, arquivo local),
// tudo continua funcionando em modo local — a detecção falha e pronto.
const Sync = (() => {
  let enabled = false;
  let user = null;
  let timer = null;

  async function req(path, opts = {}) {
    return fetch(`api/${path}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  }

  // Existe API neste servidor? Estou logado?
  async function detect() {
    try {
      const r = await req("me");
      if (r.ok) {
        enabled = true;
        user = await r.json();
      } else if (r.status === 401) {
        enabled = true;
        user = null;
      } else {
        enabled = false;
      }
    } catch {
      enabled = false;
    }
  }

  async function authCall(path, email, password) {
    const r = await req(path, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || "Não deu certo — tenta de novo?");
    }
    user = await r.json();
  }

  const login = (email, password) => authCall("login", email, password);
  const register = (email, password) => authCall("register", email, password);

  async function logout() {
    try { await req("logout", { method: "POST" }); } catch { /* offline: ok */ }
    user = null;
  }

  // Baixa o estado salvo na nuvem (null se não houver/der erro)
  async function pull() {
    try {
      const r = await req("state");
      if (r.ok) return await r.json();
    } catch { /* offline: usa o local */ }
    return null;
  }

  // Sobe o estado com debounce (chamado a cada saveState)
  function pushSoon(getState) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await req("state", { method: "PUT", body: JSON.stringify(getState()) });
      } catch { /* offline: fica pro próximo save */ }
    }, 1500);
  }

  return {
    detect, login, register, logout, pull, pushSoon,
    get enabled() { return enabled; },
    get user() { return user; },
  };
})();
