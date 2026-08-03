// Sincronização com a nuvem (Cloudflare Pages Functions + D1).
// Se o app estiver hospedado sem a API (GitHub Pages, arquivo local),
// tudo continua funcionando em modo local — a detecção falha e pronto.
const Sync = (() => {
  let enabled = false;
  let user = null;
  let timer = null;
  let googleClientId = "";

  async function req(path, opts = {}) {
    return fetch(`api/${path}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  }

  // Existe API neste servidor? Estou logado? O botão do Google está ligado?
  // Tudo numa chamada só, para o app abrir rápido.
  async function detect() {
    try {
      const r = await req("session");
      if (!r.ok) { enabled = false; return; }
      const d = await r.json();
      enabled = true;
      user = d.user || null;
      googleClientId = d.googleClientId || "";
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

  // Recebe o ID token que o botão do Google devolve e troca por uma sessão nossa
  async function google(credential) {
    const r = await req("google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || "Não deu certo — tenta de novo?");
    }
    user = await r.json();
  }

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
    detect, login, register, google, logout, pull, pushSoon,
    get enabled() { return enabled; },
    get user() { return user; },
    get googleClientId() { return googleClientId; },
  };
})();
