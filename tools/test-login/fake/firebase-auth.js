// Firebase de mentira: guarda o "usuário logado" no localStorage para
// sobreviver a um reload, como o Firebase de verdade faz com a sessão.
const K = "__fake_user";
const read = () => { try { return JSON.parse(localStorage.getItem(K)); } catch { return null; } };
const write = (u) => u ? localStorage.setItem(K, JSON.stringify(u)) : localStorage.removeItem(K);
const erro = (code) => Object.assign(new Error(code), { code });
window.__fake = window.__fake || {};
// as contas ficam no localStorage: no Firebase de verdade elas vivem no
// servidor e sobrevivem a um reload, e o teste precisa do mesmo comportamento
const KC = "__fake_contas";
const contas = () => { try { return JSON.parse(localStorage.getItem(KC)) || {}; } catch { return {}; } };
const salvaContas = (c) => localStorage.setItem(KC, JSON.stringify(c));
window.__fake.calls = [];
const log = (n, extra) => window.__fake.calls.push({ n, ...extra });

export function getAuth() { return { id: "auth" }; }
export function onAuthStateChanged(auth, cb) {
  setTimeout(() => cb(read()), 0);
  return () => {};
}
export class GoogleAuthProvider {}
export async function signInWithPopup() {
  log("popup");
  if (window.__fake.popupBloqueado) throw erro("auth/popup-blocked");
  const u = { uid: "uid-google", email: "crazyphm@gmail.com", displayName: "Miguel" };
  write(u);
  return { user: u };
}
export async function signInWithRedirect() { log("redirect"); }
export async function signInWithEmailAndPassword(auth, email, password) {
  const conta = contas()[email.toLowerCase()];
  if (!conta) throw erro("auth/user-not-found");
  if (conta.password !== password) throw erro("auth/invalid-credential");
  write(conta.user); return { user: conta.user };
}
export async function createUserWithEmailAndPassword(auth, email, password) {
  const c = contas();
  const e = email.toLowerCase();
  if (c[e]) throw erro("auth/email-already-in-use");
  if ((password || "").length < 6) throw erro("auth/weak-password");
  const u = { uid: "uid-" + e, email: e, displayName: "" };
  c[e] = { password, user: u };
  salvaContas(c);
  write(u); return { user: u };
}
export async function signOut() { write(null); }
