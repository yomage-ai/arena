(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = 1280, H = 620;
  const GX = 204, GY = 108, CW = 100, CH = 100, COLS = 9, ROWS = 5;
  const types = {
    sunflower: { name: "向日葵", cost: 50, cooldown: 6, hp: 100 },
    peashooter: { name: "豌豆射手", cost: 100, cooldown: 6, hp: 125 },
    wallnut: { name: "坚果墙", cost: 50, cooldown: 19, hp: 700 },
    snowpea: { name: "寒冰射手", cost: 175, cooldown: 9, hp: 125 },
    repeater: { name: "双发射手", cost: 200, cooldown: 10, hp: 125 },
    potato: { name: "土豆雷", cost: 25, cooldown: 18, hp: 85 },
    cherry: { name: "樱桃炸弹", cost: 150, cooldown: 35, hp: 999 }
  };
  const cards = [...document.querySelectorAll(".seed-card")];
  const els = {
    sun: document.getElementById("sunCount"),
    wave: document.getElementById("waveLabel"),
    waveFill: document.getElementById("waveFill"),
    waveStatus: document.getElementById("waveStatus"),
    kills: document.getElementById("killCount"),
    tip: document.getElementById("tipText"),
    intro: document.getElementById("introOverlay"),
    pause: document.getElementById("pauseOverlay"),
    end: document.getElementById("endOverlay"),
    toast: document.getElementById("toast"),
    banner: document.getElementById("waveBanner"),
    shovel: document.getElementById("shovelBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    pauseLabel: document.getElementById("pauseLabel"),
    pauseIcon: document.getElementById("pauseIcon"),
    speedLabel: document.getElementById("speedLabel"),
    soundBtn: document.getElementById("soundBtn")
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function seeded(seed) {
    let n = seed >>> 0;
    return () => ((n = (Math.imul(1664525, n) + 1013904223) >>> 0) / 4294967296);
  }
  const terrainRandom = seeded(645339);
  function rr(g, x, y, w, h, r, fill, stroke, lw = 1) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  }
  function oval(g, x, y, rx, ry, fill, stroke, lw = 1, angle = 0) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  }
  function line(g, points, color, width = 2, cap = "round") {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = cap; g.lineJoin = "round"; g.stroke();
  }
  function poly(g, points, fill, stroke, lw = 1) {
    g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function gradient(g, x1, y1, x2, y2, stops) {
    const result = g.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(s => result.addColorStop(s[0], s[1]));
    return result;
  }
  function radial(g, x1, y1, r1, x2, y2, r2, stops) {
    const result = g.createRadialGradient(x1, y1, r1, x2, y2, r2);
    stops.forEach(s => result.addColorStop(s[0], s[1]));
    return result;
  }

  const terrain = document.createElement("canvas");
  terrain.width = W; terrain.height = H;
  const bg = terrain.getContext("2d");
  drawTerrain(bg);

  function drawTerrain(g) {
    const sky = gradient(g, 0, 0, 0, 120, [[0, "#a5d3c4"], [.65, "#c7d8ac"], [1, "#e2dea9"]]);
    g.fillStyle = sky; g.fillRect(0, 0, W, GY + 14);
    // Wispy clouds and distant trees lend depth behind the garden.
    for (let i = 0; i < 8; i++) {
      const x = 245 + i * 151 + terrainRandom() * 30;
      oval(g, x, 34 + terrainRandom() * 17, 55, 11, "rgba(255,255,232,.35)");
      oval(g, x + 25, 26 + terrainRandom() * 13, 36, 13, "rgba(255,255,232,.27)");
    }
    for (let i = 0; i < 26; i++) {
      const x = 155 + i * 47 + terrainRandom() * 19;
      const y = 96 + terrainRandom() * 10;
      oval(g, x, y, 31 + terrainRandom() * 13, 19 + terrainRandom() * 9,
        i % 3 === 0 ? "#769c66" : "#82a66b");
      oval(g, x - 11, y - 9, 16, 14, "rgba(176,205,119,.38)");
    }
    // The left edge is a slice of the player's house and stone walk.
    g.fillStyle = gradient(g, 0, 0, 160, 0, [[0, "#caac80"], [.55, "#e7cd9c"], [1, "#b4936e"]]);
    g.fillRect(0, 0, 161, H);
    for (let i = 0; i < 17; i++) {
      const y = i * 41 + 10;
      line(g, [[0, y], [160, y]], "rgba(106,76,46,.13)", 2);
      for (let x = i % 2 ? 34 : 76; x < 160; x += 82)
        line(g, [[x, y], [x, y + 41]], "rgba(106,76,46,.11)", 1.5);
    }
    g.fillStyle = "#6e4a35"; g.fillRect(0, 0, 163, 25);
    poly(g, [[0, 10], [160, 10], [175, 78], [0, 49]], "#8d4f39", "#613c2d", 4);
    for (let i = 0; i < 9; i++) {
      line(g, [[i * 23 - 12, 12], [i * 23 + 21, 58]], "rgba(245,173,108,.18)", 3);
      line(g, [[0, 18 + i * 11], [172, 18 + i * 11]], "rgba(74,38,28,.19)", 1);
    }
    rr(g, 17, 184, 116, 221, 9, "#75513c", "#593d2c", 5);
    rr(g, 29, 196, 92, 197, 5, gradient(g, 29, 0, 121, 0, [[0, "#8c654a"], [.5, "#a27653"], [1, "#78543e"]]), "#513b2d", 3);
    oval(g, 98, 303, 5, 5, "#f5cb65", "#755032", 2);
    rr(g, 30, 83, 89, 69, 4, "#f2e5b3", "#76563b", 5);
    rr(g, 38, 91, 73, 53, 2, gradient(g, 38, 91, 111, 144, [[0, "#b8ded1"], [1, "#688b7c"]]), "#8e7250", 3);
    line(g, [[74, 91], [74, 144]], "#f2dcaa", 5);
    line(g, [[38, 118], [111, 118]], "#f2dcaa", 5);
    rr(g, 14, 152, 121, 12, 4, "#95744f", "#67472f", 2);
    // Stones of the side path.
    g.fillStyle = gradient(g, 160, 0, 204, 0, [[0, "#7d7054"], [.55, "#bdac79"], [1, "#797c54"]]);
    g.fillRect(158, 0, 48, H);
    for (let row = 0; row < 14; row++) {
      const y = row * 47 - 15;
      line(g, [[161, y], [201, y + 5]], "rgba(65,61,46,.37)", 2);
      line(g, [[179, y + 5], [178, y + 42]], "rgba(65,61,46,.22)", 1.5);
    }
    g.fillStyle = "rgba(28,51,28,.21)"; g.fillRect(199, 0, 5, H);
    // Nine columns, five visible lanes, with hand-drawn grass texture.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = GX + col * CW, y = GY + row * CH;
        const base = (row + col) % 2 ? "#86b352" : "#91bf59";
        g.fillStyle = base; g.fillRect(x, y, CW, CH);
        g.fillStyle = gradient(g, x, y, x, y + CH, [[0, "rgba(234,249,147,.16)"], [.7, "rgba(35,90,35,0)"], [1, "rgba(28,80,28,.15)"]]);
        g.fillRect(x, y, CW, CH);
        for (let j = 0; j < 17; j++) {
          const px = x + 5 + terrainRandom() * 91;
          const py = y + 6 + terrainRandom() * 90;
          line(g, [[px, py + 4], [px - 2, py]], terrainRandom() > .5 ? "rgba(45,111,36,.14)" : "rgba(230,248,152,.21)", 1.2);
          line(g, [[px, py + 4], [px + 2, py + 1]], "rgba(42,105,33,.12)", 1);
        }
        if ((row * 7 + col * 11) % 9 === 0) {
          for (let f = 0; f < 5; f++) {
            const a = f * Math.PI * 2 / 5;
            oval(g, x + 76 + Math.cos(a) * 4, y + 31 + Math.sin(a) * 4, 2.5, 3.7, "rgba(255,250,213,.8)", null, 1, a);
          }
          oval(g, x + 76, y + 31, 2.2, 2.2, "#f5ca62");
        }
      }
    }
    for (let col = 0; col <= COLS; col++)
      line(g, [[GX + col * CW, GY], [GX + col * CW, GY + ROWS * CH]], "rgba(47,100,40,.13)", 2);
    for (let row = 0; row <= ROWS; row++)
      line(g, [[GX, GY + row * CH], [GX + COLS * CW, GY + row * CH]], "rgba(47,100,40,.15)", 2);
    g.fillStyle = "#4e783b"; g.fillRect(GX, GY - 5, COLS * CW, 7);
    line(g, [[GX, GY + ROWS * CH - 1], [GX + COLS * CW, GY + ROWS * CH - 1]], "#527b40", 6);
    // Bare earth, picket fence, and the route from which zombies arrive.
    g.fillStyle = gradient(g, GX + COLS * CW, 0, W, 0, [[0, "#6d8452"], [.35, "#9b9665"], [1, "#6e7052"]]);
    g.fillRect(GX + COLS * CW, 0, W - GX - COLS * CW, H);
    for (let i = 0; i < 38; i++) {
      const x = 1110 + terrainRandom() * 165, y = 120 + terrainRandom() * 480;
      oval(g, x, y, 3 + terrainRandom() * 6, 1 + terrainRandom() * 2, "rgba(49,59,41,.12)");
    }
    for (let i = 0; i < 11; i++) {
      const x = 1118 + i * 16;
      poly(g, [[x, 18], [x + 6, 6], [x + 12, 18], [x + 12, 82], [x, 82]], "#e2d8ae", "#9b9877", 2);
    }
    line(g, [[1110, 39], [1280, 39]], "#c0b78f", 9);
    line(g, [[1110, 67], [1280, 67]], "#c0b78f", 9);
    g.fillStyle = "rgba(255,255,225,.14)"; g.fillRect(1104, GY, 176, H - GY);
    for (let i = 0; i < 5; i++) {
      const yy = GY + i * CH + 50;
      oval(g, 1241, yy + 36, 28, 6, "rgba(30,43,27,.19)");
      rr(g, 1226, yy - 1, 31, 37, [15, 15, 2, 2], "#9a9c86", "#6a7463", 2);
      line(g, [[1236, yy + 13], [1246, yy + 13]], "#737969", 2);
      line(g, [[1241, yy + 8], [1241, yy + 24]], "#737969", 2);
    }
    // Warm vignette and a gentle highlight over the whole scene.
    g.fillStyle = radial(g, 630, 200, 160, 640, 310, 790, [[0, "rgba(255,248,179,0)"], [.75, "rgba(28,45,20,.03)"], [1, "rgba(21,31,18,.27)"]]);
    g.fillRect(0, 0, W, H);
  }

  function shadow(g, x, y, rx = 35) { oval(g, x, y, rx, 9, "rgba(31,61,27,.22)"); }
  function leaf(g, x, y, rx, ry, rot, color = "#4f9a3d") {
    oval(g, x, y, rx, ry, color, "#397332", 2, rot);
    g.save(); g.translate(x, y); g.rotate(rot);
    line(g, [[-rx * .6, 0], [rx * .6, 0]], "rgba(203,235,133,.56)", 1.8);
    g.restore();
  }
  function drawPlant(g, type, x, y, scale = 1, phase = 0, data = {}) {
    g.save(); g.translate(x, y); g.scale(scale, scale);
    const sway = Math.sin(phase * 2.6 + x * .05) * 2.4;
    shadow(g, 0, -1, type === "wallnut" ? 35 : 28);
    if (type !== "wallnut" && type !== "potato" && type !== "cherry") {
      oval(g, 0, -4, 23, 7, "#6a8a40");
      line(g, [[0, -8], [sway * .55, -43], [sway, -61]], "#377b35", 9);
      line(g, [[1, -10], [sway, -59]], "#92c65c", 3);
      leaf(g, -17, -25, 20, 10, .5, "#4da43f");
      leaf(g, 18, -34, 20, 10, -.45, "#60b74c");
    }
    if (type === "sunflower") {
      const hx = sway, hy = -65 + Math.sin(phase * 2.5) * 1.5;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6 + Math.sin(phase) * .025;
        oval(g, hx + Math.cos(a) * 30, hy + Math.sin(a) * 30, 13, 18,
          i % 2 ? "#ffd264" : "#f5b947", "#d79231", 1.8, a + Math.PI / 2);
      }
      oval(g, hx, hy, 29, 29, radial(g, hx - 9, hy - 11, 2, hx, hy, 38, [[0, "#e7a956"], [1, "#ae7133"]]), "#8c6131", 3);
      oval(g, hx - 9, hy - 5, 3.4, 5.5, "#412d20"); oval(g, hx + 9, hy - 5, 3.4, 5.5, "#412d20");
      oval(g, hx - 10, hy - 7, 1.2, 2, "#fff5db"); oval(g, hx + 8, hy - 7, 1.2, 2, "#fff5db");
      g.beginPath(); g.arc(hx, hy + 1, 12, .12, Math.PI - .12); g.strokeStyle = "#6f4329"; g.lineWidth = 2.5; g.stroke();
      oval(g, hx - 17, hy + 5, 4, 2, "rgba(243,135,111,.48)"); oval(g, hx + 17, hy + 5, 4, 2, "rgba(243,135,111,.48)");
    } else if (type === "peashooter" || type === "snowpea" || type === "repeater") {
      const icy = type === "snowpea", repeat = type === "repeater";
      const outline = icy ? "#4b8991" : "#3d782e";
      const body = icy ? "#8bd7d8" : repeat ? "#5fac42" : "#75bc4a";
      const light = icy ? "#c9f4e9" : "#afe47b";
      const hx = sway, hy = -64 + Math.sin(phase * 2.5) * 1.2;
      if (repeat) {
        oval(g, hx - 17, hy - 26, 16, 11, "#3f8935", outline, 2, -.28);
        oval(g, hx - 26, hy - 32, 14, 7, "#67ba4c", outline, 2, -.1);
      }
      oval(g, hx - 2, hy, 31, 30, radial(g, hx - 14, hy - 13, 1, hx, hy + 2, 41, [[0, light], [.7, body], [1, icy ? "#56aaad" : "#4f9f39"]]), outline, 3);
      if (repeat) {
        rr(g, hx + 12, hy - 2, 29, 18, 8, "#4f9e3d", outline, 2.5);
        oval(g, hx + 41, hy + 7, 8, 11, "#3c752e", outline, 2);
        oval(g, hx + 42, hy + 7, 4, 6, "#264f29");
      }
      rr(g, hx + 12, hy - 19, repeat ? 29 : 31, 20, 9, body, outline, 3);
      oval(g, hx + (repeat ? 41 : 43), hy - 9, 9, 12, icy ? "#58a6aa" : "#438b36", outline, 2);
      oval(g, hx + (repeat ? 42 : 44), hy - 9, 4, 7, icy ? "#346e81" : "#245b2a");
      oval(g, hx - 5, hy - 8, 5, 7, "#fffdf1", outline, 1.5);
      oval(g, hx - 3.3, hy - 7, 2.7, 4.5, "#273c2b");
      oval(g, hx - 4.1, hy - 9, 1, 1.3, "#fff");
      if (icy) {
        poly(g, [[hx - 30, hy - 8], [hx - 42, hy - 20], [hx - 36, hy + 1]], "#b9f3ee", "#6bbac4", 1.5);
        poly(g, [[hx - 10, hy - 30], [hx - 1, hy - 41], [hx + 2, hy - 29]], "#d4fcf3", "#6bbac4", 1.5);
      }
      oval(g, hx - 18, hy - 20, 7, 3, "rgba(255,255,255,.22)", null, 1, -.35);
    } else if (type === "wallnut") {
      const hurt = data.hp !== undefined ? data.hp / (data.maxHp || 700) : 1;
      oval(g, 0, -39, 34, 42, radial(g, -13, -65, 2, 3, -29, 62, [[0, "#dfaf6c"], [.63, "#bc8148"], [1, "#94643b"]]), "#7a512e", 3);
      oval(g, -10, -52, 8, 4, "rgba(255,228,162,.22)", null, 1, -.5);
      oval(g, -11, -43, 3.6, 5, "#392b23"); oval(g, 11, -43, 3.6, 5, "#392b23");
      line(g, [[-5, -23], [0, -20], [5, -23]], "#5a3828", 2.5);
      if (hurt < .62) line(g, [[18, -69], [12, -58], [19, -51], [14, -39]], "#6d452b", 2.3);
      if (hurt < .32) {
        line(g, [[-24, -55], [-15, -48], [-22, -36], [-15, -29]], "#6d452b", 2.5);
        line(g, [[18, -51], [26, -44]], "#6d452b", 2.2);
      }
    } else if (type === "potato") {
      const armed = data.armed === undefined ? true : data.armed;
      oval(g, 0, -10, 32, 13, "#7b633e");
      oval(g, 0, -24, 28, 24, gradient(g, 0, -49, 0, -5, [[0, "#d4a66b"], [1, "#a87844"]]), "#775032", 3);
      oval(g, -10, -27, 2.4, 3.3, "#3d3024"); oval(g, 10, -27, 2.4, 3.3, "#3d3024");
      line(g, [[-4, -17], [0, -15], [4, -17]], "#694a32", 2);
      if (armed) {
        line(g, [[1, -47], [3, -57]], "#646b3b", 3);
        oval(g, 3, -59, 4 + Math.sin(phase * 10) * .7, 4 + Math.sin(phase * 10) * .7, "#ed5b3d", "#ad3c2b", 1.5);
      } else {
        oval(g, 0, -48, 5, 3, "#8a7343");
      }
    } else if (type === "cherry") {
      const pulse = 1 + Math.sin(phase * 17) * .04;
      line(g, [[-17, -48], [-7, -78], [3, -82], [20, -51]], "#527a3d", 5);
      leaf(g, 8, -80, 13, 7, -.4, "#60ad4c");
      oval(g, -18, -34, 22 * pulse, 22 * pulse, radial(g, -25, -44, 1, -17, -30, 32, [[0, "#ff8870"], [.5, "#dc3c3a"], [1, "#a62b31"]]), "#7c2b2d", 3);
      oval(g, 18, -30, 22 * pulse, 22 * pulse, radial(g, 11, -40, 1, 18, -29, 32, [[0, "#ff8b71"], [.55, "#dc413d"], [1, "#aa3031"]]), "#7c2b2d", 3);
      oval(g, -23, -41, 5, 7, "rgba(255,233,208,.48)", null, 1, -.5);
      oval(g, 12, -38, 5, 7, "rgba(255,233,208,.48)", null, 1, -.5);
      oval(g, -12, -31, 3, 4, "#40262a"); oval(g, 23, -26, 3, 4, "#40262a");
      line(g, [[-6, -20], [-2, -18], [2, -20]], "#5f2028", 2);
      line(g, [[27, -16], [31, -14], [35, -16]], "#5f2028", 2);
    }
    g.restore();
  }

  function drawZombie(g, z, phase) {
    const bob = Math.sin(phase * 7 + z.id) * 2;
    const step = Math.sin(phase * 6.2 + z.id) * 6;
    const x = z.x, y = GY + z.row * CH + 91 + bob;
    g.save(); g.translate(x, y);
    shadow(g, 0, 3, 31);
    if (z.slowTimer > 0) {
      oval(g, 0, -44, 45, 49, "rgba(163,229,238,.17)");
      for (let i = 0; i < 3; i++) {
        const a = phase * 1.7 + i * 2.1;
        poly(g, [[Math.cos(a) * 34, -47 + Math.sin(a) * 28 - 5],
          [Math.cos(a) * 34 + 5, -47 + Math.sin(a) * 28],
          [Math.cos(a) * 34, -47 + Math.sin(a) * 28 + 5],
          [Math.cos(a) * 34 - 5, -47 + Math.sin(a) * 28]], "#c8f4f0");
      }
    }
    // Shuffling legs, cuffs, and big shoes.
    line(g, [[-5, -37], [-13 + step * .45, -13], [-18 + step, -5]], "#55536a", 14);
    line(g, [[13, -36], [17 - step * .45, -14], [11 - step, -5]], "#4d5262", 14);
    oval(g, -22 + step, -3, 17, 7, "#493e39", "#2e302d", 2, -.12);
    oval(g, 10 - step, -3, 17, 7, "#4a3c34", "#2e302d", 2, .1);
    // Jacket tails and tie are deliberately uneven.
    poly(g, [[-19, -66], [23, -67], [26, -33], [9, -36], [4, -27], [-22, -34]], "#604f4e", "#3f3f40", 2.5);
    poly(g, [[-15, -66], [4, -60], [6, -33], [-9, -35]], "#ebe7d0", "#817e6d", 1.5);
    poly(g, [[-4, -60], [2, -57], [-1, -48], [5, -39], [0, -35], [-5, -47]], "#bb5549", "#8e3e3d", 1.2);
    poly(g, [[-17, -62], [-4, -51], [-14, -43]], "#6c5c59", "#403e3e", 1);
    poly(g, [[11, -64], [3, -50], [17, -43]], "#6c5a58", "#403e3e", 1);
    // Both arms reach toward the house.
    line(g, [[-15, -60], [-30, -49], [-43 + Math.sin(phase * 4) * 2, -48]], "#635b51", 12);
    line(g, [[19, -60], [1, -50], [-18, -52]], "#68635a", 11);
    oval(g, -45 + Math.sin(phase * 4) * 2, -47, 10, 6, "#9eae83", "#617662", 1.5, -.12);
    oval(g, -21, -52, 10, 6, "#a6b58e", "#617662", 1.5, -.12);
    // Neck, hair, head, cheek, and jutting jaw.
    rr(g, -3, -76, 17, 16, 4, "#879d79", "#5a715e", 1.5);
    oval(g, -4, -91, 29, 31, radial(g, -16, -106, 2, 2, -83, 43, [[0, "#c5d0a2"], [.7, "#92a987"], [1, "#687f71"]]), "#556d5d", 2.5, -.15);
    poly(g, [[-22, -85], [-26, -76], [-13, -67], [8, -70], [20, -83]], "#8fa57e", "#596f60", 2);
    oval(g, -22, -75, 11, 8, "#8ea583", "#596f60", 1.5, -.3);
    poly(g, [[-31, -91], [-36, -87], [-28, -82]], "#819a79", "#556d5d", 1.5);
    oval(g, -20, -98, 9, 12, "#f2e8d3", "#5b6c62", 2);
    oval(g, 0, -99, 8, 10, "#eee5cd", "#5b6c62", 2);
    oval(g, -23, -97, 2.7, 5, "#2b3b39"); oval(g, -2, -98, 2.5, 4.5, "#2b3b39");
    oval(g, -24, -100, 1, 1.5, "#fff"); oval(g, -2.7, -100, 1, 1.5, "#fff");
    line(g, [[-12, -79], [-2, -76], [9, -79]], "#535f55", 2);
    for (let i = 0; i < 4; i++) rr(g, -10 + i * 5, -79, 3.4, 4.5, 1, "#e5e0ba");
    if (z.type === "cone") {
      poly(g, [[-24, -118], [17, -117], [-2, -165]], "#e6813a", "#9d512e", 3);
      line(g, [[-13, -143], [9, -143]], "#fff0cf", 7);
      rr(g, -28, -119, 49, 8, 3, "#dc7e38", "#a0532d", 2);
      oval(g, -13, -150, 5, 12, "rgba(255,222,161,.25)", null, 1, -.17);
    } else if (z.type === "bucket") {
      poly(g, [[-26, -143], [21, -143], [16, -114], [-19, -114]], gradient(g, 0, -144, 0, -110, [[0, "#dce6db"], [.5, "#9eafa9"], [1, "#6d8580"]]), "#536d69", 3);
      oval(g, -2, -143, 25, 6, "#d9e5dd", "#657d77", 2);
      line(g, [[-27, -136], [-32, -128], [-27, -122]], "#556f6b", 2.5);
      rr(g, -23, -124, 41, 5, 2, "rgba(217,238,226,.48)");
      oval(g, -9, -139, 8, 2, "rgba(255,255,255,.38)");
    } else if (z.type === "flag") {
      line(g, [[23, -59], [35, -164]], "#6b5940", 3);
      poly(g, [[34, -164], [76, -151], [36, -139]], "#e25d44", "#9f4634", 2);
      line(g, [[43, -151], [68, -150]], "rgba(255,241,185,.7)", 2);
    } else {
      poly(g, [[-30, -113], [-17, -124], [-8, -116], [2, -123], [17, -108]], "#4a4c41", "#3c4a3d", 2);
    }
    if (z.flash > 0) {
      g.globalCompositeOperation = "screen";
      oval(g, -2, -82, 34, 50, "rgba(255,233,186,.24)");
    }
    g.restore();
    if (z.hp < z.maxHp && z.hp > 0) {
      rr(g, x - 27, y - (z.type === "cone" ? 174 : z.type === "bucket" ? 154 : 133), 54, 5, 2, "rgba(28,45,30,.45)");
      rr(g, x - 27, y - (z.type === "cone" ? 174 : z.type === "bucket" ? 154 : 133),
        54 * clamp(z.hp / z.maxHp, 0, 1), 5, 2, z.hp / z.maxHp < .28 ? "#e57c5b" : "#9dd86b");
    }
  }

  function drawMower(g, x, row, active, phase) {
    const y = GY + row * CH + 86 + (active ? Math.sin(phase * 39) * 1.5 : 0);
    g.save(); g.translate(x, y);
    shadow(g, 0, 5, 35);
    line(g, [[16, -18], [31, -57], [42, -59]], "#4d554e", 5);
    line(g, [[40, -59], [45, -53]], "#34453c", 5);
    rr(g, -28, -31, 51, 28, 8, gradient(g, -20, -30, 22, 0, [[0, "#eb6550"], [.55, "#c94336"], [1, "#96392d"]]), "#702d27", 3);
    rr(g, -34, -14, 64, 12, 5, "#6c7770", "#444e47", 2);
    oval(g, -18, 0, 10, 10, "#303b39", "#191f21", 2);
    oval(g, 18, 0, 10, 10, "#303b39", "#191f21", 2);
    oval(g, -18, 0, 4, 4, "#b3b9a6"); oval(g, 18, 0, 4, 4, "#b3b9a6");
    rr(g, -25, -38, 27, 9, 4, "#e37f5b", "#8f3e32", 1.5);
    if (active) {
      for (let i = 0; i < 4; i++) {
        const dx = -42 - i * 17 - Math.sin(phase * 10 + i) * 6;
        oval(g, dx, -7 - i % 2 * 8, 8 + i * 2, 5 + i, "rgba(237,232,197,.29)");
      }
    }
    g.restore();
  }

  function drawSun(g, s, phase) {
    const pulse = 1 + Math.sin(phase * 5 + s.id) * .05;
    const x = s.x, y = s.y, r = 25 * pulse;
    const glow = radial(g, x, y, 5, x, y, 43, [[0, "rgba(255,245,150,.55)"], [.55, "rgba(255,213,70,.23)"], [1, "rgba(255,213,70,0)"]]);
    oval(g, x, y, 43, 43, glow);
    g.save(); g.translate(x, y); g.rotate(phase * .5 + s.id);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      poly(g, [[-4, -r + 1], [0, -r - 11], [4, -r + 1]], "#ffcf4e", "#efaa35", 1);
    }
    g.restore();
    oval(g, x, y, r, r, radial(g, x - 7, y - 9, 2, x, y, 31, [[0, "#fff8bd"], [.55, "#ffe274"], [1, "#f6b53d"]]), "#eaa23a", 2.3);
    oval(g, x - 8, y - 5, 2, 3, "#875d2b"); oval(g, x + 8, y - 5, 2, 3, "#875d2b");
    g.beginPath(); g.arc(x, y + 1, 8, .2, Math.PI - .2);
    g.strokeStyle = "#a36c2e"; g.lineWidth = 1.7; g.stroke();
    oval(g, x - 10, y - 11, 6, 4, "rgba(255,255,255,.34)", null, 1, -.5);
  }

  function drawProjectile(g, p) {
    if (p.type === "snowpea") {
      oval(g, p.x, p.y, 10, 10, radial(g, p.x - 3, p.y - 4, 1, p.x, p.y, 12,
        [[0, "#efffff"], [.7, "#9cdeed"], [1, "#5da5c3"]]), "#4d93aa", 1.5);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        line(g, [[p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9],
          [p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15]], "#d8f9f6", 2.2);
      }
    } else {
      oval(g, p.x, p.y, 9, 9, radial(g, p.x - 3, p.y - 4, 1, p.x, p.y, 12,
        [[0, "#d6f793"], [.6, "#83c649"], [1, "#458b39"]]), "#3e8736", 1.5);
      oval(g, p.x - 3, p.y - 4, 2.2, 1.5, "rgba(255,255,255,.69)");
    }
    oval(g, p.x - 15, p.y, 10, 3, p.type === "snowpea" ? "rgba(199,249,255,.28)" : "rgba(217,245,149,.25)");
  }

  function drawParticle(g, p) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    g.save(); g.globalAlpha = alpha;
    if (p.kind === "spark") {
      g.translate(p.x, p.y); g.rotate(p.angle);
      rr(g, -p.size * .5, -p.size * .5, p.size, p.size, 1, p.color);
    } else if (p.kind === "ring") {
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.strokeStyle = p.color; g.lineWidth = 6 * alpha; g.stroke();
    } else if (p.kind === "text") {
      g.fillStyle = p.color; g.font = "900 23px Georgia, serif"; g.textAlign = "center";
      g.shadowColor = "rgba(55,43,22,.6)"; g.shadowBlur = 3;
      g.fillText(p.text, p.x, p.y);
    } else {
      oval(g, p.x, p.y, p.size, p.size, p.color);
    }
    g.restore();
  }

  cards.forEach(card => {
    const mini = card.querySelector("canvas");
    const g = mini.getContext("2d");
    drawPlant(g, card.dataset.seed, 41, 68, .59, .6);
  });

  const waveStarts = [0, 55, 99, 146, 197];
  const waveCounts = [4, 6, 9, 12, 15];
  let nextId = 1;
  function cellX(col) { return GX + col * CW + CW / 2; }
  function plantY(row) { return GY + row * CH + 87; }
  function makeSchedule() {
    const rnd = seeded(824193);
    const events = [];
    const fixedFirst = [2, 0, 4, 1];
    for (let w = 0; w < 5; w++) {
      const gap = w === 0 ? 9.8 : w === 4 ? 3.25 : 4.3;
      for (let i = 0; i < waveCounts[w]; i++) {
        let kind = "normal";
        if (w >= 1 && rnd() < (.24 + w * .07)) kind = "cone";
        if (w >= 2 && rnd() < (.06 + w * .055)) kind = "bucket";
        if (w >= 3 && i === 0) kind = "flag";
        const row = w === 0 ? fixedFirst[i] : Math.floor(rnd() * ROWS);
        const time = (w === 0 ? 13 : waveStarts[w] + 3) + i * gap + (w === 0 ? 0 : rnd() * 1.5);
        events.push({ time, row, kind, wave: w + 1 });
      }
    }
    return events.sort((a, b) => a.time - b.time);
  }

  function createState(mode = "menu") {
    const cooldowns = {};
    Object.keys(types).forEach(type => cooldowns[type] = 0);
    return {
      mode, time: 0, speed: 1, sun: 250, selected: null, wave: 1, kills: 0,
      plants: [], zombies: [], projectiles: [], suns: [], particles: [],
      mowers: Array.from({ length: ROWS }, (_, row) => ({ row, x: 163, active: false, used: false })),
      schedule: makeSchedule(), nextSpawn: 0, nextSkySun: 4.5,
      cooldowns, hover: null, lastWave: 1, shake: 0
    };
  }
  let state = createState();
  let displayTime = 0;
  let toastTimer = 0, bannerTimer = 0;
  let audioCtx = null, soundEnabled = true, musicTimer = null, musicStep = 0;
  const tips = [
    "小提示：先种几株向日葵，阳光会来得更快。",
    "寒冰射手能拖慢僵尸；坚果墙能给它争取时间。",
    "土豆雷需要约 9 秒准备，记得提前埋下。",
    "每行的割草机只能救场一次。",
    "樱桃炸弹可以清除附近的成群僵尸。"
  ];

  function audioReady() {
    if (!soundEnabled) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (_) { return null; }
  }
  function tone(freq, duration, wave = "sine", volume = .08, delay = 0, slide = 0) {
    const ac = audioReady();
    if (!ac) return;
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = wave;
    const at = ac.currentTime + delay;
    osc.frequency.setValueAtTime(freq, at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(at); osc.stop(at + duration + .025);
  }
  function sound(name) {
    if (!soundEnabled) return;
    if (name === "sun") { tone(540, .13, "sine", .075); tone(820, .18, "sine", .05, .09); }
    else if (name === "plant") { tone(225, .15, "triangle", .08, 0, 90); tone(355, .13, "sine", .045, .08); }
    else if (name === "shot") tone(230, .075, "triangle", .016, 0, -120);
    else if (name === "hit") tone(145, .08, "triangle", .026, 0, -80);
    else if (name === "error") { tone(245, .12, "sawtooth", .025); tone(205, .16, "sawtooth", .022, .09); }
    else if (name === "explode") { tone(95, .44, "sawtooth", .12, 0, -48); tone(55, .52, "triangle", .08, .06); }
    else if (name === "wave") { tone(330, .18, "triangle", .07); tone(440, .18, "triangle", .07, .15); tone(550, .25, "triangle", .07, .3); }
    else if (name === "mower") { tone(95, .3, "sawtooth", .055, 0, 50); tone(140, .3, "sawtooth", .035, .22, 60); }
    else if (name === "win") { [392, 494, 587, 784].forEach((f, i) => tone(f, .38, "triangle", .085, i * .16)); }
    else if (name === "lose") { [330, 280, 220, 165].forEach((f, i) => tone(f, .31, "triangle", .06, i * .16)); }
  }
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!soundEnabled || state.mode !== "playing") return;
      const notes = [262, 0, 330, 0, 392, 0, 330, 0, 294, 0, 349, 0, 440, 0, 349, 0,
        262, 0, 330, 0, 392, 0, 523, 0, 440, 0, 392, 0, 330, 0, 294, 0];
      const n = notes[musicStep++ % notes.length];
      if (n) tone(n, .21, "sine", .012);
      if (musicStep % 8 === 1) tone(131, .32, "sine", .013);
    }, 235);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }
  function showBanner(message) {
    clearTimeout(bannerTimer);
    els.banner.textContent = message;
    els.banner.classList.add("show");
    bannerTimer = setTimeout(() => els.banner.classList.remove("show"), 2600);
  }
  function particle(x, y, color, count = 8, speed = 75, kind = "dot") {
    const rnd = Math.random;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, v = speed * (.3 + rnd() * .9);
      state.particles.push({
        id: nextId++, kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
        size: 2.5 + rnd() * 4, color, angle: rnd() * 6, spin: rnd() * 9 - 4.5,
        life: .32 + rnd() * .45, maxLife: .75
      });
    }
  }
  function textParticle(x, y, text, color = "#fff1ac") {
    state.particles.push({ id: nextId++, kind: "text", x, y, vx: 0, vy: -33,
      life: .92, maxLife: .92, size: 0, color, text });
  }
  function ringParticle(x, y, color = "#fff3b1", size = 12, life = .5) {
    state.particles.push({ id: nextId++, kind: "ring", x, y, vx: 0, vy: 0,
      life, maxLife: life, size, color, grow: 260 });
  }

  function begin() {
    state = createState("playing");
    els.intro.classList.add("hidden");
    els.pause.classList.add("hidden");
    els.end.classList.add("hidden");
    audioReady(); startMusic(); sound("wave");
    showBanner("准备防守！");
    els.tip.textContent = window.matchMedia("(max-width: 520px)").matches ?
      "左右滑动草坪与卡片查看全场；点击草坪种植。" : tips[0];
    updateUI();
  }
  function endGame(won) {
    if (state.mode !== "playing") return;
    state.mode = won ? "won" : "lost";
    state.selected = null;
    document.getElementById("endIcon").textContent = won ? "✿" : "☠";
    document.getElementById("endKicker").textContent = won ? "LAWN SAVED" : "THE ZOMBIES ATE YOUR BRAINS";
    document.getElementById("endTitle").textContent = won ? "草坪守住了！" : "僵尸进屋了！";
    document.getElementById("endDescription").textContent = won ?
      "你击退了 " + state.kills + " 只僵尸，漂亮地守住了全部五波进攻。" :
      "本局击退 " + state.kills + " 只僵尸。调整植物的布阵，再试一次吧。";
    els.end.classList.remove("hidden");
    sound(won ? "win" : "lose");
    updateUI();
  }
  function setPaused(paused) {
    if (paused && state.mode === "playing") {
      state.mode = "paused"; els.pause.classList.remove("hidden");
    } else if (!paused && state.mode === "paused") {
      state.mode = "playing"; els.pause.classList.add("hidden"); audioReady();
    }
    updateUI();
  }
  function choose(type) {
    if (state.mode !== "playing") return;
    if (state.selected === type) { state.selected = null; updateUI(); return; }
    if (type !== "shovel") {
      if (state.cooldowns[type] > .01) { showToast("植物还在休息中"); sound("error"); return; }
      if (state.sun < types[type].cost) { showToast("阳光不够，先收集阳光！"); sound("error"); return; }
    }
    state.selected = type;
    els.tip.textContent = type === "shovel" ? "点击一株植物将它铲除。" : "已选择" + types[type].name + "：点击草坪种植。";
    updateUI();
  }
  function addPlant(type, row, col) {
    if (state.plants.some(p => p.row === row && p.col === col)) {
      showToast("这块草坪已经有植物了"); sound("error"); return;
    }
    if (state.cooldowns[type] > .01) { showToast("植物还在休息中"); sound("error"); return; }
    if (state.sun < types[type].cost) { showToast("阳光不够，先收集阳光！"); sound("error"); return; }
    const p = {
      id: nextId++, type, row, col, x: cellX(col), y: plantY(row), hp: types[type].hp,
      maxHp: types[type].hp, age: 0, fireTimer: .45, sunTimer: 7.5, armed: false
    };
    state.sun -= types[type].cost;
    state.cooldowns[type] = types[type].cooldown;
    state.plants.push(p);
    particle(p.x, p.y - 23, "#c8eb78", 11, 77, "spark");
    ringParticle(p.x, p.y - 30, "#e5f7a7", 16, .36);
    sound("plant");
    if (type === "cherry") showToast("樱桃炸弹即将爆炸！");
    if (type === "potato") showToast("土豆雷需要 9 秒准备");
    state.selected = null;
    updateUI();
  }
  function removePlant(plant) {
    state.plants = state.plants.filter(p => p !== plant);
    particle(plant.x, plant.y - 35, "#a8c969", 8, 65, "spark");
  }
  function spawnSun(x, y, source = "sky") {
    state.suns.push({ id: nextId++, x, y, targetY: source === "sky" ? 190 + Math.random() * 310 : y + 38,
      life: 12, source, vy: source === "sky" ? 62 : 29 });
  }
  function collectSun(s) {
    state.suns = state.suns.filter(item => item !== s);
    state.sun += 25;
    particle(s.x, s.y, "#ffe579", 12, 100, "spark");
    textParticle(s.x, s.y - 12, "+25", "#fff5a7");
    sound("sun");
    updateUI();
  }
  function spawnZombie(event) {
    const values = { normal: [125, 16.5], cone: [275, 15], bucket: [475, 12.5], flag: [110, 25] };
    const [hp, speed] = values[event.kind];
    state.zombies.push({ id: nextId++, type: event.kind, row: event.row,
      x: 1263 + Math.random() * 30, hp, maxHp: hp, speed,
      biteTimer: .5, slowTimer: 0, flash: 0 });
    if (event.wave >= 4 && Math.random() < .25) {
      particle(1237, GY + event.row * CH + 43, "#bec9a0", 4, 27);
    }
  }
  function fire(p) {
    const base = { x: p.x + 39, y: p.y - 72, row: p.row,
      type: p.type, damage: p.type === "snowpea" ? 23 : 22, speed: 370 };
    state.projectiles.push({ id: nextId++, ...base });
    if (p.type === "repeater") {
      state.projectiles.push({ id: nextId++, ...base, x: base.x - 20, y: base.y + 14, delay: .14 });
    }
    particle(base.x, base.y, p.type === "snowpea" ? "#c5f8f6" : "#b7ec78", 3, 35);
    sound("shot");
  }
  function hitZombie(z, damage, icy = false) {
    z.hp -= damage; z.flash = .12;
    if (icy) z.slowTimer = 4.4;
    particle(z.x - 21, GY + z.row * CH + 34, icy ? "#c6f3f6" : "#94c877", 4, 46);
    if (z.hp <= 0) killZombie(z);
    else sound("hit");
  }
  function killZombie(z) {
    state.zombies = state.zombies.filter(item => item !== z);
    state.kills++;
    const y = GY + z.row * CH + 46;
    particle(z.x, y, z.slowTimer > 0 ? "#b2e4dd" : "#98b582", 14, 115, "spark");
    particle(z.x, y + 15, "#796961", 7, 78);
    if (state.kills % 8 === 0) els.tip.textContent = tips[Math.floor(state.kills / 8) % tips.length];
  }
  function explode(x, y, radius = 145) {
    sound("explode");
    ringParticle(x, y, "#fff2ae", 22, .48);
    ringParticle(x, y, "#f27d4b", 8, .62);
    particle(x, y, "#fbc965", 37, 220, "spark");
    particle(x, y, "#e96449", 24, 160);
    for (const z of [...state.zombies]) {
      const zy = GY + z.row * CH + 40;
      if (Math.hypot((z.x - x) * .72, zy - y) < radius) hitZombie(z, 1100);
    }
  }

  function update(dt) {
    if (state.mode !== "playing") return;
    state.time += dt;
    for (const type in state.cooldowns)
      state.cooldowns[type] = Math.max(0, state.cooldowns[type] - dt);

    while (state.nextSpawn < state.schedule.length &&
      state.schedule[state.nextSpawn].time <= state.time) {
      spawnZombie(state.schedule[state.nextSpawn++]);
    }
    for (let i = waveStarts.length - 1; i >= 0; i--) {
      if (state.time >= waveStarts[i]) { state.wave = i + 1; break; }
    }
    if (state.wave !== state.lastWave) {
      state.lastWave = state.wave;
      showBanner(state.wave === 5 ? "最后一波僵尸来袭！" : "第 " + state.wave + " 波僵尸来袭！");
      sound("wave");
      els.tip.textContent = "新一波进攻开始了，注意薄弱的草坪！";
    }
    if (state.time >= state.nextSkySun) {
      spawnSun(242 + Math.random() * 835, -29, "sky");
      state.nextSkySun = state.time + 5.5 + Math.random() * 1.9;
    }

    for (const p of [...state.plants]) {
      p.age += dt;
      if (p.type === "sunflower") {
        p.sunTimer -= dt;
        if (p.sunTimer <= 0) {
          spawnSun(p.x + (Math.random() - .5) * 26, p.y - 69, "flower");
          p.sunTimer = 11.5 + Math.random() * 2;
          particle(p.x, p.y - 65, "#f7df71", 7, 46, "spark");
        }
      } else if (p.type === "cherry") {
        if (p.age >= .85) {
          explode(p.x, p.y - 42, 160);
          removePlant(p);
        } else if (Math.random() < dt * 18) {
          particle(p.x + (Math.random() - .5) * 28, p.y - 70, "#ffe8a5", 2, 50, "spark");
        }
      } else if (p.type === "potato") {
        if (!p.armed && p.age >= 9) {
          p.armed = true;
          ringParticle(p.x, p.y - 26, "#f8d87c", 7, .4);
        }
        if (p.armed && state.zombies.some(z => z.row === p.row && Math.abs(z.x - p.x) < 43)) {
          explode(p.x, p.y - 33, 107);
          removePlant(p);
        }
      } else if (p.type !== "wallnut") {
        p.fireTimer -= dt;
        const enemyAhead = state.zombies.some(z => z.row === p.row && z.x > p.x + 14 && z.x < W + 30);
        if (enemyAhead && p.fireTimer <= 0) {
          fire(p);
          p.fireTimer = p.type === "repeater" ? 1.42 : p.type === "snowpea" ? 1.55 : 1.4;
        }
        if (!enemyAhead && p.fireTimer < 0) p.fireTimer = .12;
      }
    }

    for (const p of [...state.projectiles]) {
      if (p.delay && p.delay > 0) { p.delay -= dt; continue; }
      p.x += p.speed * dt;
      const target = state.zombies.filter(z => z.row === p.row && Math.abs(z.x - p.x) < 25)
        .sort((a, b) => a.x - b.x)[0];
      if (target) {
        hitZombie(target, p.damage, p.type === "snowpea");
        state.projectiles = state.projectiles.filter(item => item !== p);
      } else if (p.x > W + 24) {
        state.projectiles = state.projectiles.filter(item => item !== p);
      }
    }

    for (const z of [...state.zombies]) {
      if (z.slowTimer > 0) z.slowTimer -= dt;
      if (z.flash > 0) z.flash -= dt;
      const target = state.plants.filter(p => p.row === z.row && z.x - p.x > -21 && z.x - p.x < 47)
        .sort((a, b) => b.x - a.x)[0];
      if (target) {
        z.biteTimer -= dt;
        if (z.biteTimer <= 0) {
          target.hp -= z.type === "bucket" ? 27 : 23;
          z.biteTimer = .78;
          particle(target.x + 18, target.y - 44, "#c5b780", 4, 36);
          if (target.hp <= 0) {
            removePlant(target);
            z.biteTimer = .35;
          }
        }
      } else {
        z.x -= z.speed * (z.slowTimer > 0 ? .49 : 1) * dt;
        z.biteTimer = Math.min(z.biteTimer, .55);
      }
      const mower = state.mowers[z.row];
      if (z.x < 188 && !mower.used) {
        mower.used = true; mower.active = true; mower.x = 151;
        showToast("割草机出动！");
        sound("mower");
      }
      if (z.x < 78 && mower.used && !mower.active) {
        endGame(false);
        break;
      }
    }

    for (const mower of state.mowers) {
      if (!mower.active) continue;
      mower.x += 650 * dt;
      if (Math.random() < dt * 35) particle(mower.x - 27, GY + mower.row * CH + 88, "#d8d2a1", 1, 31);
      for (const z of [...state.zombies]) {
        if (z.row === mower.row && Math.abs(z.x - mower.x) < 44) killZombie(z);
      }
      if (mower.x > W + 42) mower.active = false;
    }

    for (const s of [...state.suns]) {
      if (s.y < s.targetY) s.y = Math.min(s.targetY, s.y + s.vy * dt);
      s.life -= dt;
      if (s.life <= 0) state.suns = state.suns.filter(item => item !== s);
    }
    for (const p of [...state.particles]) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind !== "ring") p.vy += 125 * dt;
      if (p.kind === "ring") p.size += p.grow * dt;
      p.angle += (p.spin || 0) * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles = state.particles.filter(item => item !== p);
    }

    if (state.nextSpawn >= state.schedule.length && state.zombies.length === 0 &&
      state.time > state.schedule[state.schedule.length - 1].time + 2.5) endGame(true);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(terrain, 0, 0);
    const phase = displayTime;
    if (state.mode === "menu") {
      drawPlant(ctx, "sunflower", cellX(0), plantY(1), 1, phase);
      drawPlant(ctx, "peashooter", cellX(2), plantY(2), 1, phase + .4);
      drawPlant(ctx, "wallnut", cellX(1), plantY(4), 1, phase + .8);
      drawPlant(ctx, "snowpea", cellX(5), plantY(0), 1, phase + 1.1);
      drawZombie(ctx, { id: 1, x: 1128, row: 2, type: "normal", hp: 125, maxHp: 125, slowTimer: 0, flash: 0 }, phase);
      drawZombie(ctx, { id: 2, x: 1200, row: 4, type: "cone", hp: 275, maxHp: 275, slowTimer: 0, flash: 0 }, phase);
      for (const mower of state.mowers) drawMower(ctx, mower.x, mower.row, false, phase);
      drawSun(ctx, { x: 943, y: 177, id: 30 }, phase);
      return;
    }

    const danger = state.zombies.filter(z => z.x < 460);
    for (const z of danger) {
      ctx.fillStyle = radial(ctx, 203, GY + z.row * CH + 51, 10, 203, GY + z.row * CH + 51, 160,
        [[0, "rgba(242,105,70,.24)"], [1, "rgba(242,105,70,0)"]]);
      ctx.fillRect(204, GY + z.row * CH, 230, CH);
    }
    if (state.hover && state.selected && state.hover.col >= 0 && state.hover.col < COLS &&
      state.hover.row >= 0 && state.hover.row < ROWS) {
      const x = GX + state.hover.col * CW, y = GY + state.hover.row * CH;
      const occupied = state.plants.some(p => p.row === state.hover.row && p.col === state.hover.col);
      const valid = state.selected === "shovel" ? occupied : !occupied && state.sun >= types[state.selected].cost;
      rr(ctx, x + 4, y + 4, CW - 8, CH - 8, 13,
        valid ? "rgba(235,255,163,.26)" : "rgba(255,112,81,.25)",
        valid ? "rgba(244,255,199,.85)" : "rgba(255,159,134,.76)", 2);
      if (valid && state.selected !== "shovel") {
        ctx.save(); ctx.globalAlpha = .65;
        drawPlant(ctx, state.selected, cellX(state.hover.col), plantY(state.hover.row), 1, phase,
          { armed: state.selected !== "potato" });
        ctx.restore();
      }
    }
    for (const mower of state.mowers) if (!mower.used || mower.active) drawMower(ctx, mower.x, mower.row, mower.active, phase);

    const upcoming = state.schedule[state.nextSpawn];
    if (upcoming && upcoming.time - state.time < 2.6 && upcoming.time - state.time > 0 &&
      Math.floor(phase * 5) % 2 === 0) {
      const y = GY + upcoming.row * CH + 52;
      oval(ctx, 1166, y, 29, 29, "rgba(214,104,72,.62)", "rgba(255,228,160,.68)", 2);
      ctx.fillStyle = "#fff1c8"; ctx.font = "900 34px Georgia"; ctx.textAlign = "center";
      ctx.fillText("!", 1166, y + 11);
    }
    for (const p of [...state.plants].sort((a, b) => a.row - b.row || a.x - b.x)) {
      drawPlant(ctx, p.type, p.x, p.y, 1, phase + p.id * .3, p);
      if (p.type === "potato" && p.armed) {
        ctx.save(); ctx.globalAlpha = .15 + Math.sin(phase * 8) * .08;
        oval(ctx, p.x, p.y - 27, 38, 27, "#ffe275"); ctx.restore();
      }
      if (p.hp < p.maxHp * .68 && p.type !== "wallnut") {
        rr(ctx, p.x - 24, p.y + 3, 48, 4, 2, "rgba(20,49,25,.42)");
        rr(ctx, p.x - 24, p.y + 3, 48 * clamp(p.hp / p.maxHp, 0, 1), 4, 2, "#e6d66f");
      }
    }
    for (const z of [...state.zombies].sort((a, b) => a.row - b.row || b.x - a.x)) drawZombie(ctx, z, phase);
    for (const p of state.projectiles) if (!p.delay || p.delay <= 0) drawProjectile(ctx, p);
    for (const s of state.suns) drawSun(ctx, s, phase);
    for (const p of state.particles) drawParticle(ctx, p);
  }

  function updateUI() {
    els.sun.textContent = String(state.sun);
    els.wave.textContent = "第 " + state.wave + " / 5 波";
    els.kills.textContent = state.kills + " 击倒";
    els.waveFill.style.width = clamp(state.time / 250 * 100, 0, 100).toFixed(1) + "%";
    els.waveStatus.textContent = state.mode === "won" ? "守卫成功" :
      state.mode === "lost" ? "防线失守" : state.mode === "paused" ? "已暂停" :
        state.time < 12 ? "准备迎战" : state.wave === 5 ? "最终攻势" : "正在防守";
    els.pauseLabel.textContent = state.mode === "paused" ? "继续" : "暂停";
    els.pauseIcon.textContent = state.mode === "paused" ? "▶" : "Ⅱ";
    els.speedLabel.textContent = state.speed + "×";
    els.shovel.classList.toggle("is-selected", state.selected === "shovel");
    els.soundBtn.classList.toggle("is-muted", !soundEnabled);
    for (const card of cards) {
      const type = card.dataset.seed, data = types[type], cd = state.cooldowns[type];
      card.classList.toggle("is-selected", state.selected === type);
      card.classList.toggle("is-unaffordable", state.sun < data.cost || cd > 0);
      card.querySelector(".cooldown-mask").style.height = (cd / data.cooldown * 100).toFixed(1) + "%";
      card.setAttribute("aria-pressed", state.selected === type ? "true" : "false");
    }
  }

  function pointerPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * W / rect.width, y: (e.clientY - rect.top) * H / rect.height };
  }
  canvas.addEventListener("pointermove", e => {
    const p = pointerPosition(e);
    state.hover = { row: Math.floor((p.y - GY) / CH), col: Math.floor((p.x - GX) / CW) };
  });
  canvas.addEventListener("pointerleave", () => state.hover = null);
  let pointerStart = null;
  canvas.addEventListener("pointerdown", e => {
    pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  canvas.addEventListener("pointercancel", () => { pointerStart = null; });
  canvas.addEventListener("pointerup", e => {
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    pointerStart = null;
    if (moved > 10) return;
    if (state.mode !== "playing") return;
    const p = pointerPosition(e);
    for (const s of [...state.suns].reverse()) {
      if (Math.hypot(p.x - s.x, p.y - s.y) < 34) { collectSun(s); return; }
    }
    const col = Math.floor((p.x - GX) / CW), row = Math.floor((p.y - GY) / CH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS || !state.selected) return;
    if (state.selected === "shovel") {
      const plant = state.plants.find(item => item.row === row && item.col === col);
      if (plant) { removePlant(plant); sound("plant"); state.selected = null; updateUI(); }
      else showToast("这里没有可以铲除的植物");
    } else addPlant(state.selected, row, col);
  });
  canvas.addEventListener("contextmenu", e => { e.preventDefault(); state.selected = null; updateUI(); });
  cards.forEach(card => card.addEventListener("click", () => choose(card.dataset.seed)));
  els.shovel.addEventListener("click", () => choose("shovel"));
  document.getElementById("startBtn").addEventListener("click", begin);
  document.getElementById("playAgainBtn").addEventListener("click", begin);
  document.getElementById("resumeBtn").addEventListener("click", () => setPaused(false));
  document.getElementById("restartBtn").addEventListener("click", begin);
  els.pauseBtn.addEventListener("click", () => setPaused(state.mode === "playing"));
  document.getElementById("speedBtn").addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : 1;
    showToast("游戏速度 " + state.speed + "×");
    updateUI();
  });
  els.soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) { audioReady(); sound("sun"); }
    updateUI();
  });
  window.addEventListener("keydown", e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key >= "1" && e.key <= "7") {
      choose(Object.keys(types)[Number(e.key) - 1]); e.preventDefault();
    } else if (e.key === "0" || e.key.toLowerCase() === "x") {
      choose("shovel"); e.preventDefault();
    } else if (e.code === "Space") {
      if (state.mode === "menu") begin();
      else setPaused(state.mode === "playing");
      e.preventDefault();
    } else if (e.key === "Escape") {
      if (state.mode === "playing") { state.selected = null; updateUI(); }
    } else if (e.key.toLowerCase() === "m") {
      soundEnabled = !soundEnabled;
      if (soundEnabled) audioReady();
      updateUI();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") setPaused(true);
  });

  let lastFrame = performance.now(), uiElapsed = 0;
  if (window.location.hash === "#debug") {
    window.__PVZ_DEBUG__ = () => ({
      mode: state.mode, time: state.time, wave: state.wave, kills: state.kills,
      nextSpawn: state.nextSpawn,
      zombies: state.zombies.map(z => ({ row: z.row, type: z.type, x: z.x, hp: z.hp })),
      plants: state.plants.map(p => ({ row: p.row, col: p.col, type: p.type, hp: p.hp }))
    });
  }
  function frame(now) {
    const realDt = clamp((now - lastFrame) / 1000, 0, .05);
    lastFrame = now;
    displayTime += realDt;
    if (state.mode === "playing") update(realDt * state.speed);
    draw();
    uiElapsed += realDt;
    if (uiElapsed >= .12) { updateUI(); uiElapsed = 0; }
    requestAnimationFrame(frame);
  }
  updateUI();
  requestAnimationFrame(frame);
})();
