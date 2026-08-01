// Banco de alimentos com porções médias brasileiras.
// Valores de kcal já são "jogados pra cima" (~+10% sobre a média) de propósito,
// porque o usuário normalmente não pesa a comida — melhor sobrar do que faltar.
// n = nome, p = porção média, k = kcal da porção, s = sinônimos para busca
const FOOD_DB = [
  { n: "Arroz branco", p: "colher de servir (60 g)", k: 85, s: ["arroz"] },
  { n: "Arroz integral", p: "colher de servir (60 g)", k: 75 },
  { n: "Feijão", p: "concha média (100 g)", k: 105, s: ["feijao", "feijão carioca", "feijão preto"] },
  { n: "Feijoada", p: "concha média (140 g)", k: 280 },
  { n: "Feijão tropeiro", p: "colher de servir", k: 220, s: ["tropeiro"] },
  { n: "Baião de dois", p: "porção (200 g)", k: 350, s: ["baiao"] },
  { n: "Arroz carreteiro", p: "porção (200 g)", k: 380, s: ["carreteiro"] },
  { n: "Cuscuz nordestino", p: "fatia (100 g)", k: 120, s: ["cuscuz", "couscous"] },
  { n: "Farofa", p: "colher de sopa", k: 55 },
  { n: "Purê de batata", p: "colher de servir", k: 110, s: ["pure"] },
  { n: "Macarrão simples", p: "pegador (110 g)", k: 170, s: ["macarrao", "massa", "espaguete"] },
  { n: "Macarrão à bolonhesa", p: "prato médio", k: 520, s: ["bolonhesa"] },
  { n: "Lasanha", p: "porção (300 g)", k: 550 },
  { n: "Nhoque ao sugo", p: "porção (250 g)", k: 360, s: ["nhoque", "gnocchi"] },
  { n: "Estrogonofe de frango", p: "concha média", k: 300, s: ["estrogonofe", "strogonoff"] },
  { n: "Escondidinho", p: "porção (250 g)", k: 420 },
  { n: "Panqueca recheada", p: "1 unidade", k: 230 },
  { n: "Sopa de legumes", p: "prato fundo", k: 160, s: ["sopa"] },
  { n: "Caldo verde", p: "prato fundo", k: 250 },

  { n: "Pão francês", p: "1 unidade (50 g)", k: 150, s: ["pao", "pão", "pãozinho", "cacetinho"] },
  { n: "Pão francês com manteiga", p: "1 unidade", k: 200, s: ["pao com manteiga"] },
  { n: "Pão na chapa", p: "1 unidade", k: 240 },
  { n: "Pão de forma", p: "1 fatia", k: 75 },
  { n: "Pão integral", p: "1 fatia", k: 70 },
  { n: "Pão de queijo", p: "1 unidade média", k: 95, s: ["pao de queijo"] },
  { n: "Tapioca simples", p: "1 unidade", k: 160 },
  { n: "Tapioca com queijo", p: "1 unidade", k: 240 },
  { n: "Misto quente", p: "1 unidade", k: 300, s: ["misto"] },
  { n: "Torta salgada", p: "fatia média", k: 320 },

  { n: "Ovo cozido", p: "1 unidade", k: 80, s: ["ovo"] },
  { n: "Ovo frito", p: "1 unidade", k: 110 },
  { n: "Ovos mexidos", p: "2 ovos", k: 190, s: ["ovo mexido"] },
  { n: "Omelete", p: "2 ovos", k: 220 },
  { n: "Ovo de codorna", p: "3 unidades", k: 45, s: ["codorna"] },

  { n: "Frango grelhado", p: "filé médio (120 g)", k: 200, s: ["frango", "file de frango", "peito de frango"] },
  { n: "Frango frito", p: "coxa/sobrecoxa", k: 260 },
  { n: "Frango à parmegiana", p: "porção", k: 550, s: ["parmegiana"] },
  { n: "Bife grelhado", p: "1 bife (100 g)", k: 250, s: ["bife", "carne", "carne bovina"] },
  { n: "Carne moída refogada", p: "colher de servir", k: 130, s: ["carne moida"] },
  { n: "Picanha", p: "fatia (100 g)", k: 290 },
  { n: "Costela assada", p: "porção (150 g)", k: 450, s: ["costela"] },
  { n: "Lombo de porco", p: "fatia (100 g)", k: 210, s: ["porco", "lombo"] },
  { n: "Linguiça", p: "1 gomo (60 g)", k: 190, s: ["linguica", "calabresa"] },
  { n: "Bacon", p: "2 fatias", k: 90 },
  { n: "Salsicha", p: "1 unidade", k: 120 },
  { n: "Peixe grelhado", p: "filé (120 g)", k: 160, s: ["peixe", "tilapia", "tilápia"] },
  { n: "Salmão", p: "posta (120 g)", k: 250, s: ["salmao"] },
  { n: "Atum em lata", p: "meia lata", k: 70 },
  { n: "Camarão", p: "porção (100 g)", k: 110, s: ["camarao"] },
  { n: "Sushi", p: "8 peças", k: 300 },
  { n: "Temaki", p: "1 unidade", k: 450 },

  { n: "Hambúrguer caseiro", p: "1 unidade", k: 250, s: ["hamburguer"] },
  { n: "X-burger", p: "1 lanche", k: 500, s: ["xburger", "cheeseburger", "x burger"] },
  { n: "X-tudo", p: "1 lanche", k: 850, s: ["x tudo"] },
  { n: "Cachorro-quente", p: "1 completo", k: 500, s: ["cachorro quente", "hot dog", "dogão", "dogao"] },
  { n: "Pizza", p: "1 fatia", k: 290 },
  { n: "Coxinha", p: "1 média", k: 280 },
  { n: "Pastel", p: "1 grande", k: 300 },
  { n: "Empada", p: "1 unidade", k: 200 },
  { n: "Esfiha", p: "1 unidade", k: 220, s: ["esfirra"] },
  { n: "Salgadinho de pacote", p: "pacote pequeno", k: 280, s: ["chips", "salgadinho"] },
  { n: "Pipoca", p: "bacia média", k: 220 },

  { n: "Batata frita", p: "porção pequena", k: 350, s: ["fritas"] },
  { n: "Batata frita grande", p: "porção grande", k: 600 },
  { n: "Batata cozida", p: "1 média", k: 90, s: ["batata"] },
  { n: "Batata-doce", p: "fatia (100 g)", k: 100, s: ["batata doce"] },
  { n: "Mandioca cozida", p: "porção (100 g)", k: 130, s: ["mandioca", "aipim", "macaxeira"] },
  { n: "Polenta frita", p: "porção", k: 320, s: ["polenta"] },
  { n: "Milho cozido", p: "1 espiga", k: 130, s: ["milho"] },

  { n: "Salada verde", p: "prato de entrada", k: 35, s: ["salada", "alface"] },
  { n: "Salada com azeite", p: "prato de entrada", k: 80 },
  { n: "Legumes cozidos", p: "porção", k: 60, s: ["legumes"] },
  { n: "Vinagrete", p: "colher de sopa", k: 20 },

  { n: "Banana", p: "1 unidade", k: 100 },
  { n: "Maçã", p: "1 unidade", k: 80, s: ["maca"] },
  { n: "Laranja", p: "1 unidade", k: 70 },
  { n: "Mamão", p: "1 fatia", k: 60, s: ["mamao", "papaia"] },
  { n: "Manga", p: "1 unidade", k: 130 },
  { n: "Melancia", p: "1 fatia", k: 60 },
  { n: "Abacaxi", p: "1 fatia", k: 50 },
  { n: "Uva", p: "cacho pequeno", k: 90 },
  { n: "Morango", p: "10 unidades", k: 40 },
  { n: "Abacate", p: "metade", k: 160 },
  { n: "Pera", p: "1 unidade", k: 85 },
  { n: "Tangerina", p: "1 unidade", k: 60, s: ["mexerica", "bergamota"] },
  { n: "Água de coco", p: "copo (300 ml)", k: 60, s: ["agua de coco"] },

  { n: "Iogurte natural", p: "pote (170 g)", k: 110, s: ["iogurte"] },
  { n: "Iogurte com sabor", p: "pote (170 g)", k: 150 },
  { n: "Leite integral", p: "copo (250 ml)", k: 160, s: ["leite"] },
  { n: "Leite desnatado", p: "copo (250 ml)", k: 90 },
  { n: "Queijo mussarela", p: "1 fatia", k: 80, s: ["mussarela", "queijo"] },
  { n: "Queijo prato", p: "1 fatia", k: 90 },
  { n: "Queijo minas", p: "1 fatia", k: 70 },
  { n: "Requeijão", p: "colher de sopa", k: 75, s: ["requeijao"] },
  { n: "Manteiga", p: "colher de chá", k: 40 },
  { n: "Margarina", p: "colher de chá", k: 35 },
  { n: "Presunto", p: "1 fatia", k: 35 },
  { n: "Peito de peru", p: "1 fatia", k: 25 },
  { n: "Mortadela", p: "1 fatia", k: 60 },

  { n: "Café sem açúcar", p: "xícara", k: 5, s: ["cafe", "café preto"] },
  { n: "Café com açúcar", p: "xícara", k: 35 },
  { n: "Café com leite", p: "copo (200 ml)", k: 120, s: ["media", "pingado"] },
  { n: "Achocolatado", p: "copo (250 ml)", k: 220, s: ["nescau", "toddy", "chocolate quente"] },
  { n: "Suco de laranja natural", p: "copo (300 ml)", k: 170, s: ["suco"] },
  { n: "Suco de caixinha", p: "copo (250 ml)", k: 130 },
  { n: "Refrigerante", p: "lata (350 ml)", k: 150, s: ["coca", "guarana", "refri"] },
  { n: "Refrigerante zero", p: "lata (350 ml)", k: 5, s: ["coca zero", "refri zero"] },
  { n: "Guaraná natural", p: "copo (300 ml)", k: 120 },
  { n: "Cerveja", p: "lata (350 ml)", k: 160, s: ["breja"] },
  { n: "Cerveja long neck", p: "garrafa (355 ml)", k: 150 },
  { n: "Chopp", p: "copo (300 ml)", k: 130, s: ["chope"] },
  { n: "Vinho", p: "taça (150 ml)", k: 130 },
  { n: "Destilado", p: "dose (50 ml)", k: 120, s: ["cachaca", "cachaça", "vodka", "whisky", "pinga"] },
  { n: "Água", p: "copo", k: 0, s: ["agua"] },

  { n: "Granola", p: "colher de sopa", k: 60 },
  { n: "Aveia", p: "colher de sopa", k: 55 },
  { n: "Pasta de amendoim", p: "colher de sopa", k: 100 },
  { n: "Castanha de caju", p: "punhado (30 g)", k: 180, s: ["castanha"] },
  { n: "Amendoim", p: "punhado (30 g)", k: 180 },
  { n: "Mel", p: "colher de sopa", k: 45 },
  { n: "Açúcar", p: "colher de chá", k: 20, s: ["acucar"] },
  { n: "Whey protein", p: "1 dose com água", k: 130, s: ["whey"] },

  { n: "Chocolate", p: "barra pequena (25 g)", k: 140 },
  { n: "Bombom", p: "1 unidade", k: 90 },
  { n: "Brigadeiro", p: "1 unidade", k: 110 },
  { n: "Bolo simples", p: "1 fatia", k: 250, s: ["bolo"] },
  { n: "Bolo com cobertura", p: "1 fatia", k: 350 },
  { n: "Sorvete", p: "1 bola", k: 130 },
  { n: "Açaí na tigela", p: "tigela (300 ml) c/ granola", k: 550, s: ["acai"] },
  { n: "Açaí copo", p: "copo (200 ml)", k: 300 },
  { n: "Pudim", p: "1 fatia", k: 220 },
  { n: "Sonho", p: "1 unidade", k: 320, s: ["donut"] },
  { n: "Churros", p: "1 unidade", k: 260 },
  { n: "Biscoito recheado", p: "3 unidades", k: 160, s: ["bolacha recheada", "oreo"] },
  { n: "Biscoito água e sal", p: "3 unidades", k: 70, s: ["cream cracker", "bolacha"] },
  { n: "Vitamina de banana", p: "copo (300 ml)", k: 260, s: ["vitamina"] },
];

// Atividades físicas: MET médio; kcal = MET * peso(kg) * 0,0175 * minutos (arredondado p/ cima... não!
// Exercício a gente arredonda PARA BAIXO, para não superestimar a queima.)
const EXERCISE_DB = [
  { n: "Caminhada leve", met: 3.0 },
  { n: "Caminhada rápida", met: 4.5 },
  { n: "Corrida leve (trote)", met: 8.0 },
  { n: "Corrida", met: 10.0 },
  { n: "Bicicleta", met: 6.5 },
  { n: "Musculação", met: 5.0 },
  { n: "Futebol", met: 8.0 },
  { n: "Natação", met: 7.0 },
  { n: "Pular corda", met: 11.0 },
  { n: "Dança", met: 5.5 },
  { n: "Subir escadas", met: 8.0 },
  { n: "Faxina pesada", met: 3.8 },
];

function normalizeTxt(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Busca por prefixo/substring no nome e sinônimos, ordenando por relevância
function searchFoods(query, limit = 8) {
  const q = normalizeTxt(query);
  if (!q) return [];
  const scored = [];
  for (const f of FOOD_DB) {
    const names = [f.n, ...(f.s || [])].map(normalizeTxt);
    let best = -1;
    for (const nm of names) {
      if (nm === q) best = Math.max(best, 100);
      else if (nm.startsWith(q)) best = Math.max(best, 80);
      else if (nm.includes(" " + q)) best = Math.max(best, 60);
      else if (nm.includes(q)) best = Math.max(best, 40);
    }
    if (best > 0) scored.push([best, f]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map((x) => x[1]);
}
