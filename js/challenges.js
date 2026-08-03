// Desafios diários do CaloriQuest.
// type "auto" é validado pelos dados do dia; "manual" o usuário marca.
const CHALLENGE_DB = [
  { id: "burn150", txt: "Queime 150 kcal em exercício hoje", xp: 40, type: "auto", check: (d) => d.burned >= 150, prog: (d) => `${Math.min(150, d.burned)}/150 kcal` },
  { id: "burn300", txt: "Queime 300 kcal em exercício hoje", xp: 70, type: "auto", check: (d) => d.burned >= 300, prog: (d) => `${Math.min(300, d.burned)}/300 kcal` },
  { id: "log3", txt: "Registre pelo menos 3 refeições hoje", xp: 20, type: "auto", check: (d) => d.meals >= 3, prog: (d) => `${Math.min(3, d.meals)}/3 registros` },
  { id: "deficit300", txt: "Feche o dia com déficit de 300+ kcal", xp: 50, type: "endday", check: (d) => d.deficit >= 300 },
  { id: "deficit500", txt: "Feche o dia com déficit de 500+ kcal", xp: 80, type: "endday", check: (d) => d.deficit >= 500 },
  { id: "nosugar", txt: "Zero doces e sobremesas hoje", xp: 40, type: "manual" },
  { id: "nosoda", txt: "Zero refrigerante e bebida açucarada", xp: 30, type: "manual" },
  { id: "water2l", txt: "Beba pelo menos 2 litros de água", xp: 30, type: "manual" },
  { id: "fast14", txt: "Jejum intermitente: fique 14h sem comer ⏱️", xp: 60, type: "auto",
    check: (d) => d.fastHours >= 14,
    prog: (d) => `${d.fastHours.toFixed(1)}/14 h` },

  { id: "stairs", txt: "Só escadas hoje — nada de elevador", xp: 25, type: "manual" },
  { id: "walklunch", txt: "Caminhe 10 min depois do almoço", xp: 25, type: "manual" },
  { id: "veggie", txt: "Salada ou legumes em 2 refeições", xp: 30, type: "manual" },
  { id: "nofry", txt: "Nada de frituras hoje", xp: 35, type: "manual" },
  { id: "sleep7", txt: "Durma 7h ou mais (sono ajuda a emagrecer)", xp: 25, type: "manual" },
  { id: "protein", txt: "Bata a meta de proteína do dia 🐶", xp: 60, type: "auto",
    check: (d) => d.protein >= d.proteinGoal,
    prog: (d) => `${Math.round(d.protein)}/${d.proteinGoal} g` },
  { id: "water", txt: "Bata a meta de água do dia 🐱", xp: 50, type: "auto",
    check: (d) => d.water >= d.waterGoal,
    prog: (d) => `${Math.round(d.water)}/${d.waterGoal} ml` },
  { id: "protein80", txt: "Chegue a 80% da meta de proteína", xp: 35, type: "auto",
    check: (d) => d.protein >= d.proteinGoal * 0.8,
    prog: (d) => `${Math.round((d.protein / d.proteinGoal) * 100)}% de 80%` },
  { id: "gym30", txt: "Treine 30 minutos hoje 💪", xp: 45, type: "auto",
    check: (d) => d.gymMin >= 30,
    prog: (d) => `${Math.min(30, d.gymMin)}/30 min` },
  { id: "gymboth", txt: "Musculação + aeróbico no mesmo dia", xp: 55, type: "auto",
    check: (d) => d.gymStrength > 0 && d.gymCardio > 0,
    prog: (d) => `${d.gymStrength > 0 ? "🏋️" : "⬜"} ${d.gymCardio > 0 ? "🏃" : "⬜"}` },
  { id: "fast16h", txt: "Complete um jejum de 16h ⏱️", xp: 80, type: "auto",
    check: (d) => d.fastHours >= 16,
    prog: (d) => `${d.fastHours.toFixed(1)}/16 h` },
];

// Sorteio determinístico: mesmos 3 desafios para o dia, mudando a cada dia
function dailyChallenges(dateKey) {
  let seed = 0;
  for (const c of dateKey) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const pool = [...CHALLENGE_DB];
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    picked.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picked;
}
