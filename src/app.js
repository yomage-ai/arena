'use strict';
(() => {
 const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
 const icons={book:'<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3z"/><path d="M12 6v15M6 8h3M15 8h3M6 12h3M15 12h3"/>',settings:'<path d="m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3z" transform="translate(1 0) scale(.91)"/><circle cx="12" cy="12" r="3"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',play:'<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8M20 5q7 7 0 14"/>',mute:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>',sprout:'<path d="M12 22V12M12 15Q0 16 3 5q10 0 9 10ZM12 11Q12 0 22 3q-1 9-10 8"/>'};
 function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.sprout}</svg>`;}
 document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
 const storage={get(key,fallback=null){try{const v=localStorage.getItem('sunny-yard-v1-'+key);return v?JSON.parse(v):fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('sunny-yard-v1-'+key,JSON.stringify(value));return true;}catch{return false;}},remove(key){try{localStorage.removeItem('sunny-yard-v1-'+key);}catch{}}};
 const settings=Object.assign({sound:true,music:true,effects:true,autoSun:false},storage.get('settings',{}));
 const audio=new GardenAudio();audio.enabled=settings.sound;audio.music=settings.music;
 let selected=null,mode='adventure',speed=1,hover=null,visualTime=0,particles=[],rings=[],floaters=[],dead=[],flying=[],shake=0,modalPrior=null,modalKind='',toastTimer,bannerTimer,saveClock=0,tutorialDismissed=false,lastSun=-1,hudClock=0;
 const game=new GardenGame({onEvent:onGameEvent});const bg=Art.background();
 const seedEls={};
 function freezeCanvas(target){const img=document.createElement('img');for(const a of target.attributes)img.setAttribute(a.name,a.value);img.alt='';img.src=target.toDataURL('image/png');target.replaceWith(img);}
 function paintPortrait(target,type,zombie=false,scale=1){const c=target.getContext('2d');c.clearRect(0,0,target.width,target.height);const factor=target.width/110;c.save();c.scale(factor,factor);if(zombie)Art.zombie(c,type,60,137,1,{scale:scale*.87});else Art.plant(c,type,52,101,.6,{scale:scale*.8});c.restore();}
 for(const [i,[type,def]] of Object.entries(PLANTS).entries()){
  const b=document.createElement('button');b.className='seed-card';b.dataset.plant=type;b.setAttribute('aria-label',`${def.name}，${def.cost} 阳光，快捷键 ${i+1}`);b.setAttribute('aria-pressed','false');
  b.innerHTML=`<span class="seed-title" style="background:${def.color}55">${def.name}</span><span class="seed-key">${i+1}</span><canvas width="150" height="130" aria-hidden="true"></canvas><span class="seed-cost">${def.cost}</span><span class="seed-cooldown"></span><span class="seed-timer"></span>`;
  $('seed-packets').append(b);const pc=b.querySelector('canvas').getContext('2d');pc.scale(1.35,1.35);Art.plant(pc,type,53,91,1,{scale:.87});freezeCanvas(b.querySelector('canvas'));seedEls[type]=b;
  b.addEventListener('click',()=>selectPlant(type));
  b.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches){const tip=$('plant-tooltip');tip.innerHTML=`<strong>${def.name}</strong><em>${def.role} · ${def.cooldown}s 冷却</em><p>${def.desc}</p>`;tip.hidden=false;const stage=$('stage').getBoundingClientRect(),r=b.getBoundingClientRect();tip.style.left=Math.min(stage.width-270,Math.max(10,r.left-stage.left))+'px';}});
  b.addEventListener('pointerleave',()=>{$('plant-tooltip').hidden=true;});
 }
 const brandCtx=$('brand-art').getContext('2d');Art.plant(brandCtx,'pea',46,104,0,{scale:1});const sunCtx=$('sun-art').getContext('2d');Art.sun(sunCtx,55,55,0,1.1);freezeCanvas($('brand-art'));freezeCanvas($('sun-art'));
 function selectPlant(type){audio.init();audio.play('click');if(game.state==='ready'){toast('先点击「开始守卫」，再种下你的小队。');return;}if(game.state!=='playing')return;selected=selected===type?null:type;refreshSelection();}
 function refreshSelection(){for(const [type,el] of Object.entries(seedEls)){el.classList.toggle('selected',selected===type);el.setAttribute('aria-pressed',String(selected===type));}$('shovel-btn').setAttribute('aria-pressed',String(selected==='shovel'));$('selection-hint').hidden=!selected;$('selection-hint').textContent=selected==='shovel'?'点击植物移除 · Esc 取消':selected?`${PLANTS[selected].name} · 点击空草坪种植 · Esc 取消`:'';canvas.style.cursor=selected==='shovel'?'crosshair':selected?'cell':'default';}
 function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300);}
 function banner(text,huge=false){$('wave-banner').textContent=text;$('wave-banner').style.color=huge?'#ffd199':'#fff3c5';$('wave-banner').classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{$('wave-banner').classList.remove('show');$('wave-banner').textContent='';},2700);}
 function burst(x,y,count,color,power=70){if(!settings.effects)return;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=power*(.3+Math.random());particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:.5+Math.random()*.55,max:1.05,size:2+Math.random()*5,color,angle:Math.random()*6});}}
 function floater(x,y,text,color='#fff6be'){floaters.push({x,y,text,color,life:1.3});}
 function onGameEvent(e){
  switch(e.type){
   case'plant':burst(e.plant.x,e.plant.y,14,'#b8cf73',75);burst(e.plant.x,e.plant.y,8,'#876c42',55);audio.play('plant');if(!tutorialDismissed){$('tutorial-text').textContent=e.plant.type==='sunflower'?'很好！点击金色阳光收集，再为每条路布置射手。':'在每条路上安排射手，用坚果挡住靠近的僵尸。';}break;
   case'shovel':burst(e.plant.x,e.plant.y-15,17,'#8fa850',80);audio.play('plant');break;
   case'collect':flying.push({x:e.sun.x,y:e.sun.y,sx:e.sun.x,sy:e.sun.y,age:0});floater(e.sun.x,e.sun.y-20,'+25','#fff1a0');audio.play('collect');break;
   case'shoot':audio.play('shoot');break;
   case'hit':burst(e.x,e.y,5,e.ice?'#c4f6ff':'#b2e772',45);audio.play('hit');break;
   case'kill':dead.push({...e.zombie,life:.58});burst(e.zombie.x,e.zombie.y-50,10,'#b9c69a',65);audio.play('kill');break;
   case'armor':burst(e.zombie.x,e.zombie.y-110,8,e.zombie.type==='cone'?'#dc9854':'#b1c3b7',90);break;
   case'explode':rings.push({x:e.x,y:e.y,r:8,max:e.radius*1.15,life:.65});burst(e.x,e.y,48,'#f8d774',220);burst(e.x,e.y,25,'#ea8d4e',160);shake=settings.effects?12:0;floater(e.x,e.y-60,e.type==='cherry'?'BOOM!':'SPUDOW!','#fff0ab');audio.play('explode');break;
   case'wave':banner(e.huge?(e.wave===6?'最后一波！守住草坪！':'一大波僵尸正在接近！'):`第 ${e.wave} 波 · 僵尸来了`,e.huge);audio.play('wave');break;
   case'mower':audio.play('mower');toast('割草机出动！这条路的最后一道防线。');break;
   case'chomp':burst(e.plant.x+30,e.plant.y-55,12,'#ceb0d4',65);audio.play('chomp');break;
   case'plantLost':burst(e.plant.x,e.plant.y-20,16,'#83b450',70);break;
   case'end':finish(e.won);break;
  }
 }
 function startGame(resume=false){
  closeModal(false);audio.init();game.reset(mode);
  if(resume){const saved=storage.get('save');if(!game.restore(saved)){toast('没有可继续的存档，已开启新的冒险。');}setMode(game.mode);}
  selected=null;hover=null;particles=[];rings=[];floaters=[];dead=[];flying=[];saveClock=0;tutorialDismissed=false;
  $('lobby').hidden=true;$('tutorial-toast').hidden=false;$('tutorial-text').textContent=resume?'欢迎回来。你的植物小队还在等你！':'先收集阳光、种下向日葵。已有一组植物帮你起步！';$('pause-btn').disabled=false;refreshSelection();refreshHUD();
  $('chapter-value').textContent=mode==='endless'?'无尽庭院':'晴日庭院';$('chapter-sub').textContent=mode==='endless'?'看看你的极限在哪里':'第 1 天 · 白昼';
  banner(resume?'欢迎回到庭院':'准备，种植！');saveGame();
 }
 function saveGame(){if(['playing','paused'].includes(game.state))storage.set('save',game.serialize());}
 function returnLobby(){if(['playing','paused'].includes(game.state))saveGame();closeModal(false);game.reset(mode);game.state='ready';selected=null;particles=[];rings=[];dead=[];flying=[];floaters=[];clearTimeout(bannerTimer);$('wave-banner').classList.remove('show');$('wave-banner').textContent='';$('lobby').hidden=false;$('tutorial-toast').hidden=true;$('pause-btn').disabled=true;$('resume-btn').hidden=!storage.get('save');refreshSelection();refreshHUD();}
 function refreshHUD(){
  if(lastSun!==game.sun){$('sun-value').textContent=game.sun;if(lastSun>=0&&game.sun>lastSun){$('sun-value').classList.remove('pulse');void $('sun-value').offsetWidth;$('sun-value').classList.add('pulse');}lastSun=game.sun;}
  for(const [type,el] of Object.entries(seedEls)){const left=game.state==='ready'?0:(game.cooldowns[type]||0);el.querySelector('.seed-cooldown').style.transform=`scaleY(${left/PLANTS[type].cooldown})`;el.querySelector('.seed-timer').textContent=left>.05?Math.ceil(left):'';el.classList.toggle('unaffordable',game.state!=='ready'&&game.sun<PLANTS[type].cost&&left<=0);}
  const ready=game.state==='ready';$('game-time').textContent=ready?'00:00':formatTime(game.time);$('game-status').textContent=ready?'庭院已就绪':game.state==='paused'?'休息一下':game.state==='won'?'守卫成功':game.state==='lost'?'庭院失守':'守卫进行中';
  $('kill-stat').textContent=ready?'小心，它们想吃掉你的脑子。':`击退 ${game.kills} 只僵尸`;$('wave-fill').style.width=ready?'0%':`${Math.min(100,(game.wave/(mode==='endless'?Math.max(6,game.wave+1):6))*100)}%`;
  $('wave-count').innerHTML=`${ready?0:game.wave} <span>/ ${mode==='endless'?'∞':'6'}</span>`;$('wave-label').textContent=!ready&&game.wave===0?`准备 ${Math.max(0,Math.ceil(game.waveClock))}s`:'进攻波次';$('pause-btn').innerHTML=icon(game.state==='paused'?'play':'pause');$('sound-btn').innerHTML=icon(settings.sound?'sound':'mute');$('sound-btn').setAttribute('aria-label',settings.sound?'关闭声音':'开启声音');
 }
 function formatTime(sec){return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`;}
 function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1600,y:(e.clientY-r.top)/r.height*760};}
 function tile(p){return{row:Math.floor((p.y-BOARD.y)/BOARD.ch),col:Math.floor((p.x-BOARD.x)/BOARD.cw)};}
 canvas.addEventListener('pointermove',e=>{const p=point(e);hover={...p,...tile(p)};if(game.state==='playing'&&game.suns.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<40))canvas.style.cursor='pointer';else canvas.style.cursor=selected?'crosshair':'default';});
 canvas.addEventListener('pointerleave',()=>hover=null);
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||game.state!=='playing')return;e.preventDefault();audio.init();const p=point(e);hover={...p,...tile(p)};
  const s=[...game.suns].reverse().find(s=>Math.hypot(s.x-p.x,s.y-p.y)<42);if(s){game.collect(s.id);refreshHUD();return;}
  if(!selected){if(p.x>BOARD.x&&p.x<1350&&p.y>BOARD.y&&p.y<672)toast('先选择上方的植物卡片，再点击空草坪。');return;}
  const {row,col}=tile(p);if(selected==='shovel'){if(game.shovel(row,col)){selected=null;refreshSelection();}else toast('这里没有需要移除的植物。');return;}
  const result=game.plant(selected,row,col);if(!result.ok)toast(result.error);else{if(!e.shiftKey)selected=null;refreshSelection();refreshHUD();}
 });
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();selected=null;refreshSelection();});
 $('shovel-btn').addEventListener('click',()=>{if(game.state!=='playing'){toast('开始守卫后就可以使用铲子。');return;}audio.play('click');selected=selected==='shovel'?null:'shovel';refreshSelection();});
 $('start-btn').addEventListener('click',()=>startGame());$('resume-btn').addEventListener('click',()=>startGame(true));
 $('adventure-mode').addEventListener('click',()=>setMode('adventure'));$('endless-mode').addEventListener('click',()=>setMode('endless'));
 function setMode(value){mode=value;for(const m of ['adventure','endless']){$(m+'-mode').classList.toggle('active',m===mode);$(m+'-mode').setAttribute('aria-pressed',String(m===mode));}$('chapter-value').textContent=mode==='endless'?'无尽庭院':'晴日庭院';$('chapter-sub').textContent=mode==='endless'?'看看你的极限在哪里':'第 1 天 · 白昼';refreshHUD();}
 $('dismiss-tutorial').addEventListener('click',()=>{tutorialDismissed=true;$('tutorial-toast').hidden=true;});
 $('speed-btn').addEventListener('click',()=>{speed=speed===1?2:1;$('speed-btn').textContent=speed+'×';audio.play('click');});
 $('sound-btn').addEventListener('click',()=>{settings.sound=!settings.sound;audio.enabled=settings.sound;if(settings.sound){audio.init();audio.play('collect');}storage.set('settings',settings);refreshHUD();});
 $('fullscreen-btn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.app').requestFullscreen();}catch{toast('当前浏览器不支持全屏，可使用浏览器的全屏功能。');}});
 function openModal(kind,content){if($('modal-backdrop').hidden){modalPrior=game.state;if(game.state==='playing'){game.state='paused';saveGame();}}modalKind=kind;$('modal-content').innerHTML=content;$('modal-backdrop').hidden=false;document.body.style.overflow='hidden';$('modal-close').focus();refreshHUD();}
 function closeModal(resume=true){$('modal-backdrop').hidden=true;document.body.style.overflow='';if(resume&&modalPrior==='playing'&&game.state==='paused')game.state='playing';modalPrior=null;modalKind='';refreshHUD();}
 function portraitMarkup(type,zombie=false,cls='pause-art'){return `<canvas class="${cls}" width="220" height="${zombie?290:220}" data-portrait="${type}" data-zombie="${zombie}" aria-hidden="true"></canvas>`;}
 function renderPortraits(){document.querySelectorAll('canvas[data-portrait]').forEach(el=>{paintPortrait(el,el.dataset.portrait,el.dataset.zombie==='true');freezeCanvas(el);});}
 function pause(){if(game.state==='paused'&&modalKind==='pause'){closeModal();return;}if(game.state!=='playing')return;openModal('pause',`<div class="center-modal">${portraitMarkup('sunflower')}<div class="modal-eyebrow">TAKE A LITTLE SUNSHINE BREAK</div><h2 id="modal-title">草坪也需要喘口气。</h2><p class="modal-subtitle">战斗已暂停。植物们会在这里等你回来。</p><div class="modal-actions"><button class="primary-button" id="continue-btn">继续守卫 →</button><button class="secondary-button" id="restart-btn">重新开始</button></div><div class="modal-actions"><button class="text-button" id="home-btn">保存并返回庭院</button></div></div>`);renderPortraits();$('continue-btn').onclick=()=>closeModal();$('restart-btn').onclick=()=>startGame();$('home-btn').onclick=returnLobby;}
 $('pause-btn').onclick=pause;
 function closeCurrentModal(){if(modalKind==='end')returnLobby();else closeModal();}
 $('modal-close').onclick=closeCurrentModal;$('modal-backdrop').addEventListener('pointerdown',e=>{if(e.target===$('modal-backdrop'))closeCurrentModal();});
 function showAlmanac(category='plants'){
  const entries=Object.entries(category==='plants'?PLANTS:ZOMBIES);openModal('almanac',`<div class="modal-eyebrow">THE NEIGHBOURHOOD FIELD GUIDE</div><h2 id="modal-title">知己知彼，百战百胜。</h2><p class="modal-subtitle">认识你的植物伙伴，也认识那些想来蹭饭的邻居。</p><div class="almanac-tabs"><button id="plants-tab" class="${category==='plants'?'active':''}">植物小队 · 08</button><button id="zombies-tab" class="${category==='zombies'?'active':''}">不速之客 · 05</button></div><div class="almanac-grid">${entries.map(([type,d])=>`<article class="almanac-card">${category==='plants'?`<span class="plant-price">☀ ${d.cost}</span>`:''}${portraitMarkup(type,category==='zombies','almanac-portrait')}<h3>${d.name}</h3><span class="role-tag">${d.role||d.hp+' 生命值'}</span><p>${d.desc}</p></article>`).join('')}</div>`);renderPortraits();$('plants-tab').onclick=()=>showAlmanac('plants');$('zombies-tab').onclick=()=>showAlmanac('zombies');
 }
 $('almanac-btn').onclick=()=>showAlmanac();
 function showSettings(){openModal('settings',`<div class="modal-eyebrow">MAKE YOURSELF AT HOME</div><h2 id="modal-title">你的庭院，你做主。</h2><p class="modal-subtitle">调整一点小细节，让守卫更加惬意。</p>${[['sound','游戏声音','种植、阳光、射击和爆炸的声音'],['music','庭院音乐','轻松的原创合成旋律'],['effects','战斗特效','飞散的叶片、命中粒子与爆炸震动'],['autoSun','自动收集阳光','阳光出现 2 秒后自动收集，轻松专注于布阵']].map(([key,title,sub])=>`<div class="setting-row"><div>${title}<small>${sub}</small></div><button class="toggle" id="toggle-${key}" role="switch" aria-label="${title}" aria-checked="${settings[key]}"></button></div>`).join('')}<div class="modal-actions"><button class="primary-button" id="settings-done">就这样，很好</button></div>`);
  for(const key of ['sound','music','effects','autoSun'])$('toggle-'+key).onclick=()=>{settings[key]=!settings[key];$('toggle-'+key).setAttribute('aria-checked',String(settings[key]));audio.enabled=settings.sound;audio.music=settings.music;audio.init();storage.set('settings',settings);refreshHUD();};$('settings-done').onclick=()=>closeModal();
 }
 $('settings-btn').onclick=showSettings;
 $('how-btn').onclick=()=>{openModal('how',`<div class="modal-eyebrow">A BEGINNER’S GUIDE TO A BRAVER LAWN</div><h2 id="modal-title">今天，你就是庭院英雄。</h2><p class="modal-subtitle">三件小事，开启一场不太安静的园艺时光。</p><div class="how-steps"><div class="how-step"><b>01</b><h3>收集阳光</h3><p>点击从天而降的金色阳光。种下向日葵，让收入持续增长。</p></div><div class="how-step"><b>02</b><h3>布置防线</h3><p>点击上方植物卡片，再点击空草坪。前排放坚果，后排放射手。</p></div><div class="how-step"><b>03</b><h3>守住家门</h3><p>保护全部五条路，击退六波僵尸。割草机每条路只能救场一次！</p></div></div><div class="hint-box">快捷键：<b>1–8</b> 选植物 · <b>E</b> 铲子 · <b>空格</b> 暂停 · <b>Esc / 右键</b> 取消选择<br>樱桃炸弹影响周围 3×3 格；土豆地雷需要 8 秒准备。阳光默认手动收集，可在设置中开启自动收集。<br>游戏会自动保存，离开后可点击「继续上次」接着玩。</div><div class="modal-actions"><button class="primary-button" id="how-done">准备好了 →</button></div>`);$('how-done').onclick=()=>closeModal();};
 function finish(won){storage.remove('save');selected=null;refreshSelection();$('tutorial-toast').hidden=true;audio.play(won?'won':'lost');const best=storage.get('best',{kills:0,wave:0,wins:0});best.kills=Math.max(best.kills||0,game.kills);best.wave=Math.max(best.wave||0,game.wave);if(won)best.wins=(best.wins||0)+1;storage.set('best',best);
  if(won)for(let i=0;i<7;i++)burst(450+i*130,180,20,['#efc95c','#98bc68','#eaa181'][i%3],160);
  openModal('end',`<div class="center-modal">${portraitMarkup(won?'sunflower':'wall')}<div class="modal-eyebrow">${won?'THE LAWN IS SAFE. THANKS TO YOU.':'EVERY GREAT GARDENER STARTS SOMEWHERE.'}</div><h2 id="modal-title">${won?'漂亮，草坪守住了！':'差一点，就守住了。'}</h2><p class="modal-subtitle">${won?'阳光、勇气，还有你的小小植物军团。':'调整一下阵型，再给这些家伙一点颜色看看。'}</p>${won?`<div class="achievement">${game.breaches===0?'✦ 完美守卫 · 全部割草机完好 ✦':'✦ 晴日庭院 · 冒险通关 ✦'}</div>`:''}<div class="stats"><div><strong>${game.kills}</strong><span>击退僵尸</span></div><div><strong>${game.wave}</strong><span>守卫波次</span></div><div><strong>${formatTime(game.time)}</strong><span>守卫时长</span></div></div><div class="modal-actions"><button class="primary-button" id="again-btn">${won?'再来一局':'再次挑战'} →</button><button class="secondary-button" id="end-home-btn">返回庭院</button></div><p class="best-record">最佳纪录：${best.kills} 次击退 · ${best.wave} 波守卫</p></div>`);renderPortraits();$('again-btn').onclick=()=>startGame();$('end-home-btn').onclick=returnLobby;
 }
 document.addEventListener('keydown',e=>{
  if(e.key==='Tab'&&!$('modal-backdrop').hidden){const focusables=[...$('modal').querySelectorAll('button:not([disabled]),[tabindex="0"]')];const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
  if(e.key==='Escape'){if(!$('modal-backdrop').hidden)closeCurrentModal();else if(selected){selected=null;refreshSelection();}else if(game.state==='playing')pause();return;}
  if(!$('modal-backdrop').hidden){if(e.code==='Space'&&modalKind==='pause'){e.preventDefault();closeModal();}return;}
  if(e.code==='Space'){e.preventDefault();if(game.state==='ready')startGame();else pause();return;}
  if(e.repeat)return;
  if(/^[1-8]$/.test(e.key))selectPlant(Object.keys(PLANTS)[Number(e.key)-1]);if(e.key.toLowerCase()==='e')$('shovel-btn').click();
 });
 window.addEventListener('beforeunload',saveGame);document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='playing'){saveGame();pause();}});
 const demoPlants=[['sunflower',0,0],['pea',0,2],['wall',0,5],['sunflower',1,1],['ice',1,3],['sunflower',2,0],['pea',2,2],['sunflower',3,1],['repeater',3,3],['pea',4,0],['sunflower',4,2],['wall',4,5],['cherry',4,7]].map(([type,row,col],i)=>({type,row,col,...game.position(row,col),phase:i*1.7,age:20,hpRatio:1}));
 const demoZombies=[{type:'normal',row:0,x:1414},{type:'cone',row:1,x:1389},{type:'normal',row:2,x:1296},{type:'bucket',row:3,x:1460},{type:'normal',row:4,x:1378}].map(z=>({...z,y:game.position(z.row,0).y+5,phase:z.row*2}));
 function drawHealth(x,y,ratio,width=46){if(ratio>=.999)return;Art.round(ctx,x-width/2,y,width,5,2,'#2b482b66',null);Art.round(ctx,x-width/2,y,Math.max(0,width*ratio),5,2,ratio>.4?'#b9d96a':'#e99b66',null);}
 function draw(){
  ctx.save();ctx.clearRect(0,0,1600,760);if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.drawImage(bg,0,0);
  const ready=game.state==='ready',tm=visualTime;
  // Almost imperceptible pollen and wandering butterflies give the lawn a heartbeat.
  for(let i=0;i<12;i++){const x=(i*147+tm*(5+i%3))%1660-30,y=95+(i*59)%600+Math.sin(tm*.45+i)*24;Art.ellipse(ctx,x,y,1.5,1.5,'#fff4ca55',null);}
  for(let i=0;i<2;i++){const x=720+Math.sin(tm*.13+i*3)*510,y=105+Math.sin(tm*.34+i)*22;ctx.save();ctx.translate(x,y);const flap=.35+Math.abs(Math.sin(tm*8+i))*.65;Art.ellipse(ctx,-4,0,6*flap,4,i?'#e8cb71':'#f8edbc',null,0,-.4);Art.ellipse(ctx,4,0,6*flap,4,i?'#e8cb71':'#f8edbc',null,0,.4);Art.line(ctx,[0,-3,0,4],'#79764d',1);ctx.restore();}
  if(selected&&hover&&game.state==='playing'&&hover.col>=0&&hover.col<9&&hover.row>=0&&hover.row<5){const x=BOARD.x+hover.col*116,y=BOARD.y+hover.row*106;ctx.fillStyle='#f4ffd512';ctx.fillRect(BOARD.x,y,1044,106);ctx.fillStyle='#f4ffd512';ctx.fillRect(x,BOARD.y,116,530);const valid=selected==='shovel'?!!game.at(hover.row,hover.col):!game.canPlant(selected,hover.row,hover.col);Art.round(ctx,x+3,y+3,110,100,7,valid?'#fff8c440':'#f3b09444',valid?'#fff3b6':'#edc2a5',2);}
  const mowers=ready?Array.from({length:5},(_,row)=>({row,x:250,state:'ready'})):game.mowers;
  for(const m of mowers)if(m.state!=='used')Art.mower(ctx,m.x,game.position(m.row,0).y+5,tm,m.state==='active');
  for(let row=0;row<5;row++){
   const plants=ready?demoPlants:game.plants;
   for(const p of plants.filter(p=>p.row===row)){
    const pop=ready?1:Math.min(1,p.age*5);ctx.save();if(!ready&&p.age<.2){ctx.translate(p.x,p.y);ctx.scale(.7+.3*pop,.6+.4*pop);ctx.translate(-p.x,-p.y);}
    Art.plant(ctx,p.type,p.x,p.y,tm+(p.phase??p.id??0),{recoil:p.recoil,age:p.age,digest:p.digest,hpRatio:ready?1:p.hp/p.maxHp});ctx.restore();
    if(!ready){drawHealth(p.x,p.y+16,p.hp/p.maxHp);if(p.type==='potato'&&p.age<8)drawHealth(p.x,p.y+16,p.age/8,32);if(p.type==='chomper'&&p.digest>0)drawHealth(p.x,p.y+16,1-p.digest/16,36);}
   }
   for(const z of dead.filter(z=>z.row===row)){ctx.save();ctx.translate(z.x,z.y);ctx.rotate((1-z.life/.58)*-1.2);Art.zombie(ctx,z.type,0,0,tm,{alpha:z.life/.58,hpRatio:0});ctx.restore();}
   for(const z of (ready?demoZombies:game.zombies).filter(z=>z.row===row).sort((a,b)=>a.x-b.x)){Art.zombie(ctx,z.type,z.x,z.y,ready?tm+(z.phase||0):z.age,{slow:z.slow,eating:z.eating,hpRatio:ready?1:z.hp/z.maxHp});if(!ready&&z.hp<z.maxHp)drawHealth(z.x,z.y+16,z.hp/z.maxHp,40);}
  }
  if(ready){for(let i=0;i<3;i++){const x=470+i*315+Math.sin(tm*.5+i)*12,y=140+i*85+Math.sin(tm*.9+i)*9;Art.sun(ctx,x,y,tm,.8);}for(let i=0;i<3;i++){const x=670+((tm*130+i*220)%540);Art.ellipse(ctx,x,game.position(0,0).y-47,7,7,'#ade065','#496f35',2);}}
  if(selected&&selected!=='shovel'&&hover&&game.state==='playing'&&hover.col>=0&&hover.col<9&&hover.row>=0&&hover.row<5&&!game.at(hover.row,hover.col)){const p=game.position(hover.row,hover.col);Art.plant(ctx,selected,p.x,p.y,tm,{alpha:.5});}
  for(const s of game.shots){const col=s.ice?'#d0faff':'#b9e768';ctx.save();const g=ctx.createLinearGradient(s.x-30,s.y,s.x,s.y);g.addColorStop(0,s.ice?'#b3f9ff00':'#c0ef6500');g.addColorStop(1,s.ice?'#b3f9ff77':'#c0ef6577');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(s.x-9,s.y,23,6,0,0,Math.PI*2);ctx.fill();Art.ellipse(ctx,s.x,s.y,8,8,Art.grad(ctx,s.x-2,s.y-2,12,col,s.ice?'#72b8d3':'#6cab39'),s.ice?'#528ba9':'#447333',2);Art.ellipse(ctx,s.x-2,s.y-3,2,2,'#faffd8',null);ctx.restore();}
  for(const ring of rings){ctx.save();ctx.globalAlpha=ring.life/.65;const g=ctx.createRadialGradient(ring.x,ring.y,0,ring.x,ring.y,ring.r);g.addColorStop(0,'#fff7b9dd');g.addColorStop(.5,'#ffce6088');g.addColorStop(1,'#ed994400');Art.ellipse(ctx,ring.x,ring.y,ring.r,ring.r*.7,g,null);Art.ellipse(ctx,ring.x,ring.y,ring.r*.85,ring.r*.65,'#0000','#fff0a9',4);ctx.restore();}
  for(const p of particles){ctx.save();ctx.globalAlpha=Math.min(1,p.life*2);ctx.translate(p.x,p.y);ctx.rotate(p.angle);Art.ellipse(ctx,0,0,p.size,p.size*.5,p.color,null);ctx.restore();}
  if(!ready)for(const s of game.suns){ctx.save();if(s.life<3)ctx.globalAlpha=.5+Math.sin(tm*12)*.3;Art.sun(ctx,s.x,s.y,tm+(s.id||0),.9+Math.sin(s.age*3)*.04);ctx.restore();}
  for(const f of flying)Art.sun(ctx,f.x,f.y,tm,Math.max(.15,.8-f.age));
  for(const f of floaters){ctx.save();ctx.globalAlpha=Math.min(1,f.life*2);ctx.font=`900 ${f.text.length>4?30:23}px ${f.text.includes('!')?'Georgia':'system-ui'}`;ctx.textAlign='center';ctx.strokeStyle='#516537';ctx.lineWidth=3;ctx.strokeText(f.text,f.x,f.y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);ctx.restore();}
  ctx.restore();
 }
 function updateVisual(dt){visualTime+=dt;shake=Math.max(0,shake-dt*28);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt;p.angle+=dt*3;}particles=particles.filter(p=>p.life>0);for(const r of rings){r.r+=(r.max-r.r)*dt*9;r.life-=dt;}rings=rings.filter(r=>r.life>0);for(const f of floaters){f.life-=dt;f.y-=dt*32;}floaters=floaters.filter(f=>f.life>0);for(const z of dead)z.life-=dt;dead=dead.filter(z=>z.life>0);for(const f of flying){f.age+=dt;const a=Math.min(1,f.age/.65),ease=a*a;f.x=f.sx+(70-f.sx)*ease;f.y=f.sy+(-80-f.sy)*ease-Math.sin(a*Math.PI)*60;}flying=flying.filter(f=>f.age<.65);}
 let last=performance.now(),accumulator=0;function frame(now){const dt=Math.min(.06,(now-last)/1000);last=now;const active=game.state==='playing';if(game.state!=='paused')updateVisual(dt*(active?speed:1));if(active){accumulator+=dt*speed;while(accumulator>=1/60){game.update(1/60);accumulator-=1/60;if(game.state!=='playing'){accumulator=0;break;}}if(settings.autoSun)for(const s of [...game.suns])if(s.age>2)game.collect(s.id);saveClock+=dt;if(saveClock>5){saveGame();saveClock=0;}}else accumulator=0;audio.update(active);hudClock+=dt;if(hudClock>.09){refreshHUD();hudClock=0;}draw();requestAnimationFrame(frame);}
 $('resume-btn').hidden=!storage.get('save');refreshSelection();refreshHUD();requestAnimationFrame(frame);
})();
