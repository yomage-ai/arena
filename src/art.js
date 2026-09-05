'use strict';
const Art = (() => {
 const ink = '#30452b';
 function ellipse(c,x,y,rx,ry,fill,stroke=ink,lw=3,rot=0) { c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();} }
 function path(c,d,fill,stroke=ink,lw=3) { const p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.lineJoin='round';c.lineCap='round';c.stroke(p);} }
 function line(c,pts,color=ink,lw=3) { c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.strokeStyle=color;c.lineWidth=lw;c.lineCap='round';c.stroke(); }
 function round(c,x,y,w,h,r,fill,stroke=ink,lw=3){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
 function grad(c,x,y,r,a,b){const g=c.createRadialGradient(x-r*.3,y-r*.4,0,x,y,r);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
 function leaf(c,x,y,rot=0,scale=1,col='#5a9d32') { c.save();c.translate(x,y);c.rotate(rot);c.scale(scale,scale);path(c,'M 0 0 C -8 -27 -38 -28 -43 -22 C -37 -2 -15 9 0 0',col,ink,2.5);path(c,'M -3 0 Q -21 -14 -36 -19',null,'#36712d',1.6);c.restore(); }
 function eyes(c,x,y,space=17,size=6){for(const dx of [-space/2,space/2]){ellipse(c,x+dx,y,size*.6,size,'#243825',null);ellipse(c,x+dx-1,y-2,size*.18,size*.25,'#fff',null);}}
 function shadow(c,x,y,r=38){ellipse(c,x+7,y+3,r,10,'#23482035',null);}
 function plant(c,type,x,y,t=0,o={}) {
  c.save();c.translate(x,y); const sc=o.scale||1;c.scale(sc,sc);if(o.alpha!==undefined)c.globalAlpha*=o.alpha;
  c.lineJoin='round';c.lineCap='round';shadow(c,0,0,type==='cherry'?42:35);
  const sway=Math.sin(t*2.4+(o.phase||0))*2;const recoil=o.recoil||0;
  if(type==='wall'){
   c.rotate(sway*.008);path(c,'M -32 -14 C -41 -39 -37 -83 -20 -91 C 8 -109 39 -88 38 -48 C 43 -15 27 1 1 0 C -17 3 -28 -3 -32 -14',grad(c,-3,-52,66,'#e8bc75','#ae753f'),'#664726',3.5);
   path(c,'M -24 -70 Q -32 -60 -28 -49 M 28 -61 Q 22 -52 28 -41 M -21 -29 Q -28 -19 -19 -13 M 15 -87 Q 5 -80 13 -74',null,'#9c6c3b',2.3);
   ellipse(c,-14,-54,8,10,'#fff9db','#745836',2);ellipse(c,12,-54,8,10,'#fff9db','#745836',2);eyes(c,-1,-53,26,5);
   path(c,'M -10 -30 Q 0 -24 10 -30',null,'#664726',2.5);
   if(o.hpRatio<.65)path(c,'M -24 -86 L -10 -69 L -19 -58 L -8 -39 M 32 -33 L 17 -25 L 21 -12',null,'#714c2d',3);
   if(o.hpRatio<.3)path(c,'M 8 -93 L 2 -76 L 15 -62 L 3 -44 L 11 -27 L 3 -5',null,'#714c2d',3);
  } else if(type==='potato'){
   ellipse(c,0,-8,39,13,'#64492f',null);for(let i=0;i<6;i++)ellipse(c,-29+i*12,-5+Math.sin(i)*3,8,5,'#8b663d',null);
   const armed=o.age===undefined||o.age>=8;
   if(armed){path(c,'M -29 -6 C -39 -43 38 -52 31 -7 Z',grad(c,-6,-25,43,'#e5be88','#af804f'),'#6a4c2f',3);eyes(c,0,-22,19,5);path(c,'M -6 -9 L 7 -9',null,'#60462e',2);line(c,[0,-38,0,-53],'#746143',4);ellipse(c,0,-58,9,9,Math.sin(t*7)>0?'#ef6850':'#ffb949','#824632',2);ellipse(c,-3,-61,3,3,'#ffe9ac',null);}else{ellipse(c,0,-12,18,8,'#b39068','#6b5030',2);line(c,[0,-16,0,-31],'#655a43',4);ellipse(c,0,-35,6,6,'#975650','#654532',2);}
  } else if(type==='cherry'){
   leaf(c,2,-67,-.9,.7);path(c,'M -17 -51 Q -17 -98 9 -89 Q 25 -75 21 -52',null,'#48652c',5);path(c,'M 10 -88 Q 17 -112 34 -99',null,'#8a6b36',3);
   for(let i=0;i<2;i++){c.save();c.translate(i?23:-19,i?-25:-31);ellipse(c,0,0,27,29,grad(c,-4,-7,36,'#ff8270','#c93237'),'#793435',3);ellipse(c,-10,-12,6,9,'#ffbfa780',null,0,.4);eyes(c,i?-2:3,-1,15,5);line(c,[-12,-12,-2,-8,9,-14],'#783134',3);path(c,'M -5 14 L 5 14',null,'#792c32',2);c.restore();}
   if(Math.sin(t*15)>0){star(c,35,-101,11,'#ffd85a');}
  } else {
   const icy=type==='ice';const stem=icy?'#60a7a5':'#4f8c32';
   leaf(c,-1,-3,-.18,1,icy?'#7fc9cf':'#6cac3d');leaf(c,6,-3,Math.PI-.65,.9,icy?'#73bdc9':'#7db642');
   path(c,`M 0 -5 Q ${12+sway} -26 ${sway} -59`,null,'#2f692e',10);path(c,`M 0 -6 Q ${10+sway} -25 ${sway} -57`,null,stem,6);
   if(type==='sunflower'){
    c.translate(sway,-60-recoil*3);
    for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.018;ellipse(c,Math.cos(a)*29,Math.sin(a)*29,11,20,grad(c,Math.cos(a)*29,Math.sin(a)*29,20,'#ffe570','#e7a52c'),'#a77b26',2,a-Math.PI/2);}
    ellipse(c,0,0,27,28,grad(c,-4,-7,38,'#a9763e','#77502d'),'#745020',3);
    for(let i=0;i<18;i++){const a=i*2.399;const r=15+Math.sin(i*3)*8;ellipse(c,Math.cos(a)*r,Math.sin(a)*r,1.4,1.4,'#d8a36490',null);}
    eyes(c,0,-3,19,5.5);path(c,'M -9 9 Q 0 21 11 8',null,'#372e24',2.8);ellipse(c,-16,5,5,3,'#d99054',null);ellipse(c,16,5,5,3,'#d99054',null);
   } else if(type==='chomper'){
    c.translate(sway,-54);c.rotate(Math.sin(t*2)*.05);
    path(c,'M -17 -5 C -49 -43 -23 -66 17 -58 C 44 -48 38 -17 24 -2',grad(c,-7,-38,54,'#c797d4','#815393'),'#4c385b',3);
    for(let i=0;i<4;i++)ellipse(c,-22+i*10,-42+Math.sin(i)*6,4,6,'#dfb1d7',null,0,-.4);
    const chewing=o.digest>0;
    path(c,chewing?'M -29 -15 Q 9 -5 35 -21 Q 28 11 -8 5 Z':'M -29 -15 Q 6 -20 39 -12 L 31 13 Q -10 21 -29 -15', '#542945','#48334b',3);
    for(let i=0;i<5;i++){const xx=-20+i*11;path(c,`M ${xx} -16 l 5 12 l 5 -12`,'#fff9cf','#66514a',1.3);}
    path(c,'M -31 -13 Q -18 22 13 17 Q 33 15 38 -8',null,'#a579b6',7);ellipse(c,-10,-41,3,4,'#352d3b',null);
   } else {
    c.translate(sway-recoil*7,-60);const dark=type==='repeater';const main=icy?'#98e3e8':dark?'#76b94b':'#96d854';const edge=icy?'#489baf':dark?'#40893b':'#58a33b';const outline=icy?'#397181':ink;
    if(dark){path(c,'M -24 -17 L -36 -33 L -17 -28 L -28 -45 L -5 -33 L -9 -48 L 8 -32', '#3c7638',outline,2.5);}
    ellipse(c,-7,-3,31,30,grad(c,-13,-12,42,main,edge),outline,3);
    path(c,'M 5 -20 C 17 -17 20 -20 36 -25 Q 48 -7 36 10 C 20 2 14 9 5 8',grad(c,21,-12,30,main,edge),outline,3);
    ellipse(c,37,-7,11,18,icy?'#92d8e5':'#7fbb43',outline,3);ellipse(c,40,-7,5.5,11,icy?'#346c83':'#315b2a',outline,1.4);
    ellipse(c,-16,-15,5,7,'#234330',null);ellipse(c,-17,-18,1.5,2,'#fff',null);ellipse(c,-25,-4,4,6,icy?'#d7ffff90':'#d9f59b80',null,0,-.6);
    if(dark)path(c,'M -23 -27 L -10 -23',null,'#294e2c',4);
    if(icy){path(c,'M -22 -28 L -18 -44 L -8 -31 L 0 -48 L 9 -27', '#beeff6','#438eaa',2);line(c,[-21,-2,-27,4],'#daffff',2);}
    else if(!dark)leaf(c,-26,12,.7,.46,'#79b84b');
   }
  }
  c.restore();
 }
 function zombie(c,type,x,y,t=0,o={}){
  c.save();c.translate(x,y);const sc=o.scale||1;c.scale(sc,sc);if(o.alpha!==undefined)c.globalAlpha*=o.alpha;
  shadow(c,0,1,34);const step=Math.sin(t*(o.eating?9:3.4));c.translate(0,Math.abs(step)*2);c.rotate(Math.sin(t*2)*.024);
  const skin=o.slow?'#97c8cc':'#9baa80', skinlight=o.slow?'#c3eef0':'#bec8a0';const dark='#3c4233';const jacket=type==='runner'?'#bb5144':'#786454';
  // Loose trouser legs, worn shoes, and laces.
  path(c,`M -19 -44 L -21 ${-17+step*5} L ${-30-step*5} -6 L -9 -4 L 2 -27 L 7 -41`, '#596477',dark,3);
  path(c,`M 2 -42 L 10 ${-20-step*5} L ${8+step*4} -4 L 28 -4 L 27 -21 L 24 -43`, '#667285',dark,3);
  path(c,`M ${-30-step*5} -10 Q -42 -9 -42 0 L -9 0 L -9 -8 Z`,'#51483c',dark,3);
  path(c,`M ${9+step*4} -9 Q 0 -6 0 2 L 34 2 Q 38 -8 25 -10 Z`,'#51483c',dark,3);line(c,[-29,-5,-17,-5],'#b09c75',2);line(c,[12,-4,22,-4],'#b09c75',2);
  path(c,'M -23 -91 Q -2 -103 20 -89 L 29 -43 L 15 -46 L 8 -39 L -5 -46 L -21 -42 L -30 -49 Z',jacket,dark,3.5);
  path(c,'M -10 -92 L 6 -91 L 7 -50 L -11 -53 Z','#d3c7a2',dark,2);path(c,'M -1 -84 L 7 -79 L 0 -73 L 5 -55 L -3 -49 L -9 -58 L -4 -74 L -8 -80 Z','#a4433a','#603b31',2);
  path(c,'M -12 -94 L -21 -75 L -11 -78 L -15 -66 M 9 -93 L 19 -75 L 11 -72 L 16 -60',null,'#4c4639',2);
  const arm=step*(o.eating?3:1.5);
  path(c,`M -22 -83 Q -35 -84 -36 -64 L -58 ${-64+arm} L -58 ${-51+arm} Q -20 -43 -17 -67`,jacket,dark,3);
  path(c,`M -57 ${-63+arm} L -73 ${-66+arm} L -85 ${-59+arm} L -84 ${-54+arm} L -75 ${-56+arm} L -85 ${-49+arm} L -82 ${-45+arm} L -69 ${-51+arm} L -57 ${-50+arm}`,skin,dark,2.5);
  path(c,'M 18 -81 Q 36 -78 28 -57 L 13 -45 L 4 -55 L 14 -65',jacket,dark,3);path(c,'M 11 -56 L -5 -52 L -10 -43 L -3 -40 L 0 -47 L 12 -46 L 18 -49',skin,dark,2.5);
  // A deliberately asymmetric, wonderfully vacant face.
  c.save();c.translate(-9,-101);c.rotate(-.12+(o.eating?Math.sin(t*10)*.05:0));
  path(c,'M -27 -5 C -40 -49 -9 -62 16 -45 C 36 -35 34 -7 17 6 L 14 20 L -13 22 L -23 13 Z',grad(c,-5,-24,47,skinlight,skin),dark,3.5);
  ellipse(c,25,-9,6,9,skin,dark,2);path(c,'M 23 -10 Q 28 -14 27 -5',null,'#6e7c5d',1.6);
  ellipse(c,-23,-24,11,12,'#f2edd1',dark,2.3);ellipse(c,0,-26,12,13,'#f2edd1',dark,2.3);ellipse(c,-26,-22,3,4,'#343b32',null);ellipse(c,-4,-24,3,4,'#343b32',null);
  path(c,'M -17 -17 L -23 -5 L -13 -3',skin,'#5c674c',2);path(c,'M -22 5 Q -2 -3 17 4 L 12 16 L -17 15 Z','#574d3d',dark,2.5);
  round(c,-17,3,8,7,1,'#e8e0ba',dark,1);round(c,-7,2,8,8,1,'#e8e0ba',dark,1);round(c,5,10,7,6,1,'#e8e0ba',dark,1);
  path(c,'M 7 -41 L 13 -37 M -13 -50 L -16 -58 M -4 -51 L 0 -59 M 9 -47 L 12 -53',null,'#4d5742',2);
  ellipse(c,13,-13,3,2,'#7c8d66',null);line(c,[-18,21,-6,24,9,22],'#697752',2);
  const armored=o.hpRatio===undefined||o.hpRatio>200/(ZOMBIES[type]?.hp||200);
  if(type==='cone'&&armored){path(c,'M -34 -42 L -13 -101 L 2 -104 L 30 -41 Z',grad(c,-8,-78,60,'#f6a344','#cb6028'),'#714625',3.5);path(c,'M -24 -66 L 19 -65 L 14 -77 L -20 -77 Z','#ffdda2','#d98238',1.5);path(c,'M -31 -46 L 28 -45 L 34 -34 L -39 -35 Z','#e78a37','#784924',3);}
  if(type==='bucket'&&armored){path(c,'M -29 -44 L -31 -88 Q -2 -98 24 -82 L 29 -42 Z',grad(c,-18,-71,55,'#d5ddd5','#80959a'),'#4a6061',3.5);ellipse(c,-3,-88,28,7,'#dbe2d7','#4a6061',3);path(c,'M -24 -76 L -21 -51 M -13 -79 L -11 -57',null,'#eff2df99',4);path(c,'M -27 -58 Q -54 -19 27 -50',null,'#61787a',3);ellipse(c,-26,-58,3,3,'#cfdcd0','#475f5f',1);}
  if(type==='runner'&&armored){path(c,'M -35 -22 C -44 -71 27 -76 34 -25 L 15 -25 L 10 -43 L -9 -47 L -19 -26 Z','#bf5145','#643b36',3);path(c,'M -10 -62 L -5 -47 L 3 -46 L -1 -62 Z','#f5d9b5',null);path(c,'M -37 -22 L -37 2 L -4 5 L 6 -13 M -36 -11 L 0 -8',null,'#b8c5bd',4);}
  c.restore();
  if(type==='runner'){path(c,'M -23 -85 Q -39 -100 -36 -69 L -24 -66 M 19 -87 Q 37 -97 34 -70 L 24 -67','#bd5147','#613d37',3);}
  if(type==='flag'){line(c,[27,-42,33,-167],'#766345',4);path(c,'M 34 -164 Q 58 -175 85 -156 L 79 -119 Q 55 -138 32 -126 Z','#bf5b48','#743f33',3);ellipse(c,58,-147,11,10,'#e6d7b6',null);ellipse(c,55,-149,2,3,'#91554b',null);ellipse(c,63,-147,2,3,'#91554b',null);}
  if(o.slow){c.globalAlpha*=.7;star(c,27,-57,9,'#dcfbff');}
  c.restore();
 }
 function star(c,x,y,r,color,spin=0){c.save();c.translate(x,y);c.rotate(spin);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;const rr=i%2?r*.32:r;if(!i)c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fillStyle=color;c.fill();c.restore();}
 function sun(c,x,y,t=0,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);const g=c.createRadialGradient(0,0,10,0,0,57);g.addColorStop(0,'#fff4a8aa');g.addColorStop(1,'#ffe68700');ellipse(c,0,0,57,57,g,null);c.save();c.rotate(t*.25);for(let i=0;i<10;i++){c.rotate(Math.PI/5);path(c,'M -7 -25 L 0 -39 L 7 -25','#ffd866','#c79830',1.5);}c.restore();ellipse(c,0,0,25,25,grad(c,-5,-6,32,'#fff9ae','#f5c044'),'#c8962c',2);ellipse(c,-8,-8,5,7,'#ffffd480',null,0,.5);c.restore();}
 function mower(c,x,y,t=0,active=false){c.save();c.translate(x,y);shadow(c,0,0,42);if(active)c.translate(Math.sin(t*80)*1.5,Math.cos(t*90));line(c,[-25,-13,-37,-56,-18,-65],'#454e3d',5);line(c,[-35,-57,-17,-65],'#a49878',7);path(c,'M -39 -24 Q -30 -38 16 -29 L 37 -9 L 31 0 L -36 0 Z','#bc4a36','#683b2c',3);round(c,-16,-39,28,18,4,'#9aaf8f','#3f5139',3);line(c,[-9,-34,5,-34],'#d7d9ba',3);for(const xx of [-25,26]){ellipse(c,xx,-2,12,12,'#3d4437','#293e31',3);ellipse(c,xx,-2,5,5,'#a8a98c',null);}round(c,13,-22,22,10,2,'#d26340','#7d4230',2);c.restore();}
 function flower(c,x,y,scale=1,col='#fff3c2'){c.save();c.translate(x,y);c.scale(scale,scale);line(c,[0,0,0,-10],'#527334',2);for(let i=0;i<5;i++){const a=i*1.257;ellipse(c,Math.cos(a)*4,-13+Math.sin(a)*4,3,4,col,null,0,a);}ellipse(c,0,-13,2.7,2.7,'#e5ba4a',null);c.restore();}
 function shrub(c,x,y,s=1,col='#668940'){c.save();c.translate(x,y);c.scale(s,s);for(const p of [[-41,4,32],[-22,-19,32],[10,-25,36],[40,-4,30],[4,12,40]])ellipse(c,...p,p[2]*.8,col,'#3e6634',2);for(let i=0;i<15;i++){const a=i*2.4;ellipse(c,Math.cos(a)*35,Math.sin(a)*22-10,8,4,'#b1c75a30',null,0,a);}c.restore();}
 function background(){
  const canvas=document.createElement('canvas');canvas.width=BOARD.width;canvas.height=BOARD.height;const c=canvas.getContext('2d');let seed=31415;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const sky=c.createLinearGradient(0,0,0,220);sky.addColorStop(0,'#b9d7b4');sky.addColorStop(1,'#e8e4b4');c.fillStyle=sky;c.fillRect(0,0,1600,760);
  // Neighbourhood behind the fence.
  path(c,'M 220 87 L 286 4 L 416 9 L 478 85 Z','#b89f7c','#887b62',3);round(c,277,47,164,69,0,'#e3ceb0',null);round(c,328,57,46,47,2,'#88aaa0','#eae0b9',7);
  path(c,'M 1081 84 L 1163 -4 L 1286 8 L 1335 96 Z','#899a77','#667e62',3);round(c,1144,44,155,68,0,'#d5d0a2',null);round(c,1201,55,38,47,1,'#849c84','#efdfb1',6);
  for(let x=170;x<1620;x+=70)shrub(c,x,105+(rnd()-.5)*20,1.4,['#70914b','#85a157','#628a4c'][Math.floor(rnd()*3)]);
  // Fence has individual grain and nail heads, not a repeating image.
  round(c,218,64,1330,13,2,'#8e7954','#736345',2);round(c,218,120,1330,13,2,'#8e7954','#736345',2);
  for(let x=224;x<1570;x+=43){const h=rnd()*10;path(c,`M ${x} 142 L ${x} ${56+h} L ${x+17} ${38+h} L ${x+35} ${56+h} L ${x+36} 146 Z`,['#d3c598','#e0d0a4','#c7bb8f'][Math.floor(rnd()*3)],'#8e8861',2);line(c,[x+7,64+h,x+8,125],'#ede0b13d',3);line(c,[x+25,70+h,x+23,118],'#a69a7055',1);ellipse(c,x+17,82,2,2,'#8f8660',null);ellipse(c,x+17,126,2,2,'#8f8660',null);}
  // Stone border and the road.
  c.fillStyle='#b2b094';c.fillRect(190,140,1410,620);c.fillStyle='#c2c0a6';c.fillRect(1373,130,227,630);
  for(let y=143;y<780;y+=88){line(c,[1378,y,1599,y+13],'#949985',2);line(c,[1403,y+5,1403,y+89],'#e7debd',3);}
  path(c,'M 1533 240 L 1518 257 L 1530 281 L 1514 297 M 1579 458 L 1557 475 L 1561 496 L 1535 504',null,'#969b89',2);
  for(let i=0;i<150;i++){ellipse(c,1380+rnd()*220,150+rnd()*600,rnd()*2.5+1,rnd()+.5,'#878e7930',null);}
  // Broad perimeter lawn with a raised, uneven edge.
  path(c,'M 293 139 Q 756 128 1346 137 L 1360 166 L 1359 663 L 1341 687 Q 850 700 304 684 L 288 668 Z','#3d6b32','#507137',6);
  round(c,301,138,1049,538,8,'#79a84a',null);
  const colors=['#8fb957','#86b151','#8bb655','#82af4e'];
  for(let row=0;row<5;row++)for(let col=0;col<9;col++){
   const x=BOARD.x+col*BOARD.cw,y=BOARD.y+row*BOARD.ch;c.fillStyle=colors[(row+col)%2+(row%2?2:0)];c.fillRect(x,y,BOARD.cw,BOARD.ch);
   const g=c.createLinearGradient(x,y,x,y+106);g.addColorStop(0,'#d9ee6b0c');g.addColorStop(1,'#3158230c');c.fillStyle=g;c.fillRect(x,y,116,106);
   line(c,[x+2,y+105,x+113,y+105],'#446e2422',1);
   for(let i=0;i<20;i++){const xx=x+6+rnd()*104,yy=y+8+rnd()*91;line(c,[xx-3,yy+2,xx,yy-2,xx+2,yy+2],rnd()>.45?'#b5d57245':'#527d3433',1);}
  }
  // Short blades along the edge.
  for(let i=0;i<155;i++){let x=300+rnd()*1050;let y=rnd()>.5?139:678;path(c,`M ${x} ${y+5} l -3 -11 l 5 5 l 4 -9 l 1 13`, '#70953f',null);}
  for(let row=0;row<5;row++){
   const y=BOARD.y+row*106;path(c,`M 214 ${y+4} L 283 ${y+2} L 290 ${y+98} L 218 ${y+103} Z`,'#d5cfad','#9a9b7e',2);path(c,`M 222 ${y+9} L 274 ${y+7}`,null,'#ebe4c4',3);}
  // Honey-coloured house with crooked roof tiles.
  path(c,'M -20 56 L 103 40 L 214 155 L 203 642 L -20 691 Z','#e0c799','#857248',4);
  for(let y=170;y<652;y+=34)line(c,[0,y,199,y-37],'#bda671',2);
  path(c,'M -30 -15 L 82 -27 L 242 149 L 218 190 L -24 67 Z','#78674b','#514f34',5);
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){const x=-70+col*57+row*25,y=-40+row*35;path(c,`M ${x} ${y} l 47 15 l 28 31 l -52 -18 Z`,row%2?'#8e7856':'#997e58','#5f5940',2);}
  path(c,'M -20 73 L 223 192 L 231 173 L -15 52 Z','#b99e6d','#6a6441',4);
  // Window and open shutters.
  path(c,'M 23 232 L 118 218 L 117 355 L 19 379 Z','#655e41','#9e8858',7);path(c,'M 33 243 L 109 231 L 108 345 L 30 363 Z','#80a899','#efe0b6',6);line(c,[69,238,68,353],'#e5d7b0',7);line(c,[33,299,109,282],'#e5d7b0',7);path(c,'M 38 251 L 62 246 L 39 287 Z','#bed1b17f',null);
  path(c,'M 18 235 L -11 222 L -15 367 L 15 378 Z','#69907a','#506948',3);path(c,'M 123 220 L 154 203 L 152 339 L 123 353 Z','#69907a','#506948',3);
  for(let y=232;y<338;y+=14)line(c,[129,y,147,y-6],'#3f6b5555',2);
  // Door, step, welcome mat.
  path(c,'M 99 416 Q 144 388 186 398 L 183 598 L 96 624 Z','#6c7050','#8e8058',7);path(c,'M 111 427 L 174 415 L 172 582 L 108 600 Z','#858b62','#4c6143',3);ellipse(c,160,506,6,6,'#d7bc6e','#746840',2);
  path(c,'M 80 627 L 196 594 L 212 611 L 80 650 Z','#b3aa89','#817f64',3);path(c,'M 92 651 L 193 623 L 216 650 L 111 683 Z','#a89a6c','#7b8057',2);
  c.save();c.translate(146,653);c.rotate(-.26);c.fillStyle='#6c704a';c.font='bold 12px Georgia';c.textAlign='center';c.fillText('WELCOME',0,0);c.restore();
  // Flower bed and tiny props.
  shrub(c,34,698,1.4,'#537943');shrub(c,174,719,.8,'#6e8f40');
  for(let i=0;i<23;i++)flower(c,10+rnd()*180,690+rnd()*65,.7+rnd()*.6,['#f9eabd','#eaa094','#d8c9e7'][i%3]);
  round(c,180,124,40,18,4,'#ece1b1','#6d7651',2);c.fillStyle='#5b6946';c.font='bold 12px Georgia';c.fillText('HOME',181,137);
  // Mailbox, watering can, stones and mushrooms.
  line(c,[1455,122,1457,202],'#897553',9);path(c,'M 1430 127 L 1430 94 Q 1456 69 1485 98 L 1490 131 Z','#83a9a0','#4c7369',3);path(c,'M 1429 127 L 1429 99 Q 1446 82 1457 101 L 1457 129 Z','#638d83','#3e655c',3);line(c,[1480,99,1479,77,1493,77],'#b55f41',4);
  c.save();c.translate(269,710);c.rotate(-.17);round(c,-21,-27,38,31,7,'#75a49a','#4c7364',3);ellipse(c,-20,-18,12,14,'#0000','#4c7364',4);path(c,'M 16 -17 L 36 -36 L 41 -29 L 20 0','#75a49a','#4c7364',3);ellipse(c,39,-34,11,5,'#96bbb0','#4c7364',2,1);c.restore();
  for(let i=0;i<40;i++){const x=330+rnd()*1030,y=706+rnd()*48;ellipse(c,x,y,2+rnd()*6,2+rnd()*2,'#9d9e7230',null);if(i%4===0)flower(c,x,y,.6+rnd()*.3);}
  for(const [x,y,s] of [[1324,710,1],[1376,704,.7],[315,687,.6]]){round(c,x-3,y-17,7,17,2,'#e7d7a7','#979b6b',1);path(c,`M ${x-14*s} ${y-14} Q ${x} ${y-39*s} ${x+15*s} ${y-14} Z`,'#c78455','#8d774c',2);ellipse(c,x-3,y-22,3,2,'#f4dbb2',null);}
  // Leaves frame the scene without blocking the planting area.
  for(const [x,y,s] of [[35,3,1.9],[1535,4,1.8],[1590,68,1.5]]){shrub(c,x,y,s,'#507644');shrub(c,x-20,y-19,s*.82,'#73954b');}
  // Dappled light and afternoon warmth.
  c.save();c.beginPath();c.rect(306,142,1044,530);c.clip();for(let i=0;i<15;i++)ellipse(c,340+rnd()*950,153+rnd()*36,35+rnd()*55,12+rnd()*19,'#3154280c',null,0,.4);c.restore();
  const shade=c.createRadialGradient(850,330,240,800,380,980);shade.addColorStop(0,'#fff2af00');shade.addColorStop(1,'#52613725');c.fillStyle=shade;c.fillRect(0,0,1600,760);
  return canvas;
 }
 return {ellipse,path,line,round,grad,leaf,plant,zombie,sun,star,mower,flower,background};
})();
