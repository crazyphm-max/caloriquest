// Cena do jogo: pista contínua com parallax, clima e personagem em pixel art.
// O humor ("mood") vem dos dados de calorias e controla velocidade, clima e animação:
//   idle → parado no amanhecer, esperando o "start" do dia
//   run  → correndo, dia claro e ensolarado (acelerando a meta)
//   walk → andando, ensolarado (no ritmo)
//   slow → andando devagar, chuva (caindo o ritmo)
//   sad  → cabisbaixo, andando PARA TRÁS, tempestade (regredindo)

const GameScene = (() => {
  const FW = 64, FH = 88; // tamanho do frame no sprite sheet
  const FRAMES = 6;       // frames por animação
  const CHAR_GROUND = 84; // linha do chão dentro do frame
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

  let canvas, ctx, img = {};
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
    [img.walker, img.ground, img.hills, img.cloud1, img.cloud2, img.sun, img.storm] =
      await Promise.all(
        ["walker", "ground", "hills", "cloud1", "cloud2", "sun", "storm"].map((n) =>
          loadImage(base + n + ".png")
        )
      );
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
    ctx.ellipse(cx + 31 * scale, groundY + 5 * scale, 20 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    if (cur.flip > 0.5) ctx.scale(-1, 1), ctx.translate(-FW * scale, 0);
    ctx.drawImage(img.walker, frame * FW, row * FH, FW, FH, 0, 0, FW * scale, FH * scale);
    ctx.restore();

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

  return { init, setMood };
})();
