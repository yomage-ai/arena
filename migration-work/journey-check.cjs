const {chromium}=require('/Users/apm30/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(__dirname,'../artifacts/migration');
const url='http://127.0.0.1:8776/works/migration/gpt6-astra-xhigh/import-01/index.html';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Drive the application's real RAF loop deterministically, including the real renderer.
 await page.addInitScript(()=>{let now=100,callbacks=[];window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length};window.__frames=n=>{for(let i=0;i<n;i++){now+=50;const pending=callbacks;callbacks=[];for(const fn of pending)fn(now)}};const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{original(a);a[0]=11234567;return a}});
 await page.goto(url);await page.evaluate(()=>__frames(2));await page.getByRole('button',{name:'开始迁徙',exact:false}).click();
 const samples=[];
 for(let part=0;part<12;part++){
  await page.evaluate(()=>__frames(400));
  const s=await page.evaluate(()=>migration.snapshot());
  assert(s.finite);assert(s.chunks<=29);assert.equal(s.birds,30);assert(s.birdScreens.every(b=>b&&Number.isFinite(b.x)&&Number.isFinite(b.y)));
  const visible=s.birdScreens.filter(b=>b.x>0&&b.x<s.width&&b.y>0&&b.y<s.height).length;
  const left=s.birdScreens.filter(b=>b.x>0&&b.x<s.width*.62).length;
  samples.push({time:s.flightTime,round:s.round,shot:s.shot,camera:s.camera,climate:s.climate,visible,left,chunks:s.chunks});
  console.log(JSON.stringify(samples.at(-1)));
  if([0,1,2,4,6,7,10].includes(part))await page.screenshot({path:path.join(out,`journey-${String(part+1).padStart(2,'0')}.png`)});
 }
 // Exact selection remains correct even when starting during the preview glide.
 await page.close();const night=await browser.newPage({viewport:{width:1440,height:900}});night.on('pageerror',e=>errors.push(e.message));await night.goto(url);await night.getByRole('button',{name:'夜航',exact:true}).click();await night.getByRole('button',{name:'开始迁徙',exact:false}).click();await night.waitForTimeout(1600);const ns=await night.evaluate(()=>({snapshot:migration.snapshot(),color:getComputedStyle(document.getElementById('experience')).color}));assert.equal(ns.snapshot.climate.a,4);assert.equal(ns.color,'rgb(214,223,223)'.replaceAll(',',', '));await night.screenshot({path:path.join(out,'night-flight-fixed.png')});await night.close();
 // Breakpoints are based on CSS viewport size, not backing pixel dimensions.
 const large=await browser.newPage({viewport:{width:3300,height:1850}});await large.goto(url);await large.waitForTimeout(500);assert.equal(await large.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui').trim()),'2');await large.setViewportSize({width:2400,height:1400});assert.equal(await large.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui').trim()),'1.5');await large.close();
 fs.writeFileSync(path.join(out,'journey-report.json'),JSON.stringify({errors,samples},null,2));assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
