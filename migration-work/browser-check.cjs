// Headless development verification; the distributed HTML has no package dependencies.
const {chromium}=require('/Users/apm30/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(__dirname,'../artifacts/migration');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:8776/works/migration/gpt6-astra-xhigh/import-01/index.html');
 await page.waitForTimeout(1800);
 await page.screenshot({path:path.join(out,'warm-landing.png')});
 console.log('LANDING',JSON.stringify(await page.evaluate(()=>window.migration?.snapshot())));
 await page.getByRole('button',{name:'开始迁徙',exact:false}).click();
 await page.waitForTimeout(6500);
 await page.screenshot({path:path.join(out,'warm-flight.png')});
 console.log('FLIGHT',JSON.stringify(await page.evaluate(()=>window.migration?.snapshot())));
 const samples=await page.evaluate(()=>new Promise(resolve=>{let t=performance.now(),n=0;function f(){if(++n===100)resolve({frames:n,elapsed:performance.now()-t,fps:n*1000/(performance.now()-t)});else requestAnimationFrame(f)}requestAnimationFrame(f)}));
 console.log('PERFORMANCE',JSON.stringify(samples));
 await page.getByRole('button',{name:'显示诗句',exact:true}).click();
 if(await page.getByRole('button',{name:'显示诗句',exact:true}).getAttribute('aria-pressed')!=='false')throw Error('Poetry toggle');
 await page.keyboard.press('c');await page.mouse.move(580,420);await page.mouse.down();await page.mouse.move(770,510,{steps:12});await page.mouse.up();await page.mouse.wheel(0,-420);await page.waitForTimeout(700);
 console.log('MANUAL',JSON.stringify(await page.evaluate(()=>window.migration.snapshot())));
 await page.screenshot({path:path.join(out,'manual-flight.png')});
 await page.keyboard.press('h');await page.screenshot({path:path.join(out,'help.png')});await page.keyboard.press('Escape');
 await page.keyboard.press('m');
 if((await page.evaluate(()=>window.migration.snapshot())).soundEnabled!==false)throw Error('Sound toggle');
 await page.close();
 for(const [label,filename] of [['夜航','night'],['雪境','snow'],['暮粉','dusk'],['雾境','mist']]){
  const p=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8776/works/migration/gpt6-astra-xhigh/import-01/index.html');await p.getByRole('button',{name:label,exact:true}).click();await p.waitForTimeout(4600);await p.screenshot({path:path.join(out,filename+'-landing.png')});console.log(label,JSON.stringify(await p.evaluate(()=>window.migration.snapshot())));await p.close();
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:8776/works/migration/gpt6-astra-xhigh/import-01/index.html');await mobile.waitForTimeout(2000);await mobile.screenshot({path:path.join(out,'mobile-portrait.png')});console.log('MOBILE',JSON.stringify(await mobile.evaluate(()=>window.migration.snapshot())));await mobile.getByRole('button',{name:'开始迁徙',exact:false}).tap();await mobile.waitForTimeout(3000);await mobile.screenshot({path:path.join(out,'mobile-flight.png')});await mobile.close();
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({errors,requests,performance:samples},null,2));console.log('ERRORS',JSON.stringify(errors));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
