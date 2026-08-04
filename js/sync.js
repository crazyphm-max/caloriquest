// Login e sincronização com o Firebase (Authentication + Firestore).
//
// O SDK é carregado do CDN do Google só quando há configuração preenchida em
// js/firebase-config.js. Sem ela — ou sem internet no primeiro carregamento —
// o app cai no modo local: continua funcionando inteiro, guardando tudo no
// aparelho, só não sincroniza.
//
// O estado do usuário vai para o Firestore em users/{uid}, num campo de texto
// com o JSON inteiro. É de propósito: o Firestore não aceita lista dentro de
// lista, e o nosso estado tem várias — guardar como texto evita esse buraco e
// deixa a leitura/escrita numa operação só.
const Sync = (() => {
  let enabled = false;   // existe Firebase configurado e o SDK carregou
  let user = null;       // { uid, email, name } ou null
  let timer = null;
  let fb = null;         // { auth, db, A: módulo auth, S: módulo firestore }

  const configured = () =>
    typeof FIREBASE_CONFIG !== "undefined" &&
    !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.projectId;

  const shape = (u) =>
    u ? { uid: u.uid, email: u.email || "", name: u.displayName || "" } : null;

  // O endereço do CDN fica numa variável para os testes conseguirem apontar
  // para um Firebase de mentira servido localmente.
  const cdn = () => window.CQ_FIREBASE_CDN || FIREBASE_CDN;

  async function load() {
    const base = cdn();
    const [app, A, S] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    const a = app.initializeApp(FIREBASE_CONFIG);
    fb = { auth: A.getAuth(a), db: S.getFirestore(a), A, S };
  }

  // Traduz os códigos do Firebase para algo que dê para ler na tela
  function humanize(e) {
    const code = (e && e.code) || "";
    const map = {
      "auth/invalid-email": "E-mail inválido",
      "auth/missing-password": "Digite sua senha",
      "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres",
      "auth/email-already-in-use": "Esse e-mail já tem conta — use Entrar",
      "auth/invalid-credential": "E-mail ou senha incorretos",
      "auth/wrong-password": "E-mail ou senha incorretos",
      "auth/user-not-found": "Não achei essa conta — que tal criar uma?",
      "auth/too-many-requests": "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
      "auth/network-request-failed": "Sem internet agora — tente de novo daqui a pouco",
      "auth/popup-closed-by-user": "A janela do Google fechou antes de terminar",
      "auth/unauthorized-domain":
        "Este endereço não está liberado no Firebase (Authentication → Settings → Authorized domains)",
      "auth/operation-not-allowed":
        "Esse jeito de entrar ainda não foi ligado no painel do Firebase",
    };
    return map[code] || "Não deu certo — tenta de novo?";
  }

  // Quem está logado agora? Espera o Firebase decidir (ele lê a sessão salva e,
  // se a pessoa voltou de um redirecionamento, conclui o login aqui).
  async function detect() {
    if (!configured()) { enabled = false; return; }
    try {
      await load();
      enabled = true;
      user = await new Promise((resolve) => {
        // off é declarado antes de registrar: se um dia o callback disparar na
        // hora, ainda assim existe algo para chamar
        let off = () => {};
        off = fb.A.onAuthStateChanged(fb.auth, (u) => { off(); resolve(shape(u)); });
      });
    } catch {
      enabled = false;   // sem internet no primeiro acesso: modo local
    }
  }

  // Entrar com o Google. No celular a janela nova às vezes é bloqueada; nesse
  // caso o próprio Firebase leva e traz a pessoa por redirecionamento.
  const PRECISA_REDIRECIONAR = [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ];

  async function google() {
    const provider = new fb.A.GoogleAuthProvider();
    try {
      const cred = await fb.A.signInWithPopup(fb.auth, provider);
      user = shape(cred.user);
    } catch (e) {
      if (PRECISA_REDIRECIONAR.includes(e && e.code)) {
        await fb.A.signInWithRedirect(fb.auth, provider);
        return; // a página recarrega; o detect() do próximo boot conclui
      }
      throw new Error(humanize(e));
    }
  }

  async function login(email, password) {
    try {
      const cred = await fb.A.signInWithEmailAndPassword(fb.auth, email, password);
      user = shape(cred.user);
    } catch (e) { throw new Error(humanize(e)); }
  }

  async function register(email, password) {
    try {
      const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, email, password);
      user = shape(cred.user);
    } catch (e) { throw new Error(humanize(e)); }
  }

  async function logout() {
    try { await fb.A.signOut(fb.auth); } catch { /* offline: ok */ }
    user = null;
  }

  const docRef = () => fb.S.doc(fb.db, "users", user.uid);

  // Baixa o estado salvo na nuvem (null se não houver ou se der erro)
  async function pull() {
    if (!user) return null;
    try {
      const snap = await fb.S.getDoc(docRef());
      const raw = snap.exists() ? snap.data().state : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null; // offline: usa o que está no aparelho
    }
  }

  // Sobe o estado com um respiro de 1,5s, para não gravar a cada tecla
  function pushSoon(getState) {
    if (!user || !fb) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await fb.S.setDoc(docRef(), {
          state: JSON.stringify(getState()),
          email: user.email,
          updatedAt: fb.S.serverTimestamp(),
        });
      } catch { /* offline: fica para o próximo save */ }
    }, 1500);
  }

  return {
    detect, login, register, google, logout, pull, pushSoon,
    get enabled() { return enabled; },
    get user() { return user; },
  };
})();
