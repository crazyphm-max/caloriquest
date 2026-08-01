# 🏃 CaloriQuest

Controle de queima de calorias **gameficado**, em português, feito para usar no celular.

Você registra o que comeu (sem precisar pesar — as porções são médias brasileiras já
arredondadas para cima), o app soma tudo, calcula sua taxa basal + gasto do dia e mostra
seu **déficit calórico** em tempo real. E o melhor: um personagem em **pixel art** avança
numa pista contínua refletindo o seu ritmo:

| Situação | Cena |
| --- | --- |
| Dia ainda não começou | 🌅 Amanhecer, personagem **parado**, respirando, esperando o start |
| À frente da meta | ☀️ Dia claro, personagem **correndo** |
| No ritmo | 🚶 Ensolarado, personagem andando |
| Caindo o ritmo | 🌧️ Chuva, personagem devagar |
| Regredindo | ⛈️ Tempestade, personagem cabisbaixo andando **para trás** |

## Funcionalidades

- **Perfil**: peso, altura, idade, sexo, nível de atividade, peso desejado e prazo
- **Start do dia**: o personagem começa parado; o dia só "começa" quando você registra a
  primeira refeição, exercício ou pesagem
- **Pesagem matinal**: todo dia o app convida (sem obrigar!) a se pesar em jejum — se não
  tiver balança, é só tocar em "Sem balança hoje"
- **Taxa basal** (Mifflin-St Jeor) + gasto diário total pelo nível de atividade
- **Registro de refeições** por busca de texto (130+ alimentos brasileiros com porção média);
  se não achar, você informa as kcal na mão
- **Exercícios** por atividade e minutos (cálculo por MET e seu peso — arredondado para
  baixo, para nunca superestimar a queima)
- **Déficit do dia** e **projeção**: "mantendo essa média, você chega a X kg em DD/MM"
- **Desafios diários** (jejum intermitente, zero refrigerante, queimar X kcal…) com XP,
  níveis e sequência 🔥 de dias em déficit
- **Gráfico de peso** com linha da meta
- Funciona **offline** (PWA) e pode ser instalado na tela inicial do celular

## Como usar no celular

1. Hospede a pasta em qualquer servidor estático (GitHub Pages resolve):
   *Settings → Pages → Deploy from branch*.
2. Abra o link no celular (Chrome/Safari).
3. Menu do navegador → **"Adicionar à tela inicial"** — vira um app de verdade, com ícone
   e tela cheia, funcionando offline.

Para testar localmente:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Caminho para a Play Store

O app é um PWA completo (manifest + service worker), então dá para publicar na Play Store
empacotando como **TWA (Trusted Web Activity)** com o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
ou o [PWABuilder](https://www.pwabuilder.com/) — sem reescrever nada.

## Os sprites

Toda a arte é **PNG de verdade** (nada de desenho em CSS), gerada pelo script
`tools/generate_sprites.py` (requer Pillow):

```bash
pip install Pillow
python3 tools/generate_sprites.py
```

Ele gera o sprite sheet do personagem (andar, correr e desanimado — 4 frames cada),
a pista, os morros, nuvens, sol, nuvem de tempestade e os ícones do app.

## Notas de cálculo

- ~7.700 kcal de déficit ≈ 1 kg de gordura
- Calorias de alimentos: médias **superestimadas** de propósito (+~10%), porque na dúvida
  é melhor achar que comeu mais
- Calorias de exercício: **subestimadas** (arredondadas para baixo), porque na dúvida é
  melhor achar que queimou menos
- Os valores são estimativas para acompanhamento pessoal — não substituem orientação de
  nutricionista ou médico
