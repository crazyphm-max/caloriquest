// Cena do jogo: pista contínua com parallax, clima e personagem em pixel art.
// O humor ("mood") vem dos dados de calorias e controla velocidade, clima e animação:
//   idle → parado no amanhecer, esperando o "start" do dia
//   run  → correndo, dia claro e ensolarado (acelerando a meta)
//   walk → andando, ensolarado (no ritmo)
//   slow → andando devagar, chuva (caindo o ritmo)
//   sad  → cabisbaixo, andando PARA TRÁS, tempestade (regredindo)

const GameScene = (() => {
  const FW = 80, FH = 96; // tamanho do frame no sprite sheet
  const FRAMES = 6;       // frames por animação
  const CHAR_GROUND = 92; // linha do chão dentro do frame
  const ROWS = { walk: 0, run: 1, slow: 0, sad: 2, idle: 3 };
  const SPEED = { run: 150, walk: 65, slow: 22, sad: -35, idle: 0 }; // px/s do chão
  const ANIM_FPS = { run: 15, walk: 9, slow: 4.5, sad: 4, idle: 3.5 };
  const RAIN = { run: 0, walk: 0, slow: 70, sad: 160, idle: 0 };
  const SKY = {
    run: { top: [110, 200, 255], bot: [210, 240, 255], dark: 0 },
    walk: { top: [127, 196, 242], bot: [207, 234, 253], dark: 0 },
    slow: { top: [124, 138, 160], bot: [186, 194, 208], dark: 0.22 },
    sad: { top: [58, 63, 87], bot: [104, 110, 136], dark: 0.45 },
    idle: { top: [150, 185, 230], bot: [255, 216, 168], dark: 0 }, // amanhecer
  };

  const MW = 56, MH = 48;   // frame dos mascotes
  const MFRAMES = 4;
  const MGROUND = 44;       // linha do chão dentro do frame do mascote

  let canvas, ctx, img = {};
  let variant = "m"; // personagem: m (masculino) ou f (feminino)
  // mascotes: {on, stage} — stage 0/1/2 conforme proteína (cão) e água (gato)
  let pets = { dog: { on: false, stage: 1 }, cat: { on: false, stage: 1 } };
  let bubble = null;        // {who, text, until} balão de dica
  let hud = { fast: null, gym: null }; // relógio de jejum e pesinho do treino
  let mood = "walk";
  let cur = { top: [...SKY.walk.top], bot: [...SKY.walk.bot], dark: 0, rain: 0, speed: SPEED.walk, flip: 0 };
  let groundX = 0, hillsX = 0, cloudX = 0;
  let animT = 0, frame = 0, rainDrops = [], flashA = 0, nextFlash = 5;
  let last = null, running = false;

  function loadImage(src) {
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.src = src;
    });
  }

  async function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    const base = "assets/sprites/";
    const names = ["walker_m", "walker_f", "ground", "hills", "cloud1", "cloud2",
                   "sun", "storm", "dog", "cat"];
    const loaded = await Promise.all(names.map((n) => loadImage(base + n + ".png")));
    names.forEach((n, i) => (img[n] = loaded[i]));
    resize();
    window.addEventListener("resize", resize);
    running = true;
    requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setMood(m) {
    if (SKY[m]) mood = m;
  }

  function setVariant(sex) {
    variant = sex === "f" ? "f" : "m";
  }

  // Liga/desliga um mascote e define seu estágio (0 fraco, 1 normal, 2 forte)
  function setPet(who, on, stage) {
    if (!pets[who]) return;
    pets[who].on = !!on;
    if (stage !== undefined) pets[who].stage = Math.max(0, Math.min(2, stage));
  }

  // Mostra um balão de fala por alguns segundos.
  // `who` pode ser um mascote ("dog"/"cat") ou "fast" — o relógio do jejum.
  function say(who, text, seconds = 7) {
    bubble = { who, text, until: performance.now() + seconds * 1000 };
  }

  // Relógio de jejum no canto da cena: {text, pct, done} ou null
  function setFastHud(data) {
    hud.fast = data || null;
  }

  // Pesinho com as calorias do treino do dia: {kcal, min} ou null
  function setGymHud(data) {
    hud.gym = data && data.kcal > 0 ? data : null;
  }

  const lerp = (a, b, t) => a + (b - a) * t;

  function loop(ts) {
    if (!running) return;
    if (last === null) last = ts;
    const dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;

    // transições suaves de clima/velocidade
    const t = 1 - Math.pow(0.25, dt); // ~75% por segundo
    const sky = SKY[mood];
    for (let i = 0; i < 3; i++) {
      cur.top[i] = lerp(cur.top[i], sky.top[i], t);
      cur.bot[i] = lerp(cur.bot[i], sky.bot[i], t);
    }
    cur.dark = lerp(cur.dark, sky.dark, t);
    cur.rain = lerp(cur.rain, RAIN[mood], t);
    cur.speed = lerp(cur.speed, SPEED[mood], t);
    cur.flip = lerp(cur.flip, mood === "sad" ? 1 : 0, t);

    draw(dt);
    requestAnimationFrame(loop);
  }

  function draw(dt) {
    const W = canvas.getBoundingClientRect().width;
    const H = canvas.getBoundingClientRect().height;
    ctx.imageSmoothingEnabled = false;

    // céu
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${cur.top.map(Math.round).join(",")})`);
    g.addColorStop(1, `rgb(${cur.bot.map(Math.round).join(",")})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const scale = Math.max(1, Math.floor(H / 132)); // micropixels (2x em telas comuns)
    const groundH = img.ground.height * scale;
    const groundY = H - groundH;

    // sol (dias bons) / nuvem de tempestade (dias ruins)
    const sunA = 1 - cur.dark / 0.45;
    if (sunA > 0.05) {
      ctx.globalAlpha = sunA;
      ctx.drawImage(img.sun, W - 100, 10, img.sun.width * 2, img.sun.height * 2);
      ctx.globalAlpha = 1;
    }
    if (cur.dark > 0.1) {
      ctx.globalAlpha = Math.min(1, cur.dark * 2.2);
      ctx.drawImage(img.storm, W * 0.3, 8, img.storm.width * 1.6, img.storm.height * 1.6);
      ctx.globalAlpha = 1;
    }

    // nuvens ao fundo
    cloudX -= Math.abs(cur.speed) * 0.06 * dt + 3 * dt;
    const cw = W + 140;
    const c1 = ((cloudX % cw) + cw) % cw;
    ctx.drawImage(img.cloud1, c1 - 70, 20, img.cloud1.width * 1.6, img.cloud1.height * 1.6);
    ctx.drawImage(img.cloud2, ((c1 + W * 0.55) % cw) - 70, 52, img.cloud2.width * 1.6, img.cloud2.height * 1.6);

    // morros (parallax lento)
    const hscale = scale * 0.5;
    hillsX -= cur.speed * 0.22 * dt;
    drawTiled(img.hills, hillsX, groundY - img.hills.height * hscale + 8 * hscale, hscale, W);

    // pista
    groundX -= cur.speed * dt;
    drawTiled(img.ground, groundX, groundY, scale, W);

    // escurecer cenário em clima ruim
    if (cur.dark > 0.01) {
      ctx.fillStyle = `rgba(20,22,40,${cur.dark * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    // personagem
    animT += dt * (ANIM_FPS[mood] || 6);
    frame = Math.floor(animT) % FRAMES;
    const row = ROWS[mood];
    const cx = W * 0.28;
    const cy = groundY + 4 * scale - CHAR_GROUND * scale; // pés afundam de leve na grama

    // sombra de contato no chão
    ctx.fillStyle = `rgba(18,24,44,${0.28 - cur.dark * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(cx + 40 * scale, groundY + 5 * scale, 24 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    if (cur.flip > 0.5) ctx.scale(-1, 1), ctx.translate(-FW * scale, 0);
    ctx.drawImage(img["walker_" + variant], frame * FW, row * FH, FW, FH, 0, 0, FW * scale, FH * scale);
    ctx.restore();

    // mascotes: caminham atrás do dono, um pouco menores
    drawPets(scale, cx, groundY);

    // painéis do canto (relógio de jejum e pesinho do treino)
    drawHud(W, H);

    // balão de dica
    drawBubble(scale, cx, groundY, W, H);

    // chuva
    if (cur.rain > 1) updateRain(dt, W, H);

    // relâmpago na tempestade
    if (mood === "sad") {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flashA = 0.55;
        nextFlash = 3 + Math.random() * 5;
      }
    }
    if (flashA > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${flashA})`;
      ctx.fillRect(0, 0, W, H);
      flashA *= Math.pow(0.001, dt);
    }
  }

  // Cachorro caminha atrás do dono e o gato à frente — assim os dois cabem
  // na tela sem se sobrepor (e invertem quando o dono anda para trás).
  const PET_OFFSET = { dog: -34, cat: 92 };

  function drawPets(scale, cx, groundY) {
    const pscale = scale * 0.75;
    const petFrame = Math.floor(animT * 0.7) % MFRAMES;
    const back = cur.flip > 0.5;
    for (const who of ["dog", "cat"]) {
      const pet = pets[who];
      if (!pet.on || !img[who]) continue;
      const off = back ? FW - PET_OFFSET[who] - MW * 0.75 : PET_OFFSET[who];
      const px = cx + off * scale;
      const py = groundY + 4 * scale - MGROUND * pscale;

      ctx.fillStyle = `rgba(18,24,44,${0.22 - cur.dark * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(px + 26 * pscale, groundY + 5 * scale, 15 * pscale, 3 * pscale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      if (back) ctx.scale(-1, 1), ctx.translate(-MW * pscale, 0);
      ctx.drawImage(img[who], petFrame * MW, pet.stage * MH, MW, MH,
                    0, 0, MW * pscale, MH * pscale);
      ctx.restore();
    }
  }

  // Placa de madeira no canto da cena, no espírito de HUD de jogo
  function hudPlate(x, y, w, h) {
    ctx.fillStyle = "rgba(20, 24, 40, 0.78)";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  // Relógio analógico simples: mostra o avanço do jejum na volta do ponteiro
  function drawClockFace(cx, cy, r, pct, done) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = done ? "#2f9e58" : "#f2f5fb";
    ctx.fill();
    ctx.strokeStyle = done ? "#1e6e3c" : "#22283c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // fatia preenchida = progresso até a meta
    if (pct > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pct));
      ctx.closePath();
      ctx.fillStyle = done ? "rgba(255,255,255,0.5)" : "rgba(224,112,60,0.75)";
      ctx.fill();
    }
    // ponteiro
    const ang = -Math.PI / 2 + Math.PI * 2 * (pct % 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 3), cy + Math.sin(ang) * (r - 3));
    ctx.strokeStyle = done ? "#fff" : "#22283c";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = done ? "#fff" : "#22283c";
    ctx.fill();
  }

  // Halter visto de lado: barra central e duas anilhas
  function drawDumbbell(cx, cy, s) {
    const bar = 7 * s, plateW = 3.2 * s, plateH = 9 * s, innerH = 13 * s;
    ctx.strokeStyle = "#161b2e";
    ctx.lineWidth = 1.4;
    // barra
    ctx.fillStyle = "#cfd7e8";
    ctx.fillRect(cx - bar / 2, cy - 1.4 * s, bar, 2.8 * s);
    ctx.strokeRect(cx - bar / 2, cy - 1.4 * s, bar, 2.8 * s);
    // anilhas: uma menor por fora, uma maior por dentro (dá volume)
    for (const dir of [-1, 1]) {
      const xIn = cx + dir * (bar / 2) - (dir < 0 ? plateW : 0);
      ctx.fillStyle = "#4f5b7d";
      ctx.fillRect(xIn, cy - innerH / 2, plateW, innerH);
      ctx.strokeRect(xIn, cy - innerH / 2, plateW, innerH);
      const xOut = cx + dir * (bar / 2 + plateW) - (dir < 0 ? plateW * 0.9 : 0);
      ctx.fillStyle = "#3c4666";
      ctx.fillRect(xOut, cy - plateH / 2, plateW * 0.9, plateH);
      ctx.strokeRect(xOut, cy - plateH / 2, plateW * 0.9, plateH);
      // brilho na anilha de dentro
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(xIn + 0.7 * s, cy - innerH / 2 + 1.4 * s, 1 * s, innerH * 0.3);
    }
  }

  function drawHud(W, H) {
    const pad = 10;
    let y = 46; // abaixo da etiqueta de ritmo
    ctx.textBaseline = "middle";

    if (hud.fast) {
      // largura acompanha o texto da fase, para nunca cortar
      ctx.font = "600 9.5px system-ui, sans-serif";
      const w = Math.max(120, 44 + ctx.measureText(hud.fast.label).width + 10);
      const h = 36;
      hudPlate(pad, y, w, h);
      drawClockFace(pad + 20, y + h / 2, 12, hud.fast.pct, hud.fast.done);
      ctx.fillStyle = "#fff";
      ctx.font = "700 15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(hud.fast.text, pad + 38, y + h / 2 - 5);
      ctx.font = "600 9.5px system-ui, sans-serif";
      ctx.fillStyle = hud.fast.done ? "#8ce0a8" : "rgba(255,255,255,0.75)";
      ctx.fillText(hud.fast.label, pad + 38, y + h / 2 + 10);
      y += h + 6;
    }

    if (hud.gym) {
      const w = 112, h = 34;
      hudPlate(pad, y, w, h);
      drawDumbbell(pad + 20, y + h / 2, 1.5);
      ctx.fillStyle = "#fff";
      ctx.font = "700 14px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`−${hud.gym.kcal}`, pad + 40, y + h / 2 - 5);
      ctx.font = "600 9.5px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(`kcal · ${hud.gym.min} min`, pad + 40, y + h / 2 + 10);
    }
    ctx.textBaseline = "alphabetic";
  }

  // Caixa de fala do mascote no rodapé da cena (estilo diálogo de RPG):
  // no celular sobra pouca largura, então uma faixa lê melhor que um balão.
  function drawBubble(scale, cx, groundY, W, H) {
    if (!bubble) return;
    if (performance.now() > bubble.until) { bubble = null; return; }
    // mensagens do relógio de jejum não dependem dos mascotes
    if (bubble.who !== "fast") {
      const pet = pets[bubble.who];
      if (!pet || !pet.on) { bubble = null; return; }
    }

    const pad = 10;
    const boxW = W - pad * 2;
    const iconW = 26;
    ctx.font = "600 12.5px system-ui, -apple-system, sans-serif";

    // quebra o texto na largura disponível
    const textW = boxW - iconW - 22;
    const lines = [];
    let line = "";
    for (const word of bubble.text.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > textW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);

    const lh = 16;
    const boxH = Math.max(38, lines.length * lh + 14);
    const by = H - boxH - pad;

    // fade nos últimos 600 ms
    const left = bubble.until - performance.now();
    ctx.globalAlpha = Math.min(1, left / 600);

    ctx.fillStyle = "rgba(20, 24, 40, 0.86)";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pad, by, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    const icon = bubble.who === "dog" ? "🐶" : bubble.who === "cat" ? "🐱" : "⏱️";
    ctx.fillText(icon, pad + 6 + iconW / 2, by + boxH / 2);

    ctx.font = "600 12.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const ty = by + (boxH - lines.length * lh) / 2 + 1;
    lines.forEach((l, i) => ctx.fillText(l, pad + iconW + 14, ty + i * lh));
    ctx.globalAlpha = 1;
  }

  function drawTiled(tile, offset, y, scale, W) {
    const tw = tile.width * scale;
    let x = ((offset % tw) + tw) % tw - tw;
    for (; x < W; x += tw)
      ctx.drawImage(tile, x, y, tw, tile.height * scale);
  }

  function updateRain(dt, W, H) {
    const want = Math.round(cur.rain);
    while (rainDrops.length < want)
      rainDrops.push({ x: Math.random() * W, y: Math.random() * H, v: 260 + Math.random() * 160 });
    if (rainDrops.length > want) rainDrops.length = want;
    ctx.strokeStyle = "rgba(190,210,240,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of rainDrops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.25 * dt;
      if (d.y > H) {
        d.y = -8;
        d.x = Math.random() * (W + 60);
      }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + 8);
    }
    ctx.stroke();
  }

  return { init, setMood, setVariant, setPet, say, setFastHud, setGymHud };
})();
