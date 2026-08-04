// Testa o login e a sincronização do CaloriQuest de ponta a ponta, num
// navegador de verdade, contra um Firebase de mentira (a pasta fake/).
//
//   npm i playwright && npx playwright install chromium
//   node tools/test-login/run.mjs
//
// Por que um Firebase falso: dá para rodar sem internet, sem conta e sem sujar
// o banco de verdade, e ainda assim exercitar o caminho inteiro — entrar com o
// Google, cadastrar por e-mail, gravar na nuvem, recarregar e recuperar os
// dados, sair, senha errada, e a janela bloqueada do celular caindo para o
// redirecionamento.
import { createServer } from "node:http";
import { readFile, cp, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..", "..");
const PORTA = 8097;

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Falta o playwright: npm i playwright && npx playwright install chromium"); process.exit(2); }

// ---- monta uma cópia do site apontando para o Firebase de mentira ----
const site = await mkdtemp(join(tmpdir(), "cq-site-"));
for (const item of ["index.html", "css", "js", "assets", "manifest.webmanifest"])
  await cp(join(raiz, item), join(site, item), { recursive: true });
await cp(join(aqui, "fake"), join(site, "fake"), { recursive: true });
await writeFile(join(site, "js", "firebase-config.js"), `
const FIREBASE_CONFIG = { apiKey: "fake", authDomain: "x.firebaseapp.com", projectId: "teste", appId: "1:2:web:3" };
const FIREBASE_CDN = new URL("fake", location.href).href;
`);

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".webmanifest": "application/manifest+json" };
const servidor = createServer(async (req, res) => {
  const caminho = join(site, normalize(decodeURI(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, ""));
  try {
    const dados = await readFile(caminho);
    res.writeHead(200, { "Content-Type": TIPOS[extname(caminho)] || "application/octet-stream" });
    res.end(dados);
  } catch { res.writeHead(404); res.end("nao achei"); }
});
await new Promise((r) => servidor.listen(PORTA, "127.0.0.1", r));

// ---- verificações ----
let falhas = 0;
const ok = (n) => console.log(`ok      ${n}`);
const eq = (n, a, b) => JSON.stringify(a) === JSON.stringify(b)
  ? ok(n)
  : (falhas++, console.log(`FALHOU  ${n} — esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));

// CHROMIUM=/caminho/do/chrome permite usar um navegador que já está na máquina
const navegador = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}
);
const p = await (await navegador.newContext()).newPage();
const erros = [];
p.on("pageerror", (e) => erros.push(e.message));
// O sw.js não entra na cópia de propósito: com cache pelo meio, "recarregar e
// ver se os dados voltam da nuvem" deixaria de testar a nuvem. O 404 dele é
// esperado, então não conta como erro.
p.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !/404\)? was received when fetching the script/.test(t))
    erros.push(t);
});

const URL_BASE = `http://127.0.0.1:${PORTA}/index.html`;
const abre = async () => { await p.goto(URL_BASE, { waitUntil: "networkidle" }); await p.waitForTimeout(900); };
const telas = () => p.evaluate(() => ["auth", "onboarding", "app"]
  .filter((id) => !document.getElementById(id).classList.contains("hidden")));
const sair = async () => { await p.evaluate(() => Sync.logout()); await abre(); };

await abre();
eq("abre na tela de login", await telas(), ["auth"]);
eq("botão do Google aparece", await p.isVisible("#auth-google-btn"), true);

await p.click("#auth-google-btn");
await p.waitForTimeout(800);
eq("Google leva para o cadastro do perfil", await telas(), ["onboarding"]);

for (const [campo, valor] of [["name", "Miguel"], ["age", "40"], ["height", "178"],
                              ["weight", "98"], ["targetWeight", "85"], ["targetDate", "2026-12-31"]])
  await p.fill(`#ob-form input[name="${campo}"]`, valor);
await p.click('#ob-form button[type="submit"]');
await p.waitForTimeout(2500); // passa do respiro de 1,5s antes de subir
eq("perfil pronto entra no app", (await telas()).includes("app"), true);
eq("gravou na nuvem", await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("__fake_db") || "{}")["users/uid-google"];
  return d ? { email: d.email, nome: JSON.parse(d.state).profile.name } : null;
}), { email: "crazyphm@gmail.com", nome: "Miguel" });

// apaga o cache do aparelho: os dados têm que voltar da nuvem
await p.evaluate(() => Object.keys(localStorage)
  .filter((k) => k.startsWith("cq_")).forEach((k) => localStorage.removeItem(k)));
await abre();
eq("volta logado direto no app", (await telas()).includes("app"), true);
eq("recuperou o perfil da nuvem",
  await p.evaluate(() => document.querySelector('#profile-form input[name="name"]').value), "Miguel");

await sair();
eq("depois de sair pede login", await telas(), ["auth"]);

await p.fill('#auth-form input[name="email"]', "esposa@exemplo.com");
await p.fill('#auth-form input[name="password"]', "segredo123");
await p.click("#auth-register");
await p.waitForTimeout(800);
eq("cadastro por e-mail funciona", (await telas()).includes("onboarding"), true);
eq("a outra conta começa vazia", await p.evaluate(() => state?.profile?.name ?? null), null);

await sair();
await p.fill('#auth-form input[name="email"]', "esposa@exemplo.com");
await p.fill('#auth-form input[name="password"]', "errada999");
await p.click('#auth-form button[type="submit"]');
await p.waitForTimeout(600);
eq("senha errada é barrada", await p.textContent("#auth-msg"), "E-mail ou senha incorretos");
eq("e continua fora", await telas(), ["auth"]);

await p.fill('#auth-form input[name="password"]', "segredo123");
await p.click('#auth-form button[type="submit"]');
await p.waitForTimeout(900);
eq("senha certa entra", (await telas()).includes("auth"), false);

await sair();
await p.evaluate(() => { window.__fake.popupBloqueado = true; });
await p.click("#auth-google-btn");
await p.waitForTimeout(600);
eq("janela bloqueada cai no redirecionamento",
  await p.evaluate(() => window.__fake.calls.map((c) => c.n)), ["popup", "redirect"]);
eq("sem mensagem de erro à toa", await p.textContent("#auth-msg"), "");

if (erros.length) { falhas++; console.log(`\nERROS DE JS:\n${erros.join("\n")}`); }
console.log(falhas ? `\n${falhas} teste(s) falharam` : "\ntodos passaram");

await navegador.close();
servidor.close();
await rm(site, { recursive: true, force: true });
process.exit(falhas ? 1 : 0);
