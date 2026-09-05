(() => {
  'use strict';

  const PLANTS = {
    sunflower: { name: '日光花', cost: 50, cooldown: 5, hp: 110, note: '持续生产阳光' },
    shooter: { name: '青豆炮手', cost: 100, cooldown: 7, hp: 120, note: '直线发射青豆' },
    ice: { name: '霜豆炮手', cost: 150, cooldown: 10, hp: 120, note: '攻击并减速敌人' },
    berry: { name: '爆裂莓', cost: 125, cooldown: 18, hp: 1, note: '爆炸波及三行' },
    mushroom: { name: '月光菇', cost: 75, cooldown: 5, hp: 95, note: '近距重击敌人' },
    wallnut: { name: '硬壳果', cost: 50, cooldown: 12, hp: 520, note: '承受大量伤害' },
  };
  const TYPES = Object.keys(PLANTS);
  const TOTAL_TIME = 68;
  const SPAWNS = [
    [5, 2, 0], [9, 0, 0], [12, 4, 0], [16, 1, 0], [19, 3, 0], [23, 2, 0],
    [28, 0, 0], [30, 4, 0], [32, 1, 1], [35, 3, 0], [37, 2, 0], [39, 0, 1], [42, 4, 0], [44, 1, 0], [46, 3, 1],
    [50, 2, 1], [51.5, 0, 0], [53, 4, 0], [54.5, 1, 1], [56, 3, 0], [57.5, 2, 0], [59, 0, 1], [60, 4, 1], [61, 1, 0], [62, 3, 1], [63, 2, 0], [64, 0, 0], [65, 4, 1],
  ].map(([time, row, armored], index) => ({ time, row, armored: Boolean(armored), id: index }));

  const el = (id) => document.getElementById(id);
  const dom = {
    seedBank: el('seedBank'), lawnGrid: el('lawnGrid'), entityLayer: el('entityLayer'),
    sunLayer: el('sunLayer'), fxLayer: el('fxLayer'), mowerLayer: el('mowerLayer'),
    sunCount: el('sunCount'), waveProgress: el('waveProgress'), waveLabel: el('waveLabel'),
    timerLabel: el('timerLabel'), killCount: el('killCount'), scoreCount: el('scoreCount'),
    gameHint: el('gameHint'), startOverlay: el('startOverlay'), startButton: el('startButton'),
    overlayTitle: el('overlayTitle'), overlayCopy: el('overlayCopy'), toastStack: el('toastStack'),
    pauseButton: el('pauseButton'), speedButton: el('speedButton'), soundButton: el('soundButton'),
  };

  let nextId = 1;
  let audio = null;
  let soundOn = true;
  let lastFrame = performance.now();
  let lastRender = 0;
  let plantRenderKey = '';

  const freshState = () => ({
    phase: 'ready', time: 0, speed: 1, sun: 175, selected: 'shooter', kills: 0, score: 0,
    spawnIndex: 0, skySunAt: 4, plants: [], zombies: [], projectiles: [], suns: [], effects: [],
    cooldowns: Object.fromEntries(TYPES.map((type) => [type, 0])),
    mowers: Array.from({ length: 5 }, (_, row) => ({ row, x: -0.18, used: false, active: false })),
  });
  let state = freshState();

  function initBoard() {
    dom.seedBank.innerHTML = TYPES.map((type, index) => {
      const p = PLANTS[type];
      return `<button class="seed-card ${state.selected === type ? 'selected' : ''}" type="button" data-type="${type}" title="${p.note}" aria-label="${index + 1}：${p.name}，消耗 ${p.cost} 阳光">
        <span class="hotkey">${index + 1}</span><span class="sprite ${type}"></span>
        <span class="seed-meta"><b>${p.name}</b><small>☀ ${p.cost}</small></span></button>`;
    }).join('');
    dom.lawnGrid.innerHTML = Array.from({ length: 45 }, (_, index) => {
      const row = Math.floor(index / 9), col = index % 9;
      return `<button class="lawn-cell ${(row + col) % 2 ? 'checker' : ''}" type="button" role="gridcell" data-row="${row}" data-col="${col}" aria-label="第 ${row + 1} 行，第 ${col + 1} 格"></button>`;
    }).join('');
  }

  function playTone(kind) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      const recipes = {
        plant: [[210, .05, .08], [155, .11, .09]],
        shoot: [[480, .02, .04]],
        sun: [[660, .03, .1], [880, .1, .13]],
        hit: [[115, .02, .05]],
        boom: [[70, .01, .32], [42, .06, .36]],
        mower: [[92, .01, .25], [130, .12, .23]],
        lose: [[180, .02, .22], [120, .22, .32]],
        win: [[440, .02, .12], [660, .14, .13], [880, .29, .25]],
      };
      (recipes[kind] || recipes.hit).forEach(([freq, delay, duration]) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = kind === 'boom' || kind === 'mower' ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(.075, now + delay);
        gain.gain.exponentialRampToValueAtTime(.001, now + delay + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(now + delay); oscillator.stop(now + delay + duration);
      });
    } catch { soundOn = false; }
  }

  function toast(message) {
    const item = document.createElement('div');
    item.className = 'toast'; item.textContent = message;
    dom.toastStack.appendChild(item);
    setTimeout(() => item.remove(), 1900);
  }

  function addEffect(type, x, y, text = '') {
    state.effects.push({ id: nextId++, type, x, y, text, until: state.time + .8 });
  }

  function spawnSun(x, y, targetY, value = 25) {
    state.suns.push({ id: nextId++, x, y, targetY, value, expires: state.time + 9 });
  }

  function selectPlant(type) {
    const p = PLANTS[type];
    if (!p) return false;
    if (state.cooldowns[type] > state.time) {
      toast(`${p.name}还需冷却 ${Math.ceil(state.cooldowns[type] - state.time)} 秒`); return false;
    }
    if (state.sun < p.cost) { toast(`还差 ${p.cost - state.sun} 点阳光`); return false; }
    state.selected = type; renderCards(); updateCellTargets(); playTone('plant'); return true;
  }

  function placePlant(type, row, col) {
    if (state.phase !== 'running') return { ok: false, message: '游戏尚未开始或已暂停' };
    const p = PLANTS[type];
    if (!p || row < 0 || row > 4 || col < 0 || col > 8) return { ok: false, message: '无效的植物或草坪位置' };
    if (state.plants.some((plant) => plant.row === row && plant.col === col)) return { ok: false, message: '这格已经种有植物' };
    if (state.cooldowns[type] > state.time) return { ok: false, message: `${p.name}还在冷却` };
    if (state.sun < p.cost) return { ok: false, message: '阳光不足' };
    state.sun -= p.cost;
    state.cooldowns[type] = state.time + p.cooldown;
    state.plants.push({ id: nextId++, type, row, col, hp: p.hp, maxHp: p.hp, nextAction: state.time + (type === 'berry' ? .78 : .7) });
    addEffect('plant', (col + .5) / 9 * 100, (row + .6) / 5 * 100);
    playTone('plant'); plantRenderKey = ''; render(true);
    return { ok: true, message: `已在第 ${row + 1} 行第 ${col + 1} 格种下${p.name}` };
  }

  function removePlant(id) {
    const plant = state.plants.find((item) => item.id === id);
    if (!plant) return;
    state.plants = state.plants.filter((item) => item.id !== id);
    addEffect('text', (plant.col + .35) / 9 * 100, (plant.row + .55) / 5 * 100, '移除');
    plantRenderKey = ''; playTone('hit'); render(true);
  }

  function spawnZombie(spec) {
    const hp = spec.armored ? 260 : 110;
    state.zombies.push({ id: nextId++, row: spec.row, x: 9.42 + Math.random() * .22, hp, maxHp: hp, speed: spec.armored ? .104 : .148, armored: spec.armored, slowedUntil: 0, nextBite: 0, biting: false, dead: false });
    if (spec.id === 0) toast('草丛里传来了脚步声…');
    if (spec.id === 6) { toast('第二波正在逼近！'); playTone('mower'); }
    if (spec.id === 15) { toast('最后一大波来袭！'); playTone('boom'); }
  }

  function damageZombie(zombie, damage, slow = false) {
    if (zombie.dead) return;
    zombie.hp -= damage;
    if (slow) zombie.slowedUntil = Math.max(zombie.slowedUntil, state.time + 3.2);
    if (zombie.hp <= 0) {
      zombie.dead = true; state.kills += 1; state.score += zombie.armored ? 240 : 100;
      addEffect('text', zombie.x / 9 * 100, (zombie.row + .45) / 5 * 100, `+${zombie.armored ? 240 : 100}`);
      if (Math.random() < .16) spawnSun(zombie.x / 9 * 100, (zombie.row + .3) / 5 * 100, (zombie.row + .55) / 5 * 100, 25);
    }
  }

  function explodePlant(plant) {
    playTone('boom');
    addEffect('burst', (plant.col + .5) / 9 * 100, (plant.row + .5) / 5 * 100);
    state.zombies.forEach((zombie) => {
      if (!zombie.dead && Math.abs(zombie.row - plant.row) <= 1 && Math.abs(zombie.x - (plant.col + .5)) < 2.05) damageZombie(zombie, 330);
    });
    state.plants = state.plants.filter((item) => item.id !== plant.id);
    plantRenderKey = '';
  }

  function activateMower(row) {
    const mower = state.mowers[row];
    if (!mower || mower.used) return false;
    mower.used = true; mower.active = true; mower.x = -.05;
    toast(`第 ${row + 1} 行草坪车启动！`); playTone('mower');
    return true;
  }

  function gameTick(dt) {
    state.time += dt;
    while (state.spawnIndex < SPAWNS.length && SPAWNS[state.spawnIndex].time <= state.time) spawnZombie(SPAWNS[state.spawnIndex++]);
    if (state.time >= state.skySunAt) {
      spawnSun(18 + Math.random() * 68, -10, 16 + Math.random() * 66, 25);
      state.skySunAt += 7.5 + Math.random() * 2;
    }

    state.plants.slice().forEach((plant) => {
      if (plant.hp <= 0) return;
      if (plant.type === 'berry' && state.time >= plant.nextAction) { explodePlant(plant); return; }
      if (state.time < plant.nextAction) return;
      if (plant.type === 'sunflower') {
        spawnSun((plant.col + .5) / 9 * 100, (plant.row + .12) / 5 * 100, (plant.row + .55) / 5 * 100, 25);
        plant.nextAction = state.time + 8.2; return;
      }
      const target = state.zombies.find((z) => !z.dead && z.row === plant.row && z.x > plant.col + .25 && (plant.type !== 'mushroom' || z.x - plant.col < 3.15));
      if (!target) { plant.nextAction = state.time + .18; return; }
      const isIce = plant.type === 'ice', isSpore = plant.type === 'mushroom';
      state.projectiles.push({ id: nextId++, row: plant.row, x: plant.col + .78, damage: isSpore ? 42 : isIce ? 16 : 24, slow: isIce, type: isSpore ? 'spore' : isIce ? 'ice' : 'pea' });
      plant.nextAction = state.time + (isSpore ? 1.65 : isIce ? 1.55 : 1.32); playTone('shoot');
    });

    state.projectiles.forEach((shot) => {
      const previousX = shot.x;
      shot.x += (shot.type === 'spore' ? 2.05 : 2.65) * dt;
      const hit = state.zombies.filter((z) => !z.dead && z.row === shot.row && z.x >= previousX - .12 && z.x <= shot.x + .32).sort((a, b) => a.x - b.x)[0];
      if (hit) {
        damageZombie(hit, shot.damage, shot.slow); shot.hit = true; playTone('hit');
        addEffect('spark', hit.x / 9 * 100, (hit.row + .5) / 5 * 100);
      }
    });
    state.projectiles = state.projectiles.filter((shot) => !shot.hit && shot.x < 9.6);

    state.zombies.forEach((zombie) => {
      if (zombie.dead) return;
      const target = state.plants.filter((p) => p.row === zombie.row && p.hp > 0 && zombie.x - (p.col + .5) < .5 && zombie.x - (p.col + .5) > -.34).sort((a, b) => b.col - a.col)[0];
      zombie.biting = Boolean(target);
      if (target) {
        if (state.time >= zombie.nextBite) {
          target.hp -= zombie.armored ? 31 : 24; zombie.nextBite = state.time + .72; playTone('hit');
          if (target.hp <= 0) { state.plants = state.plants.filter((p) => p.id !== target.id); plantRenderKey = ''; }
        }
      } else {
        const slowed = zombie.slowedUntil > state.time;
        zombie.x -= zombie.speed * (slowed ? .47 : 1) * dt;
      }
      if (zombie.x < .18) {
        const mower = state.mowers[zombie.row];
        if (!mower.used) activateMower(zombie.row);
        else if (!mower.active && zombie.x < -.22) endGame(false);
      }
    });

    state.mowers.forEach((mower) => {
      if (!mower.active) return;
      mower.x += 4.1 * dt;
      state.zombies.forEach((zombie) => {
        if (!zombie.dead && zombie.row === mower.row && Math.abs(zombie.x - mower.x) < .72) damageZombie(zombie, 9999);
      });
      if (mower.x > 9.8) mower.active = false;
    });

    state.suns.forEach((sun) => { if (sun.y < sun.targetY) sun.y = Math.min(sun.targetY, sun.y + 21 * dt); });
    state.suns = state.suns.filter((sun) => sun.expires > state.time);
    state.effects = state.effects.filter((effect) => effect.until > state.time);
    state.zombies = state.zombies.filter((zombie) => !zombie.dead);

    if (state.spawnIndex >= SPAWNS.length && state.zombies.length === 0 && state.time > 65) endGame(true);
  }

  function endGame(won) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    state.phase = won ? 'won' : 'lost'; playTone(won ? 'win' : 'lose');
    dom.overlayTitle.textContent = won ? '花园守住了！' : '怪客闯进了门廊…';
    dom.overlayCopy.textContent = won ? `你击退了 ${state.kills} 名怪客，最终得分 ${state.score}。月亮会记住这场漂亮的防守。` : `你坚持了 ${Math.floor(state.time)} 秒。调整植物阵线，再试一次就能守得更久。`;
    dom.startButton.querySelector('span').textContent = '再守一夜';
    dom.startButton.querySelector('i').textContent = '↻';
    dom.startOverlay.classList.remove('hidden');
  }

  function beginGame() {
    if (state.phase === 'won' || state.phase === 'lost') { state = freshState(); initBoard(); plantRenderKey = ''; }
    state.phase = 'running'; dom.startOverlay.classList.add('hidden'); dom.pauseButton.textContent = 'Ⅱ';
    dom.overlayTitle.textContent = '今夜，花园需要你。'; dom.overlayCopy.textContent = '种下植物，收集阳光，在三波怪客踏进门廊前守住五条草坪。';
    dom.startButton.querySelector('span').textContent = '开始守夜'; dom.startButton.querySelector('i').textContent = '→';
    playTone('win'); toast('选一张卡牌，然后点击草坪种下'); render(true);
  }

  function togglePause() {
    if (state.phase === 'ready' || state.phase === 'won' || state.phase === 'lost') return;
    state.phase = state.phase === 'paused' ? 'running' : 'paused';
    dom.pauseButton.textContent = state.phase === 'paused' ? '▶' : 'Ⅱ';
    toast(state.phase === 'paused' ? '月色暂停了' : '继续守夜');
  }

  function collectSun(id) {
    const token = state.suns.find((sun) => sun.id === id); if (!token) return false;
    state.sun += token.value; state.score += token.value; state.suns = state.suns.filter((sun) => sun.id !== id);
    addEffect('text', token.x, token.y, `+${token.value} ☀`); playTone('sun'); render(true); return true;
  }

  function renderCards() {
    TYPES.forEach((type) => {
      const button = dom.seedBank.querySelector(`[data-type="${type}"]`); if (!button) return;
      const p = PLANTS[type], remaining = Math.max(0, state.cooldowns[type] - state.time);
      button.classList.toggle('selected', state.selected === type);
      button.disabled = state.sun < p.cost || remaining > 0 || state.phase === 'paused';
      button.style.setProperty('--cool', `${Math.min(100, remaining / p.cooldown * 100)}%`);
      const cost = button.querySelector('small'); cost.textContent = remaining > 0 ? `◷ ${remaining.toFixed(1)}` : `☀ ${p.cost}`;
    });
  }

  function updateCellTargets() {
    const canAfford = PLANTS[state.selected] && state.sun >= PLANTS[state.selected].cost && state.cooldowns[state.selected] <= state.time;
    dom.lawnGrid.querySelectorAll('.lawn-cell').forEach((cell) => {
      const row = Number(cell.dataset.row), col = Number(cell.dataset.col), occupied = state.plants.some((p) => p.row === row && p.col === col);
      cell.classList.toggle('valid-target', canAfford && !occupied && state.phase === 'running');
      cell.classList.toggle('invalid-target', occupied);
    });
  }

  function renderPlants() {
    const key = state.plants.map((p) => `${p.id}:${Math.ceil(p.hp / 8)}`).join('|');
    if (key === plantRenderKey) return;
    plantRenderKey = key;
    dom.lawnGrid.querySelectorAll('.lawn-cell').forEach((cell) => { cell.innerHTML = ''; });
    state.plants.forEach((plant) => {
      const cell = dom.lawnGrid.querySelector(`[data-row="${plant.row}"][data-col="${plant.col}"]`);
      if (!cell) return;
      const damaged = plant.hp < plant.maxHp * .98;
      cell.innerHTML = `<span class="plant-unit ${damaged ? 'damaged' : ''} ${plant.type === 'berry' ? 'bomb-armed' : ''}" data-plant-id="${plant.id}">
        <span class="sprite ${plant.type}"></span><span class="hp-bar"><i style="width:${Math.max(0, plant.hp / plant.maxHp * 100)}%"></i></span></span>`;
      cell.setAttribute('aria-label', `第 ${plant.row + 1} 行第 ${plant.col + 1} 格，${PLANTS[plant.type].name}`);
    });
  }

  function renderEntities() {
    const zombieHtml = state.zombies.map((z) => `<span class="zombie-unit ${z.armored ? 'armored' : ''} ${z.slowedUntil > state.time ? 'slowed' : ''} ${z.biting ? 'biting' : ''} ${z.hp < z.maxHp * .98 ? 'damaged' : ''}" style="left:${z.x / 9 * 100 - 5.555}%;top:${z.row * 20}%">
      <span class="sprite ${z.armored ? 'armored' : 'zombie'}"></span><span class="hp-bar"><i style="width:${Math.max(0, z.hp / z.maxHp * 100)}%"></i></span></span>`).join('');
    const projectileHtml = state.projectiles.map((p) => `<i class="projectile ${p.type === 'pea' ? '' : p.type}" style="left:${p.x / 9 * 100}%;top:${(p.row + .5) / 5 * 100}%"></i>`).join('');
    dom.entityLayer.innerHTML = zombieHtml + projectileHtml;
    dom.mowerLayer.innerHTML = state.mowers.map((m) => `<i class="mower ${m.used && !m.active ? 'used' : ''} ${m.active ? 'active' : ''}" style="left:${m.x / 9 * 100}%;top:${m.row * 20}%"></i>`).join('');
    dom.sunLayer.innerHTML = state.suns.map((sun) => `<button class="sun-token" type="button" data-sun-id="${sun.id}" style="left:calc(${sun.x}% - 32px);top:calc(${sun.y}% - 32px)" aria-label="收集 ${sun.value} 点阳光"><span class="sprite sun"></span></button>`).join('');
    dom.fxLayer.innerHTML = state.effects.map((fx) => fx.type === 'text'
      ? `<span class="float-text" style="left:${fx.x}%;top:${fx.y}%">${fx.text}</span>`
      : `<i class="${fx.type === 'burst' ? 'burst' : 'hit-spark'}" style="left:${fx.x}%;top:${fx.y}%"></i>`).join('');
  }

  function render(force = false) {
    renderCards(); renderPlants(); renderEntities(); updateCellTargets();
    dom.sunCount.textContent = String(state.sun);
    dom.killCount.textContent = String(state.kills); dom.scoreCount.textContent = String(state.score);
    const progress = Math.min(100, state.time / TOTAL_TIME * 100); dom.waveProgress.style.width = `${progress}%`;
    dom.timerLabel.textContent = state.phase === 'ready' ? '准备' : `${Math.max(0, Math.ceil(TOTAL_TIME - state.time))}s`;
    dom.waveLabel.textContent = state.time < 5 ? '月色正静…' : state.time < 27 ? '第一波' : state.time < 49 ? '第二波' : '最后一波';
    if (force) lastRender = performance.now();
  }

  function frame(now) {
    const realDt = Math.min(.12, (now - lastFrame) / 1000); lastFrame = now;
    if (state.phase === 'running') gameTick(realDt * state.speed);
    if (now - lastRender > 70) { render(); lastRender = now; }
    requestAnimationFrame(frame);
  }

  dom.seedBank.addEventListener('click', (event) => {
    const card = event.target.closest('[data-type]'); if (card) selectPlant(card.dataset.type);
  });
  dom.lawnGrid.addEventListener('click', (event) => {
    const cell = event.target.closest('.lawn-cell'); if (!cell) return;
    const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
    const existing = state.plants.find((p) => p.row === row && p.col === col);
    if (existing && event.shiftKey) { removePlant(existing.id); toast('已移除植物'); return; }
    const result = placePlant(state.selected, row, col); if (!result.ok) toast(result.message);
  });
  dom.lawnGrid.addEventListener('contextmenu', (event) => {
    event.preventDefault(); const cell = event.target.closest('.lawn-cell'); if (!cell) return;
    const plant = state.plants.find((p) => p.row === Number(cell.dataset.row) && p.col === Number(cell.dataset.col));
    if (plant) { removePlant(plant.id); toast('已铲除植物'); }
  });
  dom.lawnGrid.addEventListener('dblclick', (event) => {
    const cell = event.target.closest('.lawn-cell'); if (!cell) return;
    const plant = state.plants.find((p) => p.row === Number(cell.dataset.row) && p.col === Number(cell.dataset.col));
    if (plant) { removePlant(plant.id); toast('已铲除植物'); }
  });
  dom.sunLayer.addEventListener('click', (event) => {
    const token = event.target.closest('[data-sun-id]'); if (token) collectSun(Number(token.dataset.sunId));
  });
  dom.startButton.addEventListener('click', beginGame);
  dom.pauseButton.addEventListener('click', togglePause);
  dom.speedButton.addEventListener('click', () => { state.speed = state.speed === 1 ? 2 : 1; dom.speedButton.textContent = `${state.speed}×`; toast(`${state.speed} 倍速`); });
  dom.soundButton.addEventListener('click', () => { soundOn = !soundOn; dom.soundButton.classList.toggle('is-off', !soundOn); dom.soundButton.setAttribute('aria-label', soundOn ? '关闭声音' : '打开声音'); if (soundOn) playTone('sun'); });
  window.addEventListener('keydown', (event) => {
    if (/^[1-6]$/.test(event.key)) selectPlant(TYPES[Number(event.key) - 1]);
    if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    if (event.key === 'Escape') { state.selected = ''; renderCards(); updateCellTargets(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'running') togglePause(); });

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== 'function') return;
    const lifecycle = new AbortController();
    const register = (tool) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    void register({
      name: 'begin_moon_garden_game', title: '开始守夜', description: '开始或重新开始当前的月光花园守卫战。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() { beginGame(); return { phase: state.phase, sun: state.sun }; },
    });
    void register({
      name: 'plant_moon_garden_seed', title: '种下植物', description: '在可用的五行九列草坪中种下一株植物；行列均从 1 开始。',
      inputSchema: { type: 'object', properties: { type: { type: 'string', enum: TYPES }, row: { type: 'integer', minimum: 1, maximum: 5 }, col: { type: 'integer', minimum: 1, maximum: 9 } }, required: ['type', 'row', 'col'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) { const result = placePlant(input.type, input.row - 1, input.col - 1); if (!result.ok) throw new Error(result.message); return { placed: true, type: input.type, row: input.row, col: input.col, sunRemaining: state.sun }; },
    });
    void register({
      name: 'read_moon_garden_state', title: '读取战局', description: '读取当前阶段、阳光、得分和场上单位数量。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return { phase: state.phase, elapsedSeconds: Math.round(state.time), sun: state.sun, score: state.score, plants: state.plants.length, enemies: state.zombies.length, kills: state.kills }; },
    });
  }

  initBoard(); render(true); registerWebMCP(); requestAnimationFrame(frame);
})();
