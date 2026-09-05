const {chromium}=require('/Users/apm30/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const out=path.join(__dirname,'../artifacts/migration');
const url=pathToFileURL(path.join(__dirname,'../results/migration/gpt6-astra-xhigh/import-01/index.html')).href;
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},offline:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__audioEvents=[];const original=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const node=original.call(this),start=node.start.bind(node),ac=this;node.start=(...args)=>{if(!node.loop){__audioEvents.push({event:'start',when:args[0],now:ac.currentTime,duration:node.buffer.duration});node.addEventListener('ended',()=>__audioEvents.push({event:'ended',now:ac.currentTime}))}return start(...args)};return node}});
 await page.goto(url);await page.getByRole('button',{name:'夜航',exact:true}).click();await page.waitForTimeout(4000);await page.screenshot({path:path.join(out,'night-landing-final.png')});await page.getByRole('button',{name:'开始迁徙',exact:false}).click();await page.waitForTimeout(2000);
 const start=await page.evaluate(()=>migration.snapshot());assert(start.audioReady);assert.equal(start.audioState,'running');
 await page.keyboard.press('c');await page.mouse.move(710,710);await page.mouse.down();await page.mouse.move(710,210,{steps:18});await page.mouse.up();await page.waitForTimeout(1500);
 const low=await page.evaluate(()=>migration.snapshot());assert(low.camera.pitch<.2);await page.screenshot({path:path.join(out,'night-low-camera.png')});
 await page.mouse.wheel(0,-250);await page.waitForTimeout(1000);const zoomed=await page.evaluate(()=>migration.snapshot());assert(zoomed.camera.distance<low.camera.distance*.95);
 await page.keyboard.press('c');await page.waitForTimeout(1500);const auto=await page.evaluate(()=>migration.snapshot());assert(!auto.manual);
 await page.mouse.move(1300,450);await page.waitForTimeout(500);const breeze=await page.evaluate(()=>migration.snapshot());assert(Math.abs(breeze.wind.x)>.1);
 await page.mouse.move(1,450);await page.mouse.move(1440,901);await page.waitForTimeout(1500);
 // A second touch context verifies native pointer events through the 90-degree transform.
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,offline:true});
 const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.getByRole('button',{name:'开始迁徙',exact:false}).tap();await mobile.waitForTimeout(700);await mobile.getByTitle('切换自主镜头 · C').tap();
 const before=await mobile.evaluate(()=>migration.snapshot()),cdp=await mobileContext.newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:320,id:1},{x:240,y:500,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:140,y:255,id:1},{x:250,y:565,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mobile.waitForTimeout(1300);const after=await mobile.evaluate(()=>migration.snapshot());assert(after.rotated);assert.equal(after.birds,22);assert.equal(after.dpr,3);assert(after.camera.distance<before.camera.distance*.8);assert(after.finite);await mobile.screenshot({path:path.join(out,'mobile-pinch.png')});await mobileContext.close();
 // Let the first complete original track finish in real Web Audio time.
 await page.waitForFunction(()=>__audioEvents.filter(e=>e.event==='start').length>=2,{},{timeout:60000});
 const audio=await page.evaluate(()=>__audioEvents);const begins=audio.filter(e=>e.event==='start'),ended=audio.find(e=>e.event==='ended');assert(ended);assert(Math.abs((begins[1].when-ended.now)-2.4)<.06);assert.equal((await page.evaluate(()=>migration.snapshot())).audioTrack,1);
 await page.keyboard.press('m');assert.equal((await page.evaluate(()=>migration.snapshot())).soundEnabled,false);
 fs.writeFileSync(path.join(out,'interaction-report.json'),JSON.stringify({errors,offlineAudio:start.audioReady,lowCamera:low.camera,zoom:zoomed.camera.distance,mobile:{rotated:after.rotated,birds:after.birds,dpr:after.dpr,distanceBefore:before.camera.distance,distanceAfter:after.camera.distance},audio},null,2));console.log('PASS OFFLINE, LOW CAMERA, TRUE ZOOM, WIND, PORTRAIT PINCH, AUDIO ALTERNATION',JSON.stringify(audio));assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
