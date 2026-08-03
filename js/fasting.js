// Modo jejum intermitente: relógio, fases metabólicas e histórico.
//
// As fases seguem o que a literatura descreve sobre o que acontece no corpo ao
// longo do jejum — queda da insulina, esgotamento do glicogênio, cetose e
// autofagia. São marcos aproximados: variam com a pessoa, o que ela comeu antes
// e o quanto se exercita.

const FASTING_PROTOCOLS = [
  { id: "12-12", h: 12, name: "12/12", desc: "Iniciante — 12h de jejum, 12h comendo" },
  { id: "14-10", h: 14, name: "14/10", desc: "Suave — bom para começar a acelerar" },
  { id: "16-8", h: 16, name: "16/8", desc: "O mais popular — autofagia começa" },
  { id: "18-6", h: 18, name: "18/6", desc: "Avançado — cetose firme" },
  { id: "20-4", h: 20, name: "20/4", desc: "Guerreiro — só uma janela curta" },
  { id: "omad", h: 23, name: "OMAD", desc: "Uma refeição por dia" },
];

const FASTING_PHASES = [
  { h: 0, icon: "🍽️", title: "Digestão",
    txt: "Seu corpo está processando a última refeição. A insulina está alta e a energia vem direto da comida." },
  { h: 4, icon: "📉", title: "Insulina caindo",
    txt: "A glicose do sangue normaliza e a insulina começa a cair — é ela que trava a queima de gordura." },
  { h: 8, icon: "🔋", title: "Queimando as reservas",
    txt: "O glicogênio do fígado está sendo consumido. O corpo começa a virar a chave para a gordura." },
  { h: 12, icon: "🔥", title: "Queima de gordura",
    txt: "Glicogênio quase no fim: a lipólise acelera e as primeiras cetonas aparecem. Aqui a gordura vira combustível." },
  { h: 14, icon: "💪", title: "Hormônio do crescimento",
    txt: "O GH sobe bastante, o que ajuda a preservar músculo enquanto você perde gordura." },
  { h: 16, icon: "🧹", title: "Autofagia",
    txt: "Começa a faxina celular: o corpo recicla proteínas e estruturas danificadas. É o marco do 16/8." },
  { h: 18, icon: "⚡", title: "Cetose firme",
    txt: "As cetonas viram combustível principal do cérebro. Muita gente relata clareza mental e fome menor." },
  { h: 20, icon: "✨", title: "Autofagia acelerada",
    txt: "A reciclagem celular intensifica e a inflamação tende a cair." },
  { h: 24, icon: "🏆", title: "Cetose plena",
    txt: "Um dia inteiro: glicogênio esgotado, queima de gordura no máximo. Daqui pra frente, só com orientação médica." },
];

const Fasting = (() => {
  // Jejum em andamento (ou null)
  function current(state) {
    return state.fast || null;
  }

  function elapsedMs(state, now = Date.now()) {
    const f = current(state);
    if (!f) return 0;
    return Math.max(0, now - new Date(f.start).getTime());
  }

  function elapsedHours(state, now = Date.now()) {
    return elapsedMs(state, now) / 3600000;
  }

  // Fase atual e a próxima a ser alcançada
  function phaseAt(hours) {
    let cur = FASTING_PHASES[0];
    let next = null;
    for (const p of FASTING_PHASES) {
      if (hours >= p.h) cur = p;
      else { next = p; break; }
    }
    return { current: cur, next };
  }

  function start(state, startedAt = new Date(), goalHours = 16) {
    state.fast = { start: new Date(startedAt).toISOString(), goal: goalHours };
  }

  // Encerra e devolve o registro (para XP e histórico)
  function stop(state, endedAt = new Date()) {
    const f = current(state);
    if (!f) return null;
    const hours = Math.max(0, (new Date(endedAt) - new Date(f.start)) / 3600000);
    const record = {
      start: f.start,
      end: new Date(endedAt).toISOString(),
      hours: Math.round(hours * 10) / 10,
      goal: f.goal,
    };
    (state.fastHistory ||= []).push(record);
    if (state.fastHistory.length > 120) state.fastHistory.shift();
    state.fast = null;
    return record;
  }

  // Estatísticas para a tela e para o cálculo de sequência
  function stats(state) {
    const h = state.fastHistory || [];
    const done = h.filter((r) => r.hours >= r.goal);
    const best = h.reduce((m, r) => Math.max(m, r.hours), 0);
    const last7 = h.filter((r) => Date.now() - new Date(r.end) < 7 * 86400000);
    return {
      total: h.length,
      completed: done.length,
      best,
      avg7: last7.length
        ? last7.reduce((s, r) => s + r.hours, 0) / last7.length
        : 0,
      streak: streakDays(h),
    };
  }

  // Dias seguidos (contando de ontem/hoje para trás) com jejum concluído
  function streakDays(history) {
    const days = new Set(
      history.filter((r) => r.hours >= r.goal).map((r) => dayKey(new Date(r.end)))
    );
    let n = 0;
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // hoje ainda pode não ter
    for (let i = 0; i < 365; i++) {
      if (!days.has(dayKey(new Date(d)))) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function fmtDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return {
    current, elapsedMs, elapsedHours, phaseAt, start, stop, stats, fmtDuration,
  };
})();
