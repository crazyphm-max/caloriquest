// Cálculos de metabolismo, déficit e projeção do CaloriQuest.

const KCAL_POR_KG = 7700; // ~7700 kcal de déficit = 1 kg de gordura

const ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
};

// Taxa metabólica basal — Mifflin-St Jeor
function bmr(p) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  return Math.round(p.sex === "f" ? base - 161 : base + 5);
}

// Gasto diário total (sem contar exercícios registrados manualmente)
function tdee(p) {
  return Math.round(bmr(p) * (ACTIVITY_FACTORS[p.activity] || 1.2));
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function dayTotals(day) {
  const eaten = (day?.foods || []).reduce((s, f) => s + f.kcal * (f.qty || 1), 0);
  const burned = (day?.ex || []).reduce((s, e) => s + e.kcal, 0);
  return { eaten, burned };
}

// Déficit de um dia completo: gasto total + exercícios - consumido
function dayDeficit(day, profile) {
  const { eaten, burned } = dayTotals(day);
  return tdee(profile) + burned - eaten;
}

// Déficit diário necessário para bater a meta no prazo
function requiredDailyDeficit(profile) {
  const toLose = profile.weight - profile.targetWeight;
  if (toLose <= 0) return 0; // modo manutenção
  const target = new Date(profile.targetDate + "T12:00:00");
  const days = Math.max(1, Math.round((target - new Date()) / 86400000));
  return (toLose * KCAL_POR_KG) / days;
}

// Média de déficit dos últimos N dias com registro (excluindo hoje)
function avgPastDeficit(state, n = 7) {
  const today = dayKey();
  const keys = Object.keys(state.days)
    .filter((k) => k < today && (state.days[k].foods || []).length > 0)
    .sort()
    .slice(-n);
  if (!keys.length) return null;
  const sum = keys.reduce((s, k) => s + dayDeficit(state.days[k], state.profile), 0);
  return sum / keys.length;
}

// Fração "esperada" do dia que já passou (janela alimentar ~5h às 21h)
function fracOfDay(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0.15, (h - 5) / 16));
}

// Déficit de hoje até agora, comparando com o gasto proporcional ao horário
function todayDeficitSoFar(state) {
  const day = state.days[dayKey()] || {};
  const { eaten, burned } = dayTotals(day);
  return tdee(state.profile) * fracOfDay() + burned - eaten;
}

// Ritmo: razão entre o déficit real e o necessário → define o clima do jogo.
// >= 1.25 acelerando | >= 0.7 no ritmo | >= 0.2 caindo | abaixo: regredindo
function paceRatio(state) {
  const req = requiredDailyDeficit(state.profile);
  const frac = fracOfDay();
  const today = state.days[dayKey()];
  const hasToday = today && (today.foods || []).length > 0;
  const past = avgPastDeficit(state);

  // Modo manutenção: só importa não estourar
  if (req <= 0) {
    const d = hasToday ? todayDeficitSoFar(state) : past ?? 0;
    return d >= 0 ? 1 : 0.4;
  }

  const todayRatio = hasToday ? todayDeficitSoFar(state) / (req * frac) : null;
  const pastRatio = past !== null ? past / req : null;

  if (todayRatio !== null && pastRatio !== null)
    return 0.45 * pastRatio + 0.55 * todayRatio;
  if (todayRatio !== null) return todayRatio;
  if (pastRatio !== null) return pastRatio;
  return 1; // sem dados ainda: começa otimista
}

function moodFromRatio(r) {
  if (r >= 1.25) return "run";
  if (r >= 0.7) return "walk";
  if (r >= 0.2) return "slow";
  return "sad";
}

const MOOD_INFO = {
  run: { label: "Acelerando! Você está à frente da meta", emoji: "🏃☀️" },
  walk: { label: "No ritmo! Continue assim", emoji: "🚶☀️" },
  slow: { label: "Caindo o ritmo… dá pra recuperar hoje!", emoji: "🌧️" },
  sad: { label: "Regredindo — hora de reagir!", emoji: "⛈️" },
};

// Projeções: mantendo a média atual, quando chega na meta e qual o peso na data alvo
function projection(state) {
  const p = state.profile;
  const past = avgPastDeficit(state);
  const today = state.days[dayKey()];
  let avg = past;
  if (avg === null && today && (today.foods || []).length > 0)
    avg = todayDeficitSoFar(state) / fracOfDay();
  if (avg === null) return null;

  const kgPerDay = avg / KCAL_POR_KG;
  const toLose = p.weight - p.targetWeight;
  const target = new Date(p.targetDate + "T12:00:00");
  const daysToTarget = Math.max(0, Math.round((target - new Date()) / 86400000));

  let etaDate = null;
  if (avg > 0 && toLose > 0) {
    const days = Math.ceil((toLose * KCAL_POR_KG) / avg);
    if (days < 3650) {
      etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + days);
    }
  }
  return {
    avgDeficit: Math.round(avg),
    kgPerWeek: kgPerDay * 7,
    weightAtTarget: p.weight - kgPerDay * daysToTarget,
    etaDate,
  };
}

function fmtDate(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtKg(x) {
  return x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
