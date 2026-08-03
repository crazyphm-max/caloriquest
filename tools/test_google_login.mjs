// Testa a verificação do ID token do Google feita pela API.
//
//   node tools/test_google_login.mjs
//
// Gera um par de chaves RSA aqui mesmo, assina tokens de mentira e finge ser o
// servidor de chaves do Google. Assim dá pra conferir que um token bom passa e
// que os ruins (assinatura trocada, app errado, vencido) são barrados — sem
// depender de internet nem de conta nenhuma.
import { webcrypto as wc } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const KID = "kid-de-teste";
const CLIENT = "123.apps.googleusercontent.com";

const par = await wc.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]
);
const pub = await wc.subtle.exportKey("jwk", par.publicKey);
const certs = { keys: [{ kid: KID, kty: pub.kty, n: pub.n, e: pub.e, alg: "RS256", use: "sig" }] };
globalThis.fetch = async () => new Response(JSON.stringify(certs));

async function token(payload) {
  const h = b64url(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" }));
  const p = b64url(JSON.stringify(payload));
  const sig = await wc.subtle.sign("RSASSA-PKCS1-v1_5", par.privateKey, Buffer.from(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}

// o arquivo da API tem colchetes no nome e mora num projeto sem package.json;
// copiar como .mjs é o jeito mais simples de o Node importar como módulo
const tmp = join(mkdtempSync(join(tmpdir(), "cq-")), "api.mjs");
writeFileSync(tmp, readFileSync(join(raiz, "functions/api/[[path]].js")));
const { verifyGoogleToken } = await import(pathToFileURL(tmp).href);

const agora = Math.floor(Date.now() / 1000);
const base = {
  iss: "https://accounts.google.com", aud: CLIENT, sub: "u-1",
  email: "Fulano@Gmail.com", email_verified: true, name: "Fulano", exp: agora + 3600,
};

let falhas = 0;
async function checa(nome, fn, deveAceitar) {
  let aceitou = true, motivo = "";
  try { await fn(); } catch (e) { aceitou = false; motivo = e.message; }
  if (aceitou === deveAceitar) return console.log(`ok      ${nome}`);
  falhas++;
  console.log(`FALHOU  ${nome} — ${aceitou ? "passou e não devia" : motivo}`);
}

await checa("token válido", async () => {
  const p = await verifyGoogleToken(await token(base), CLIENT);
  if (p.sub !== "u-1" || p.email !== "Fulano@Gmail.com") throw new Error("payload errado");
}, true);

await checa("assinatura adulterada", async () => {
  const t = (await token(base)).split(".");
  const falso = b64url(JSON.stringify({ ...base, email: "invasor@x.com" }));
  await verifyGoogleToken(`${t[0]}.${falso}.${t[2]}`, CLIENT);
}, false);

await checa("token emitido para outro app",async () => verifyGoogleToken(await token(base), "outro-client"), false);
await checa("emissor errado", async () => verifyGoogleToken(await token({ ...base, iss: "https://evil.com" }), CLIENT), false);
await checa("token vencido", async () => verifyGoogleToken(await token({ ...base, exp: agora - 10 }), CLIENT), false);
await checa("e-mail não verificado", async () => verifyGoogleToken(await token({ ...base, email_verified: false }), CLIENT), false);
await checa("lixo no lugar do token", () => verifyGoogleToken("nao-e-um-jwt", CLIENT), false);
await checa("token vazio", () => verifyGoogleToken(undefined, CLIENT), false);

console.log(falhas ? `\n${falhas} teste(s) falharam` : "\ntodos passaram");
process.exit(falhas ? 1 : 0);
