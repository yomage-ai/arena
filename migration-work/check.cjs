const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const built = path.join(__dirname, '../artifacts/builds/migration/index.html');
const html = fs.readFileSync(fs.existsSync(built) ? built : path.join(__dirname, '../results/migration/gpt6-astra-xhigh/import-01/index.html'),'utf8');
const source=html.split('<script>')[1].split('</script>')[0];
const sandbox={};
vm.createContext(sandbox);
vm.runInContext(source.split('/* APP */')[0]+';globalThis.core=MigrationCore;',sandbox);
const C=sandbox.core;
const results=[];
function test(name, fn){fn();results.push({name,result:'PASS'});console.log('PASS',name)}
test('single offline document; exactly two real MP3 assets',()=>{
 assert(!/<(?:script|link|img|audio)\b[^>]*(?:src|href)=["']https?:/i.test(html));
 assert(!/__MUSIC_/.test(html));
 const assets=source.match(/const MUSIC=\[(.*?)\];/)[1].match(/'([^']+)'/g);
 assert.equal(assets.length,2);
 for(const a of assets){const buffer=Buffer.from(a.slice(1,-1),'base64');assert(buffer.length>200000);assert.equal(buffer.subarray(0,3).toString(),'ID3')}
 assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(source));
});
test('all five geographical climates; continuously interpolated fronts',()=>{
 for(let i=0;i<5;i++){let s=C.sample(C.river((i+.43)*C.L,172)-96,(i+.43)*C.L,172);assert.equal(s.climate.a,i);assert.equal(s.climate.b,i)}
 for(let z=-40000;z<180000;z+=31){const a=C.sample(300,z,991),b=C.sample(300,z+.01,991);for(const k of ['sky','bird','ground','ink','water'])for(let j=0;j<3;j++){assert(Number.isFinite(a[k][j]));assert(Math.abs(a[k][j]-b[k][j])<.005)}}
 let mixed=false;for(let z=6500;z<10000;z+=5){const a=C.climate(-170,z,991),b=C.climate(170,z,991);if(a.a!==a.b&&Math.abs(a.t-b.t)>.08)mixed=true}assert(mixed);
});
test('100 camera variations: skeleton, alternating climax, yaw separation, duration, seamless endpoints',()=>{
 let prev;for(let round=0;round<100;round++){const c=C.cycle(round,727,prev);assert.equal(c.shots.length,6);assert(c.duration>=96&&c.duration<=105);assert.equal(c.shots[4].id,round%2?10:9);assert([0,1,11].includes(c.shots[0].id));assert([8,11,13].includes(c.shots[5].id));for(let i=0;i<6;i++){const s=c.shots[i];assert(s.duration>=16&&s.duration<=19);if(prev!==undefined)assert(Math.abs(C.angle(prev,s.yaw))>=Math.PI/6-1e-8,`round ${round} shot ${i}`);if(i<5){const n=c.shots[i+1],end=C.cameraAt(s,n,1),start=C.cameraAt(n,c.shots[Math.min(i+2,5)],0);for(const k of ['yaw','pitch','distance','height'])assert(Math.abs(end[k]-start[k])<1e-7);const held=C.cameraAt(s,n,.4);assert.equal(held.yaw,s.yaw)}prev=s.yaw}const next=C.cycle(round+1,727,c.lastYaw),end=C.cameraAt(c.shots[5],next.shots[0],1);assert(Math.abs(end.yaw-next.shots[0].yaw)<1e-7)}
});
test('30 independent springs remain finite under strong changing wind; release settles',()=>{
 const birds=C.createBirds(30,831);assert.equal(new Set(birds.map(b=>b.phase)).size,30);assert.equal(new Set(birds.map(b=>b.k)).size,30);for(let n=0;n<60*180;n++){const dt=1/60,drive=n<60*120?Math.sin(n*.021)*270:0;C.separation(birds);for(const b of birds)C.integrate(b,b.bx+drive*b.brave,b.by,b.bz+drive*.5,dt);assert(birds.every(b=>[b.x,b.y,b.z].every(Number.isFinite)))}for(const b of birds)assert(Math.hypot(b.x-b.bx,b.z-b.bz)<10);assert.equal(C.createBirds(22,10).length,22)
});
test('unbounded geographical addresses produce distinct seeded chunks',()=>{
 const values=new Set();for(let z=0;z<10000000;z+=8600*5)values.add(C.river(z,277).toFixed(6));assert(values.size>200);assert.notEqual(C.river(20124,123),C.river(20124,124))
});
fs.writeFileSync(path.join(__dirname,'../artifacts/migration/core-checks.json'),JSON.stringify(results,null,2));
