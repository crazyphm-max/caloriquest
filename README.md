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

## Personagens

Ao se cadastrar você escolhe o sexo e o app usa o personagem correspondente —
ele de camiseta vermelha e faixa amarela, ela de top rosa, shorts verde-água e
rabo de cavalo. Os dois começam gordinhos: a jornada é essa. 😄

## Modo jejum intermitente

Você diz quando parou de comer (agora ou uma hora anterior) e escolhe o protocolo
— 12/12, 14/10, 16/8, 18/6, 20/4 ou OMAD. Um relógio circular conta o tempo ao
vivo e mostra a fase metabólica atual.

Tocando no relógio, a linha do tempo do que acontece no corpo: queda da insulina
(4h), esgotamento do glicogênio (8h), início da queima de gordura (12h), pico de
hormônio do crescimento (14h), autofagia (16h), cetose firme (18h) e por aí vai.
O que você já conquistou aparece marcado, o que vem pela frente fica esmaecido.

Ao encerrar, o jejum entra no histórico com estatísticas: total, metas
concluídas, maior jejum, média dos últimos 7 dias e dias seguidos.

## Modo academia

Dois jeitos de registrar, porque nem todo dia dá pra detalhar:

- **Rápido** — só os minutos de musculação e de aeróbico
- **Detalhado** — exercício por exercício, com séries, repetições, carga e tempo

São 38 exercícios de academia com MET próprio, agrupados por músculo. O app
soma os minutos, calcula as calorias, acumula o volume de carga (séries × reps ×
kg) e mostra quais grupos musculares você trabalhou nos últimos 7 dias. Ao
repetir um exercício, ele lembra a carga da última vez para você buscar a
progressão.

## Mascotes

Dois bichinhos caminham com você e cada um cuida de uma meta. Ligue ou desligue
cada um no Perfil, junto com as dicas que eles dão durante a caminhada.

| Mascote | Cuida de | Como reage |
| --- | --- | --- |
| 🐶 Cachorro | Proteína | Magro no começo do dia, vai ficando **bombado** conforme você come proteína — some 80% da meta e ele fica forte, de língua de fora |
| 🐱 Gato | Água | Fica **murcho e cabisbaixo** se o dia avança sem você beber; hidratado, anda de rabo em pé |

As metas saem do seu perfil: proteína de 1,6 a 2,0 g por kg do peso-alvo (conforme o
nível de atividade) e água de 31–35 ml por kg, com acréscimo pelo exercício do dia.
Cada alimento do banco já traz proteína e hidratação, e dá para registrar copos de
água na mão.

As dicas aparecem numa caixa de diálogo no rodapé da cena, em rodízio: lembrete de
pesagem em jejum, quanto falta de proteína, aviso quando você passou das calorias,
sugestão de caminhada, e por aí vai.

## Nuvem: login e dados por pessoa (Cloudflare)

O app tem uma API pronta para **Cloudflare Pages + Functions + D1** (grátis):
cada pessoa cria sua conta (e-mail + senha), os dados ficam no banco D1 e
sincronizam entre aparelhos. Sem a API (GitHub Pages, arquivo local), o app
funciona em modo local, como sempre.

Deploy (uma vez, ~10 minutos):

```bash
npm install -g wrangler
wrangler login                                # abre o navegador p/ autorizar
wrangler d1 create caloriquest-db             # copie o database_id que aparecer
# cole o database_id no wrangler.toml
wrangler d1 execute caloriquest-db --remote --file=schema.sql
wrangler pages deploy .
```

O site sobe em `https://caloriquest.pages.dev` (dá pra ligar domínio próprio).
Deploys seguintes: só `wrangler pages deploy .` de novo — ou conecte o
repositório no painel do Cloudflare Pages para deploy automático a cada push.

Notas de segurança: senhas com PBKDF2 (100 mil iterações), sessão em cookie
HttpOnly de 180 dias, e cada usuário só acessa o próprio estado.

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

Os personagens humanos vêm de **vídeos** de animação gerados por IA (personagem
animado no lugar, sobre fundo cinza) e passam por `tools/process_ai_videos.py`:

```bash
pip install Pillow numpy scipy imageio-ffmpeg
python3 tools/process_ai_videos.py <pasta_com_os_mp4>
```

O script extrai os frames, remove o fundo e as sombras, mede o período do ciclo de
animação comparando silhuetas (para os 6 frames fecharem um loop perfeito), alinha
tudo pelo torso e pela linha dos pés e monta os sheets. Há também
`tools/process_ai_sprites.py`, a versão equivalente para quando a arte vem em folhas
de imagem em vez de vídeo. Os mascotes e o cenário são desenhados por
`tools/generate_mascots.py` e `tools/generate_sprites.py`.

## Notas de cálculo

- ~7.700 kcal de déficit ≈ 1 kg de gordura
- Calorias de alimentos: médias **superestimadas** de propósito (+~10%), porque na dúvida
  é melhor achar que comeu mais
- Calorias de exercício: **subestimadas** (arredondadas para baixo), porque na dúvida é
  melhor achar que queimou menos
- Os valores são estimativas para acompanhamento pessoal — não substituem orientação de
  nutricionista ou médico
