// Mascotes do CaloriQuest: o cachorro (proteína) e o gato (água).
// Cada um pode ser ligado/desligado no Perfil e caminha ao lado do personagem.
//
// Cachorro: fica mais forte conforme você bate a meta de proteína do dia.
//   magro (<40%) → normal (<80%) → bombado (>=80%)
// Gato: murcha conforme o dia passa sem você beber água.
//   murcho (<40% do esperado) → normal (<85%) → feliz/animado (>=85%)

const MascotLogic = (() => {
  // Estágio do cachorro pela proteína consumida
  function dogStage(state) {
    const day = state.days[dayKey()];
    const goal = proteinGoal(state.profile);
    const got = dayTotals(day).protein;
    const pct = goal > 0 ? got / goal : 0;
    return {
      stage: pct >= 0.8 ? "buff" : pct >= 0.4 ? "normal" : "skinny",
      got: Math.round(got),
      goal,
      pct: Math.min(1.5, pct),
    };
  }

  // Estágio do gato pela água — comparada ao que se espera ATÉ AGORA no dia,
  // não com a meta cheia (senão ele passaria a manhã inteira murcho).
  function catStage(state) {
    const day = state.days[dayKey()];
    const totals = dayTotals(day);
    const goal = waterGoal(state.profile, totals.burned);
    const expected = goal * fracOfDay();
    const pct = expected > 0 ? totals.water / expected : 1;
    return {
      stage: pct >= 0.85 ? "happy" : pct >= 0.4 ? "normal" : "dry",
      got: Math.round(totals.water),
      goal,
      pct: Math.min(1.5, pct),
      pctOfGoal: goal > 0 ? totals.water / goal : 0,
    };
  }

  // ===== Dicas =====
  // Cada dica tem uma condição; as de prioridade maior aparecem primeiro.
  // O bicho "fala" uma por vez, em rodízio, enquanto caminha.
  const DOG_TIPS = [
    { pri: 10, when: (c) => !c.weighedToday && c.hour < 12,
      txt: () => "Já subiu na balança hoje? De manhã, em jejum, é a melhor hora! ⚖️" },
    { pri: 9, when: (c) => c.dog.pct < 0.3 && c.hour >= 14,
      txt: (c) => `Faltam ${c.dog.goal - c.dog.got}g de proteína hoje. Um filé de frango resolve 36g! 🍗` },
    { pri: 8, when: (c) => c.dog.pct >= 1,
      txt: () => "Meta de proteína batida! Assim o músculo fica e só a gordura sai. 💪" },
    { pri: 7, when: (c) => c.surplus,
      txt: () => "Passamos das calorias hoje. Que tal uma caminhada de 20 min pra compensar? 🚶" },
    { pri: 6, when: (c) => c.meals === 0 && c.hour >= 10,
      txt: () => "Nada registrado ainda hoje. Anota o que você comeu pra eu poder te ajudar! 📝" },
    { pri: 5, when: (c) => c.exKcal === 0 && c.hour >= 16,
      txt: () => "Nenhum exercício hoje ainda. 20 minutos já fazem diferença no fim do mês!" },
    { pri: 4, when: (c) => c.deficit > 500,
      txt: (c) => `${Math.round(c.deficit)} kcal de déficit hoje. Nesse ritmo a meta chega antes! 🔥` },
    { pri: 3, when: (c) => c.streak >= 3,
      txt: (c) => `${c.streak} dias seguidos no déficit. Não quebra a corrente agora! 🔥` },
    { pri: 2, when: () => true,
      txt: () => "Proteína em toda refeição segura a fome e preserva músculo. 🥚" },
    { pri: 2, when: () => true,
      txt: () => "Dormir 7h ajuda a emagrecer: sono curto aumenta a fome no dia seguinte. 😴" },
    { pri: 2, when: () => true,
      txt: () => "Comeu devagar? O cérebro leva 20 min pra sentir saciedade. 🍽️" },
    { pri: 2, when: (c) => c.hour >= 20,
      txt: () => "Depois do jantar, a cozinha fecha. Jejum da noite já começou! 🌙" },
  ];

  const CAT_TIPS = [
    { pri: 10, when: (c) => c.cat.stage === "dry",
      txt: () => "Miau… estou secando aqui. Bebe um copo d'água comigo? 💧" },
    { pri: 9, when: (c) => c.cat.pctOfGoal >= 1,
      txt: () => "Meta de água batida! Hidratado o corpo queima melhor. 💦" },
    { pri: 6, when: (c) => c.hour >= 6 && c.hour < 10,
      txt: () => "Primeiro copo do dia é o mais importante. Bebe antes do café! 🌅" },
    { pri: 5, when: (c) => c.exKcal > 200,
      txt: () => "Você suou hoje — repõe a água que perdeu no exercício. 🥤" },
    { pri: 2, when: () => true,
      txt: () => "Às vezes a fome é sede disfarçada. Bebe água e espera 10 min. 😼" },
    { pri: 2, when: () => true,
      txt: () => "Um copo de água antes da refeição ajuda a comer menos. 💧" },
  ];

  // Monta o contexto que as dicas consultam
  function context(state) {
    const day = state.days[dayKey()] || { foods: [], ex: [] };
    const totals = dayTotals(day);
    const deficit = todayDeficitSoFar(state);
    return {
      hour: new Date().getHours(),
      meals: (day.foods || []).length,
      exKcal: totals.burned,
      deficit,
      surplus: deficit < 0,
      streak: typeof streak === "function" ? streak() : 0,
      weighedToday: state.weights.some((w) => w.d === dayKey()),
      dog: dogStage(state),
      cat: catStage(state),
    };
  }

  // Escolhe a próxima dica: sorteia entre as de maior prioridade disponíveis,
  // evitando repetir a última que foi mostrada.
  function nextTip(state, who, lastTxt) {
    const ctx = context(state);
    const pool = (who === "cat" ? CAT_TIPS : DOG_TIPS).filter((t) => t.when(ctx));
    if (!pool.length) return null;
    const top = Math.max(...pool.map((t) => t.pri));
    let best = pool.filter((t) => t.pri === top).map((t) => t.txt(ctx));
    const fresh = best.filter((t) => t !== lastTxt);
    const choices = fresh.length ? fresh : best;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  return { dogStage, catStage, nextTip };
})();
