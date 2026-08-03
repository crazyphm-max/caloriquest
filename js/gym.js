// Modo academia: registro rápido (só o tempo) ou detalhado (exercício a
// exercício, com séries, repetições e carga).
//
// O gasto calórico sai do MET de cada atividade — a mesma conta do resto do
// app: MET × peso × horas, arredondado para baixo, para nunca superestimar.

// Biblioteca de exercícios: g = grupo, met = intensidade, w = usa carga?
const GYM_EXERCISES = [
  // Peito
  { n: "Supino reto", g: "Peito", met: 5.0, w: true },
  { n: "Supino inclinado", g: "Peito", met: 5.0, w: true },
  { n: "Crucifixo", g: "Peito", met: 4.0, w: true },
  { n: "Crossover", g: "Peito", met: 4.0, w: true },
  { n: "Flexão de braço", g: "Peito", met: 4.5, w: false },
  // Costas
  { n: "Puxada frontal", g: "Costas", met: 5.0, w: true },
  { n: "Remada curvada", g: "Costas", met: 5.5, w: true },
  { n: "Remada baixa", g: "Costas", met: 5.0, w: true },
  { n: "Barra fixa", g: "Costas", met: 6.0, w: false },
  { n: "Levantamento terra", g: "Costas", met: 6.0, w: true },
  // Pernas
  { n: "Agachamento livre", g: "Pernas", met: 6.0, w: true },
  { n: "Leg press", g: "Pernas", met: 5.5, w: true },
  { n: "Cadeira extensora", g: "Pernas", met: 4.5, w: true },
  { n: "Mesa flexora", g: "Pernas", met: 4.5, w: true },
  { n: "Afundo", g: "Pernas", met: 5.5, w: true },
  { n: "Panturrilha", g: "Pernas", met: 4.0, w: true },
  { n: "Stiff", g: "Pernas", met: 5.5, w: true },
  // Ombro e braço
  { n: "Desenvolvimento", g: "Ombro", met: 5.0, w: true },
  { n: "Elevação lateral", g: "Ombro", met: 4.0, w: true },
  { n: "Encolhimento", g: "Ombro", met: 4.0, w: true },
  { n: "Rosca direta", g: "Bíceps", met: 4.0, w: true },
  { n: "Rosca martelo", g: "Bíceps", met: 4.0, w: true },
  { n: "Tríceps pulley", g: "Tríceps", met: 4.0, w: true },
  { n: "Tríceps testa", g: "Tríceps", met: 4.0, w: true },
  { n: "Mergulho no banco", g: "Tríceps", met: 4.5, w: false },
  // Core
  { n: "Abdominal", g: "Core", met: 3.8, w: false },
  { n: "Prancha", g: "Core", met: 3.5, w: false },
  { n: "Elevação de pernas", g: "Core", met: 4.0, w: false },
  // Aeróbico
  { n: "Esteira caminhada", g: "Aeróbico", met: 4.0, w: false },
  { n: "Esteira corrida", g: "Aeróbico", met: 9.0, w: false },
  { n: "Bicicleta ergométrica", g: "Aeróbico", met: 6.5, w: false },
  { n: "Elíptico", g: "Aeróbico", met: 5.5, w: false },
  { n: "Escada (simulador)", g: "Aeróbico", met: 9.0, w: false },
  { n: "Remo ergômetro", g: "Aeróbico", met: 7.0, w: false },
  { n: "Pular corda", g: "Aeróbico", met: 11.0, w: false },
  { n: "Spinning", g: "Aeróbico", met: 8.5, w: false },
  { n: "Natação", g: "Aeróbico", met: 7.0, w: false },
  { n: "Funcional / HIIT", g: "Aeróbico", met: 8.0, w: false },
];

// MET médio de uma sessão genérica, para o registro rápido
const GYM_QUICK = {
  musculacao: { n: "Musculação", met: 5.0 },
  aerobico: { n: "Aeróbico", met: 7.0 },
};

const Gym = (() => {
  // kcal = MET × peso(kg) × horas — arredondado para baixo
  function kcal(met, minutes, weightKg) {
    return Math.floor(met * weightKg * (minutes / 60));
  }

  function search(query, limit = 8) {
    const q = normalizeTxt(query);
    if (!q) return [];
    const scored = [];
    for (const e of GYM_EXERCISES) {
      const nm = normalizeTxt(e.n);
      const grp = normalizeTxt(e.g);
      let s = -1;
      if (nm === q) s = 100;
      else if (nm.startsWith(q)) s = 80;
      else if (nm.includes(q)) s = 50;
      else if (grp.startsWith(q)) s = 30;
      if (s > 0) scored.push([s, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, limit).map((x) => x[1]);
  }

  // Volume de carga do dia (kg levantados) = séries × reps × carga
  function volume(day) {
    return (day?.gym || []).reduce(
      (s, e) => s + (e.sets || 0) * (e.reps || 0) * (e.load || 0), 0
    );
  }

  // Minutos por tipo, para o resumo da sessão
  function summary(day) {
    const items = day?.gym || [];
    let strength = 0, cardio = 0, kcalTotal = 0;
    for (const e of items) {
      if (e.group === "Aeróbico") cardio += e.min || 0;
      else strength += e.min || 0;
      kcalTotal += e.kcal || 0;
    }
    return {
      strength, cardio, total: strength + cardio,
      kcal: kcalTotal, volume: volume(day), count: items.length,
    };
  }

  // Última carga usada num exercício (para sugerir progressão)
  function lastLoad(state, exerciseName) {
    const keys = Object.keys(state.days).sort().reverse();
    for (const k of keys) {
      const found = (state.days[k].gym || [])
        .filter((e) => e.n === exerciseName && e.load)
        .pop();
      if (found) return { load: found.load, reps: found.reps, day: k };
    }
    return null;
  }

  // Grupos musculares treinados nos últimos dias (para o resumo semanal)
  function weekGroups(state) {
    const counts = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      for (const e of state.days[dayKey(d)]?.gym || []) {
        counts[e.group] = (counts[e.group] || 0) + 1;
      }
    }
    return counts;
  }

  return { kcal, search, volume, summary, lastLoad, weekGroups };
})();
