// CaloriQuest — lógica do app (estado, UI, gamificação)

const STORE_KEY = "cq_v1";

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* estado corrompido: recomeça */ }
  return { profile: null, weights: [], days: {}, xp: 0, awarded: {} };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function today() {
  if (!state.days[dayKey()]) state.days[dayKey()] = { foods: [], ex: [], done: {} };
  return state.days[dayKey()];
}

// ===== XP / nível / streak =====
function level() { return Math.floor(Math.sqrt(state.xp / 100)) + 1; }
function xpIntoLevel() {
  const lv = level();
  const base = (lv - 1) ** 2 * 100;
  const next = lv ** 2 * 100;
  return (state.xp - base) / (next - base);
}

function addXp(n, why) {
  const before = level();
  state.xp += n;
  saveState();
  toast(`+${n} XP — ${why}`);
  if (level() > before) setTimeout(() => toast(`🎉 Subiu para o nível ${level()}!`), 1400);
  renderHeader();
}

function streak() {
  let s = 0;
  const d = new Date();
  // hoje conta se já está em déficit com refeições registradas
  const t = state.days[dayKey(d)];
  if (t && t.foods.length && dayDeficit(t, state.profile) > 0) s++;
  for (let i = 1; i < 365; i++) {
    d.setDate(d.getDate() - 1);
    const day = state.days[dayKey(new Date(d))];
    if (day && day.foods.length && dayDeficit(day, state.profile) > 0) s++;
    else break;
  }
  return s;
}

// Prêmios retroativos: dias passados fechados em déficit + desafios de "fechar o dia"
function awardPastDays() {
  const tk = dayKey();
  let gained = 0;
  for (const k of Object.keys(state.days).sort()) {
    if (k >= tk || state.awarded[k]) continue;
    const day = state.days[k];
    if (!day.foods || !day.foods.length) continue;
    state.awarded[k] = true;
    const def = dayDeficit(day, state.profile);
    if (def > 0) gained += 30;
    const totals = { ...dayTotals(day), deficit: def, meals: day.foods.length };
    for (const ch of dailyChallenges(k)) {
      if (ch.type === "endday" && !day.done?.[ch.id] && ch.check(totals)) {
        gained += ch.xp;
        (day.done ||= {})[ch.id] = true;
      }
    }
  }
  if (gained > 0) {
    state.xp += gained;
    saveState();
    setTimeout(() => toast(`🌅 Dias anteriores fechados: +${gained} XP!`), 800);
  }
}

// ===== Toast =====
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

// ===== Onboarding / Perfil =====
const PROFILE_FIELDS = [
  ["name", "Nome", "text"],
  ["age", "Idade", "number"],
  ["height", "Altura (cm)", "number"],
  ["weight", "Peso atual (kg)", "number"],
  ["targetWeight", "Peso desejado (kg)", "number"],
  ["targetDate", "Data da meta", "date"],
];

function readProfileForm(form) {
  const fd = new FormData(form);
  return {
    name: fd.get("name").toString().trim(),
    sex: fd.get("sex"),
    age: +fd.get("age"),
    height: +fd.get("height"),
    weight: +fd.get("weight"),
    targetWeight: +fd.get("targetWeight"),
    targetDate: fd.get("targetDate"),
    activity: fd.get("activity"),
  };
}

function setupOnboarding() {
  const ob = document.getElementById("onboarding");
  ob.classList.remove("hidden");
  const dateInput = document.querySelector('#ob-form [name="targetDate"]');
  const d = new Date();
  d.setDate(d.getDate() + 90);
  dateInput.value = dayKey(d);
  dateInput.min = dayKey(new Date(Date.now() + 86400000));

  document.getElementById("ob-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    state.profile = readProfileForm(ev.target);
    state.weights.push({ d: dayKey(), kg: state.profile.weight });
    saveState();
    ob.classList.add("hidden");
    startApp();
    toast(`Bem-vindo(a), ${state.profile.name}! 🏁`);
  });
}

function renderProfileForm() {
  const p = state.profile;
  const f = document.getElementById("profile-form");
  f.innerHTML = `
    <label>Nome <input name="name" value="${p.name}" required maxlength="30" /></label>
    <div class="row2">
      <label>Sexo
        <select name="sex">
          <option value="m" ${p.sex === "m" ? "selected" : ""}>Masculino</option>
          <option value="f" ${p.sex === "f" ? "selected" : ""}>Feminino</option>
        </select>
      </label>
      <label>Idade <input name="age" type="number" value="${p.age}" min="10" max="100" required /></label>
    </div>
    <div class="row2">
      <label>Altura (cm) <input name="height" type="number" value="${p.height}" min="120" max="230" required /></label>
      <label>Peso atual (kg) <input name="weight" type="number" value="${p.weight}" step="0.1" min="35" max="300" required /></label>
    </div>
    <label>Nível de atividade
      <select name="activity">
        ${["sedentario", "leve", "moderado", "intenso"].map((a) =>
          `<option value="${a}" ${p.activity === a ? "selected" : ""}>${a[0].toUpperCase() + a.slice(1)}</option>`).join("")}
      </select>
    </label>
    <div class="row2">
      <label>Peso desejado (kg) <input name="targetWeight" type="number" value="${p.targetWeight}" step="0.1" min="35" max="300" required /></label>
      <label>Data da meta <input name="targetDate" type="date" value="${p.targetDate}" required /></label>
    </div>
    <button type="submit" class="btn-primary">Salvar alterações</button>
  `;
  f.onsubmit = (ev) => {
    ev.preventDefault();
    state.profile = readProfileForm(f);
    saveState();
    toast("Perfil atualizado! ✅");
    renderAll();
  };
}

// ===== Aba Hoje =====
let qty = 1;
let pendingCustomName = null;

function setupFoodInput() {
  const input = document.getElementById("food-input");
  const sug = document.getElementById("food-suggest");
  const customWrap = document.getElementById("custom-kcal-wrap");

  input.addEventListener("input", () => {
    const q = input.value;
    customWrap.classList.add("hidden");
    if (q.trim().length < 2) return sug.classList.add("hidden");
    const results = searchFoods(q);
    if (!results.length) {
      sug.classList.add("hidden");
      pendingCustomName = q.trim();
      customWrap.classList.remove("hidden");
      return;
    }
    sug.innerHTML = results
      .map((f, i) =>
        `<button type="button" data-i="${i}">
           <span>${f.n}<span class="s-portion">${f.p}</span></span>
           <span class="s-kcal">${f.k} kcal</span>
         </button>`)
      .join("");
    sug.classList.remove("hidden");
    sug.querySelectorAll("button").forEach((b, i) => {
      b.addEventListener("click", () => {
        addFood(results[i]);
        input.value = "";
        sug.classList.add("hidden");
      });
    });
  });

  document.addEventListener("click", (e) => {
    if (!sug.contains(e.target) && e.target !== input) sug.classList.add("hidden");
  });

  document.getElementById("qty-minus").onclick = () => setQty(qty - 1);
  document.getElementById("qty-plus").onclick = () => setQty(qty + 1);

  document.getElementById("custom-add").onclick = () => {
    const kcal = +document.getElementById("custom-kcal").value;
    if (!pendingCustomName || !kcal) return;
    addFood({ n: pendingCustomName, p: "porção estimada", k: Math.ceil(kcal) });
    input.value = "";
    document.getElementById("custom-kcal").value = "";
    customWrap.classList.add("hidden");
  };
}

function setQty(v) {
  qty = Math.min(9, Math.max(1, v));
  document.getElementById("qty-val").textContent = qty;
}

function addFood(f) {
  today().foods.push({ n: f.n, p: f.p, kcal: f.k, qty });
  saveState();
  if (today().foods.length === 1) addXp(5, "primeiro registro do dia");
  setQty(1);
  renderToday();
}

function setupExercise() {
  const sel = document.getElementById("ex-select");
  sel.innerHTML = EXERCISE_DB.map((e, i) => `<option value="${i}">${e.n}</option>`).join("");
  document.getElementById("ex-add-btn").onclick = () => {
    const ex = EXERCISE_DB[+sel.value];
    const min = +document.getElementById("ex-min").value || 0;
    if (min <= 0) return;
    // exercício arredonda PARA BAIXO — não superestimar a queima
    const kcal = Math.floor(ex.met * state.profile.weight * 0.0175 * min);
    today().ex.push({ n: `${ex.n} (${min} min)`, kcal });
    saveState();
    toast(`🔥 +${kcal} kcal queimadas!`);
    renderToday();
  };
}

function renderToday() {
  const day = today();
  const t = dayTotals(day);
  const out = tdee(state.profile) + t.burned;
  const balance = out - t.eaten;

  document.getElementById("c-eaten").textContent = t.eaten;
  document.getElementById("c-burn").textContent = out;
  const bal = document.getElementById("c-balance");
  const balCard = document.getElementById("c-balance-card");
  bal.textContent = Math.abs(Math.round(balance));
  document.getElementById("c-balance-lbl").textContent = balance >= 0 ? "déficit" : "superávit";
  balCard.classList.toggle("good", balance >= 0);
  balCard.classList.toggle("bad", balance < 0);

  // projeção
  const proj = projection(state);
  const line = document.getElementById("proj-line");
  if (!dayStarted()) {
    line.textContent = "Pese-se ou registre a 1ª refeição para dar o start no dia 🌅";
  } else if (proj && state.profile.targetWeight < state.profile.weight) {
    const eta = proj.etaDate
      ? `você chega aos <b>${fmtKg(state.profile.targetWeight)}</b> em <b>${fmtDate(proj.etaDate)}</b>`
      : `a meta ainda não vem — precisa de déficit!`;
    line.innerHTML = `Mantendo essa média (${proj.avgDeficit} kcal/dia), ${eta} · ritmo: ${proj.kgPerWeek > 0 ? "−" : "+"}${Math.abs(proj.kgPerWeek).toFixed(1)} kg/sem`;
  } else {
    line.textContent = "Registre suas refeições para ver a projeção da sua meta.";
  }

  renderItemList("food-list", day.foods, (f, i) => `
    <span class="i-name">${f.qty > 1 ? f.qty + "× " : ""}${f.n}<span class="i-portion">${f.p}</span></span>
    <span class="i-kcal">${f.kcal * f.qty} kcal</span>
    <button class="i-del" data-del-food="${i}">✕</button>`,
    "Nada registrado ainda. O que você comeu hoje?");

  renderItemList("ex-list", day.ex, (e, i) => `
    <span class="i-name">${e.n}</span>
    <span class="i-kcal">−${e.kcal} kcal</span>
    <button class="i-del" data-del-ex="${i}">✕</button>`,
    "Nenhum exercício hoje — que tal uma caminhada? 😉");

  document.querySelectorAll("[data-del-food]").forEach((b) =>
    b.addEventListener("click", () => {
      today().foods.splice(+b.dataset.delFood, 1);
      saveState();
      renderToday();
    }));
  document.querySelectorAll("[data-del-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      today().ex.splice(+b.dataset.delEx, 1);
      saveState();
      renderToday();
    }));

  updateMood();
  renderWeighCard();
  renderHeader();
  renderChallenges();
}

function renderItemList(id, items, tpl, emptyMsg) {
  const ul = document.getElementById(id);
  ul.innerHTML = items.length
    ? items.map((it, i) => `<li>${tpl(it, i)}</li>`).join("")
    : `<li class="empty-note">${emptyMsg}</li>`;
}

// O dia só "dá o start" quando a pessoa registra algo: refeição, exercício ou pesagem
function dayStarted() {
  const day = state.days[dayKey()];
  const weighedToday = state.weights.some((w) => w.d === dayKey());
  return !!(day && (day.foods.length || day.ex.length)) || weighedToday;
}

function updateMood() {
  const mood = dayStarted() ? moodFromRatio(paceRatio(state)) : "idle";
  GameScene.setMood(mood);
  const info = MOOD_INFO[mood];
  document.getElementById("mood-label").textContent = `${info.emoji} ${info.label}`;
}

// Card de pesagem matinal: sempre convida, nunca obriga (nem todo dia tem balança)
function renderWeighCard() {
  const card = document.getElementById("weigh-card");
  const weighedToday = state.weights.some((w) => w.d === dayKey());
  card.classList.toggle("hidden", weighedToday || !!today().weighSkipped);
}

function logWeight(kg) {
  const k = dayKey();
  state.weights = state.weights.filter((w) => w.d !== k);
  state.weights.push({ d: k, kg });
  state.weights.sort((a, b) => (a.d < b.d ? -1 : 1));
  state.profile.weight = kg;
  saveState();
}

function setupWeighCard() {
  document.getElementById("morning-weight-save").onclick = () => {
    const kg = +document.getElementById("morning-weight").value;
    if (!kg || kg < 35 || kg > 300) return toast("Peso inválido 🤔");
    logWeight(kg);
    document.getElementById("morning-weight").value = "";
    addXp(15, "pesagem em jejum");
    renderToday();
    renderProgress();
  };
  document.getElementById("morning-weight-skip").onclick = () => {
    today().weighSkipped = true;
    saveState();
    toast("Tranquilo! Amanhã a gente pergunta de novo 😉");
    renderWeighCard();
  };
}

function renderHeader() {
  document.getElementById("hdr-level").textContent = `Nv ${level()}`;
  document.getElementById("hdr-streak").textContent = `🔥 ${streak()}`;
  document.getElementById("xp-fill").style.width = `${Math.round(xpIntoLevel() * 100)}%`;
}

// ===== Desafios =====
function renderChallenges() {
  const day = today();
  const def = dayDeficit(day, state.profile);
  const totals = { ...dayTotals(day), deficit: def, meals: day.foods.length };
  const list = document.getElementById("challenge-list");
  list.innerHTML = "";

  for (const ch of dailyChallenges(dayKey())) {
    const done = !!day.done?.[ch.id];
    const el = document.createElement("div");
    el.className = "challenge" + (done ? " done" : "");
    let action = "";
    let meta = `+${ch.xp} XP`;

    if (done) {
      action = `<span class="ch-check">✅</span>`;
    } else if (ch.type === "manual") {
      action = `<button class="ch-btn" data-ch="${ch.id}">Feito!</button>`;
    } else if (ch.type === "auto") {
      meta += ` · ${ch.prog ? ch.prog(totals) : ""}`;
      action = ch.check(totals)
        ? `<button class="ch-btn" data-ch="${ch.id}">Resgatar</button>`
        : `<button class="ch-btn" disabled>Em andamento</button>`;
    } else {
      // endday: validado no fechamento do dia
      meta += " · válido ao fechar o dia";
      action = ch.check(totals)
        ? `<span class="ch-check" title="No caminho certo!">🌟</span>`
        : `<button class="ch-btn" disabled>Em andamento</button>`;
    }

    el.innerHTML = `
      <div class="ch-body">
        <div class="ch-txt">${ch.txt}</div>
        <div class="ch-meta">${meta}</div>
      </div>
      ${action}`;
    list.appendChild(el);
  }

  list.querySelectorAll("[data-ch]").forEach((b) =>
    b.addEventListener("click", () => {
      const ch = CHALLENGE_DB.find((c) => c.id === b.dataset.ch);
      (today().done ||= {})[ch.id] = true;
      saveState();
      addXp(ch.xp, `desafio: ${ch.txt}`);
      renderChallenges();
    }));
}

// ===== Progresso =====
function setupProgress() {
  document.getElementById("weight-add").onclick = () => {
    const kg = +document.getElementById("weight-input").value;
    if (!kg || kg < 35 || kg > 300) return toast("Peso inválido 🤔");
    logWeight(kg);
    document.getElementById("weight-input").value = "";
    toast("Peso registrado! ⚖️");
    renderProgress();
    renderToday();
  };
}

function renderProgress() {
  drawWeightChart();
  const p = state.profile;
  const proj = projection(state);
  const req = requiredDailyDeficit(p);
  const rows = [
    ["Peso atual", fmtKg(p.weight)],
    ["Meta", `${fmtKg(p.targetWeight)} até ${fmtDate(new Date(p.targetDate + "T12:00:00"))}`],
    ["Taxa basal (BMR)", `${bmr(p)} kcal/dia`],
    ["Gasto diário estimado", `${tdee(p)} kcal/dia`],
    ["Déficit necessário p/ meta", req > 0 ? `${Math.ceil(req)} kcal/dia` : "— (manutenção)"],
  ];
  if (proj) {
    rows.push(["Sua média de déficit", `${proj.avgDeficit} kcal/dia`]);
    rows.push(["Seu ritmo", `${proj.kgPerWeek >= 0 ? "−" : "+"}${Math.abs(proj.kgPerWeek).toFixed(2)} kg/semana`]);
    rows.push(["Peso previsto na data da meta", fmtKg(proj.weightAtTarget)]);
    if (proj.etaDate) rows.push(["Previsão de bater a meta", fmtDate(proj.etaDate)]);
  }
  rows.push(["Sequência em déficit", `${streak()} dia(s) 🔥`]);
  rows.push(["XP total", `${state.xp} (nível ${level()})`]);
  document.getElementById("progress-stats").innerHTML = rows
    .map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`)
    .join("");
}

function drawWeightChart() {
  const cv = document.getElementById("weight-chart");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || cv.parentElement.clientWidth - 28;
  const h = 180;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const ws = state.weights;
  const target = state.profile.targetWeight;
  if (!ws.length) return;

  const kgs = [...ws.map((x) => x.kg), target];
  let min = Math.min(...kgs) - 1, max = Math.max(...kgs) + 1;
  const pad = { l: 38, r: 10, t: 12, b: 22 };
  const X = (i) => pad.l + (i / Math.max(1, ws.length - 1)) * (w - pad.l - pad.r);
  const Y = (kg) => pad.t + (1 - (kg - min) / (max - min)) * (h - pad.t - pad.b);

  // eixos e linhas de grade
  ctx.strokeStyle = "#e3e9f4";
  ctx.fillStyle = "#8a93ab";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const kg = min + ((max - min) * i) / 4;
    const y = Y(kg);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(kg.toFixed(1), pad.l - 5, y + 3);
  }

  // linha da meta
  ctx.strokeStyle = "#2f9e58";
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(pad.l, Y(target)); ctx.lineTo(w - pad.r, Y(target)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#2f9e58";
  ctx.textAlign = "left";
  ctx.fillText(`meta ${target}`, pad.l + 4, Y(target) - 5);

  // série de pesos
  ctx.strokeStyle = "#e04848";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ws.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.kg)) : ctx.moveTo(X(i), Y(p.kg))));
  ctx.stroke();
  ctx.fillStyle = "#e04848";
  ws.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(X(i), Y(p.kg), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // datas nas pontas
  ctx.fillStyle = "#8a93ab";
  ctx.textAlign = "left";
  ctx.fillText(ws[0].d.slice(5).split("-").reverse().join("/"), pad.l, h - 6);
  if (ws.length > 1) {
    ctx.textAlign = "right";
    ctx.fillText(ws[ws.length - 1].d.slice(5).split("-").reverse().join("/"), w - pad.r, h - 6);
  }
}

// ===== Navegação =====
function setupTabs() {
  document.querySelectorAll(".bottomnav button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".bottomnav button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
      document.getElementById("tab-" + b.dataset.tab).classList.remove("hidden");
      if (b.dataset.tab === "progresso") renderProgress();
      if (b.dataset.tab === "desafios") renderChallenges();
      if (b.dataset.tab === "perfil") renderProfileForm();
    }));
}

function renderAll() {
  renderHeader();
  renderToday();
  renderChallenges();
  renderProgress();
  renderProfileForm();
}

function startApp() {
  document.getElementById("app").classList.remove("hidden");
  GameScene.init(document.getElementById("scene"));
  awardPastDays();
  setupFoodInput();
  setupExercise();
  setupWeighCard();
  setupProgress();
  setupTabs();
  renderAll();
  // reavalia o clima de tempos em tempos (o dia passa, o gasto proporcional muda)
  setInterval(updateMood, 60000);
}

// ===== Boot =====
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js").catch(() => {});

if (state.profile) startApp();
else setupOnboarding();
