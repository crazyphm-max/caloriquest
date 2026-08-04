const K = "__fake_db";
const db = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch { return {}; } };
const save = (d) => localStorage.setItem(K, JSON.stringify(d));
export function getFirestore() { return { id: "db" }; }
export function doc(_db, col, id) { return `${col}/${id}`; }
export async function getDoc(ref) {
  const d = db()[ref];
  return { exists: () => !!d, data: () => d };
}
export async function setDoc(ref, value) {
  const all = db(); all[ref] = value; save(all);
  window.__fake.gravacoes = (window.__fake.gravacoes || 0) + 1;
}
export function serverTimestamp() { return "SERVER_TS"; }
