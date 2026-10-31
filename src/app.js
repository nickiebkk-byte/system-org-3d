(function(){
'use strict';
const $=id=>document.getElementById(id);
const KEY='flexi-organize-3d';
const PITCH=10;                       // slot spacing on the wall rail (cm)
const RAIL_HS=[60,90,150];
const HW={w:{name:'ขาว',c:'#F1F2F4'},k:{name:'ดำ',c:'#2A2C31'}};
const COL={w:{id:'w',name:'ขาว',c:'#F4F3EF',g:'#E6E3DC',plain:true},wn:{id:'wn',name:'วอลนัท',c:'#8B5B3C',g:'#5C3820'}};
const WALLC=['#EEEAE3','#F6F6F4','#DCE3EA','#E8DCCB'];

/* ---------- Catalogue: FLEXI article codes (from the size table) ---------- */
const SKU={
  rail:{60:{w:'1146611',k:'1147709'},90:{w:'1146583',k:'1147660'},150:{w:'1146523',k:'1147749'}},
  track:{60:'1148982',80:'1148983'},
  br2:{20:{w:'1146496',k:'1147716'},30:{w:'1146574',k:'1147717'},40:{w:'1146623',k:'1147690'}},
  br1:{20:{w:'1146520',k:'1147756'},30:{w:'1146584',k:'1147774'},40:{w:'1146585',k:'1147699'}},
  brh2:{30:'1231757',40:'1231758'}, brh1:{30:'1231755',40:'1231756'},
  sl1:'1156278', sl2:'1156375',
  mel:{w:{'60x30':'1011971','60x40':'1011955','80x30':'1011967','80x40':'1011969'},wn:{'60x30':'1193367','60x40':'1193368','80x30':'1193372','80x40':'1193373'}},
  flat:{'60x30':'1148960','60x40':'1149088','80x30':'1149077','80x40':'1149141'},
  wire:{'60x30':'1148956','60x40':'1149076','80x30':'1149045','80x40':'1149058'},
  basket:{s:'1156466',d:'1156358'},
  rack:{60:'1149056',80:'1149002'}, rod:{60:'1149068',80:'1149124'}, peg:{60:'1151670',80:'1151730'}
};
const TYPES={
  mel:{name:'แผ่นชั้นเมลามีน',sub:'หนา 1.6 · ขาว / วอลนัท'},
  wire:{name:'แผ่นชั้นตะแกรง',sub:'หนา 2.5 · ระบายอากาศ'},
  flat:{name:'แผ่นชั้นเรียบ',sub:'หนา 2.5 · สีขาว'},
  basket:{name:'ตะกร้า',sub:'60×40 · ตื้น / ลึก'},
  hang:{name:'ราวแขวน',sub:'ราว 6 เส้น / อะลูมิเนียม'},
  peg:{name:'แผงเหล็ก',sub:'สูง 40 · แขวนอุปกรณ์'}
};
const BOARD=['mel','wire','flat'];
const thick=t=>t==='mel'?1.6:2.5;
function span(it){return it.t==='basket'?(it.bk==='d'?3:2):it.t==='peg'?4:1}
function fam(it){return it.t==='peg'?null:it.t==='basket'?'sl':'br'}
function brDepth(it){return it.t==='rack'?40:it.d}
function kindOf(it){return it.t==='hang'?(it.hk==='rod'?'rod':'rack'):it.t}

/* ---------- State ---------- */
const DEF=()=>({wall:{w:240,h:250,c:WALLC[0]},railH:150,railTop:200,hw:'w',track:false,align:'c',
  bays:[{w:80,items:[]},{w:80,items:[]}],active:0,
  draft:{t:'mel',d:30,col:'w',hi:false,bk:'s',hk:'rack'}});
let S=DEF(); S.sel=null; S.cur=null;
let uid=1;
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&v.bays){S=Object.assign(DEF(),v);S.sel=null}}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
load();
S.bays.forEach(b=>b.items.forEach(it=>uid=Math.max(uid,it.id+1)));

/* ---------- Geometry helpers ---------- */
const nSlots=()=>S.railH/PITCH;
const slotY=s=>S.railTop-5-PITCH*s;
const totalW=()=>S.bays.reduce((a,b)=>a+b.w,0);
function x0(){const T=totalW();return S.align==='l'?10:S.align==='r'?S.wall.w-T-10:Math.round((S.wall.w-T)/2)}
function railX(i){let x=x0();for(let k=0;k<i;k++)x+=S.bays[k].w;return x}
function findItem(id){for(let b=0;b<S.bays.length;b++){const it=S.bays[b].items.find(i=>i.id===id);if(it)return {it,b}}return null}
function occ(it,slot){const s=slot==null?it.slot:slot;return [s,s+span(it)-1]}
function canPlace(b,it,slot,ignoreId){
  const bay=S.bays[b]; if(!bay) return false;
  if(it.t==='basket'&&bay.w!==60) return false;
  const [a,z]=occ(it,slot); if(a<0||z>nSlots()-1) return false;
  return !bay.items.some(o=>o.id!==ignoreId&&o.id!==it.id&&(()=>{const [oa,oz]=occ(o);return a<=oz&&oa<=z})());
}
function freeSlot(b,it,prefGap){
  const N=nSlots();
  for(const gap of [prefGap||3,1,0]){
    for(let s=0;s<N;s++){
      if(!canPlace(b,it,s)) continue;
      const [a,z]=occ(it,s);
      if(S.bays[b].items.every(o=>{const [oa,oz]=occ(o);return a-oz>gap||oa-z>gap})) return s;
    }
  }
  return -1;
}

/* ---------- Bill of materials + bracket logic ---------- */
// For every rail and slot: shelf on the left bay and/or right bay. Shared rail with matching items → double bracket.
function analyse(){
  const bad=new Set(), warns=[], br=[]; // br: {rail, slot, kind, d, hi, side}
  const nb=S.bays.length;
  if(totalW()>S.wall.w-0) warns.push(`ผนังกว้างไม่พอ ช่องทั้งหมดกว้าง ${totalW()} ซม.`);
  if(S.railTop>S.wall.h) warns.push('ปลายรางสูงเกินผนัง');
  if(S.railTop-S.railH<0) warns.push('รางยาวเกินพื้น ลดความสูงปลายราง');
  S.bays.forEach((bay,b)=>{
    bay.items.forEach(it=>{
      if(it.t==='basket'&&bay.w!==60){bad.add(it.id);warns.push(`ตะกร้ามีแค่กว้าง 60 ซม. (ช่อง ${b+1})`)}
      const [a,z]=occ(it); if(a<0||z>nSlots()-1){bad.add(it.id);warns.push(`ชิ้นในช่อง ${b+1} เลยปลายราง`)}
      bay.items.forEach(o=>{if(o.id<=it.id)return;const [oa,oz]=occ(o);if(a<=oz&&oa<=z){bad.add(it.id);bad.add(o.id);warns.push(`ชิ้นในช่อง ${b+1} ซ้อนกัน`)}});
    });
  });
  const at=(b,s)=>b<0||b>=nb?null:S.bays[b].items.find(it=>fam(it)&&it.slot===s)||null;
  for(let r=0;r<=nb;r++){
    for(let s=0;s<nSlots();s++){
      const L=at(r-1,s), R=at(r,s);
      if(!L&&!R) continue;
      if(L&&R){
        if(fam(L)!==fam(R)){bad.add(L.id);bad.add(R.id);warns.push(`ราง ${r+1}: ตะกร้ากับชั้นอยู่ระดับเดียวกัน ใช้แขนร่วมกันไม่ได้`);
          br.push(mkBr(L,r,s,'R'));br.push(mkBr(R,r,s,'L'));continue}
        if(fam(L)==='sl'){br.push({rail:r,slot:s,kind:'sl2'});continue}
        const dL=brDepth(L),dR=brDepth(R),d=Math.max(dL,dR);
        if(dL!==dR) warns.push(`ราง ${r+1}: ชั้นซ้ายลึก ${dL} ขวาลึก ${dR} ใช้แขนคู่ ${d} ซม.`);
        br.push({rail:r,slot:s,kind:(L.hi&&R.hi&&d>=30)?'brh2':'br2',d});
      } else br.push(L?mkBr(L,r,s,'R'):mkBr(R,r,s,'L'));
    }
  }
  return {bad,warns:[...new Set(warns)],br};
}
function mkBr(it,r,s,side){ // side: which end of the shelf this bracket supports
  if(fam(it)==='sl') return {rail:r,slot:s,kind:'sl1',side};
  const d=brDepth(it); return {rail:r,slot:s,kind:(it.hi&&d>=30)?'brh1':'br1',d,side};
}
function bom(A){
  A=A||analyse(); const hw=S.hw, hn=HW[hw].name, rows={};
  const add=(code,o,q,side)=>{const r=rows[code]||(rows[code]=Object.assign({code,q:0,L:0,R:0},o));r.q+=q;if(side)r[side]+=q};
  const nb=S.bays.length;
  add(SKU.rail[S.railH][hw],{name:`รางรับชั้น ${S.railH} ซม. ${hn}`,u:'เส้น',ph:'rail',ord:1},nb+1);
  if(S.track) S.bays.forEach(b=>add(SKU.track[b.w],{name:`รางแขวนบนพร้อมฝาครอบ ${b.w} ซม. ขาว`,u:'เส้น',ph:'track',ord:2},1));
  A.br.forEach(b=>{
    if(b.kind==='br2') add(SKU.br2[b.d][hw],{name:`แขนรับชั้นเหล็กคู่ ${b.d} ซม. ${hn}`,u:'ตัว',ph:'br-2',ord:3},1);
    if(b.kind==='br1') add(SKU.br1[b.d][hw],{name:`แขนรับชั้นเหล็กเดี่ยว ${b.d} ซม. ${hn} (L,R)`,u:'ตัว',ph:'br-1',ord:4,lr:1},1,b.side);
    if(b.kind==='brh2') add(SKU.brh2[b.d],{name:`แขนรับชั้นเหล็กคู่ขอบสูง ${b.d} ซม. ขาว`,u:'ตัว',ph:'brh-2',ord:5},1);
    if(b.kind==='brh1') add(SKU.brh1[b.d],{name:`แขนรับชั้นเหล็กเดี่ยวสูง ${b.d} ซม. (L,R)`,u:'ตัว',ph:'brh-1',ord:6,lr:1},1,b.side);
    if(b.kind==='sl2') add(SKU.sl2,{name:'แขนรับรางเลื่อนตะกร้าคู่ ขาว',u:'ตัว',ph:'slide-2',ord:7},1);
    if(b.kind==='sl1') add(SKU.sl1,{name:'แขนรับรางเลื่อนตะกร้าเดี่ยว ขาว (L,R)',u:'ตัว',ph:'slide-1',ord:8,lr:1},1,b.side);
  });
  S.bays.forEach(bay=>bay.items.forEach(it=>{const p=prodOf(it,bay.w);add(p.code,p,1)}));
  return Object.values(rows).sort((a,b)=>a.ord-b.ord||a.name.localeCompare(b.name,'th'));
}
function prodOf(it,w){
  const k=`${w}x${it.d}`, K=kindOf(it);
  if(K==='mel') return {code:SKU.mel[it.col][k],name:`แผ่นชั้นเมลามีน ${w}×${it.d}×1.6 ซม. ${COL[it.col].name}`,u:'แผ่น',ph:'mel',ord:10,dot:COL[it.col].c};
  if(K==='wire') return {code:SKU.wire[k],name:`แผ่นชั้นตะแกรง ${w}×${it.d}×2.5 ซม. ขาว`,u:'แผ่น',ph:'wire',ord:11};
  if(K==='flat') return {code:SKU.flat[k],name:`แผ่นชั้นเรียบ ${w}×${it.d}×2.5 ซม. ขาว`,u:'แผ่น',ph:'flat',ord:12};
  if(K==='basket') return it.bk==='d'?{code:SKU.basket.d,name:'ตะกร้าทรงลึก + เฟรม 60×40×28 ซม. ขาว',u:'ใบ',ph:'basket-d',ord:13}
                                    :{code:SKU.basket.s,name:'ตะกร้าทรงตื้น + เฟรม 60×40×14 ซม. ขาว',u:'ใบ',ph:'basket-s',ord:14};
  if(K==='rack') return {code:SKU.rack[w],name:`ราวแขวนผ้า 6 เส้น ${w}×40 ซม. ขาว`,u:'ชิ้น',ph:'rack',ord:15};
  if(K==='rod') return {code:SKU.rod[w],name:`ราวแขวนอะลูมิเนียม ${w} ซม. ขาว`,u:'เส้น',ph:'rod',ord:16};
  return {code:SKU.peg[w],name:`แผงเหล็ก ${w}×40 ซม. ขาว`,u:'แผ่น',ph:'peg',ord:17};
}
function itemLabel(it,w){const K=kindOf(it);
  return K==='mel'?`เมลามีน ${COL[it.col].name} ${w}×${it.d}`:K==='wire'?`ชั้นตะแกรง ${w}×${it.d}`:K==='flat'?`ชั้นเรียบ ${w}×${it.d}`:
    K==='basket'?(it.bk==='d'?'ตะกร้าทรงลึก 28 ซม.':'ตะกร้าทรงตื้น 14 ซม.'):K==='rack'?`ราวแขวนผ้า 6 เส้น ${w}`:K==='rod'?`ราวอะลูมิเนียม ${w} (แขน ${it.d})`:`แผงเหล็ก ${w}×40`}

/* ---------- Three.js scene ---------- */
const host=$('view');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,1,6000);
// item dragging listens before OrbitControls so a grabbed item never also rotates the view
let drag=null;
renderer.domElement.addEventListener('pointerdown',onDown);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.12;
controls.minPolarAngle=Math.PI*0.15; controls.maxPolarAngle=Math.PI*0.56;
controls.minAzimuthAngle=-Math.PI*0.42; controls.maxAzimuthAngle=Math.PI*0.42;
controls.minDistance=60; controls.maxDistance=1400;
scene.add(new THREE.HemisphereLight(0xffffff,0xc9c2b8,0.85));
const sun=new THREE.DirectionalLight(0xffffff,0.5);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0006; sun.shadow.radius=4;
scene.add(sun); scene.add(sun.target);
const roomG=new THREE.Group(), sysG=new THREE.Group(); scene.add(roomG); scene.add(sysG);
let pickables=[], showSlots=true;

function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function box(w,h,d,mat,sh=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.castShadow=sh;m.receiveShadow=true;return m}
function clear(g){g.children.slice().forEach(c=>{g.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose()})})}
const texCache={};
function woodTex(col){
  if(texCache[col.id]) return texCache[col.id];
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle=col.c; x.fillRect(0,0,512,128);
  if(!col.plain){let seed=97;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    for(let i=0;i<70;i++){x.strokeStyle=col.g;x.globalAlpha=.08+rnd()*.22;x.lineWidth=.6+rnd()*2.2;const y0=rnd()*128;x.beginPath();x.moveTo(0,y0);
      for(let px=0;px<=512;px+=32)x.lineTo(px,y0+Math.sin(px/90+i)*3*rnd()+(rnd()-.5)*2);x.stroke()}x.globalAlpha=1}
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return texCache[col.id]=t;
}
function gridTex(){ // one wire cell: a line along the depth + a cross wire
  if(texCache.grid) return texCache.grid;
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const x=cv.getContext('2d');
  x.fillStyle='#262626'; x.fillRect(0,0,64,64); x.fillStyle='#fff'; x.fillRect(26,0,12,64); x.fillRect(0,0,64,10);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return texCache.grid=t;
}
function wireMat(rx,ry){const t=gridTex().clone();t.needsUpdate=true;t.repeat.set(rx,ry);
  return new THREE.MeshStandardMaterial({color:0xffffff,map:t,alphaMap:t,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,roughness:.45,metalness:.15})}
function pegTex(){
  if(texCache.peg) return texCache.peg;
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const x=cv.getContext('2d');
  x.fillStyle='#F3F4F6'; x.fillRect(0,0,64,64); x.fillStyle='#8a8f98'; x.beginPath(); x.arc(32,32,7,0,7); x.fill();
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; return texCache.peg=t;
}
function bracketGeo(d,hi){
  const sh=new THREE.Shape();
  if(hi){sh.moveTo(0,-4);sh.lineTo(d,-4);sh.lineTo(d,9);sh.lineTo(d*.25,12);sh.lineTo(0,12);}
  else{sh.moveTo(0,0);sh.lineTo(d,0);sh.lineTo(d,-1.6);sh.lineTo(3,-Math.max(6,d*.42));sh.lineTo(0,-Math.max(6,d*.42));}
  sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:1.1,bevelEnabled:false}); return g;
}

function buildRoom(){
  clear(roomG);
  const W=S.wall.w,H=S.wall.h;
  scene.background=new THREE.Color(css('--scene-bg'));
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshStandardMaterial({color:S.wall.c,roughness:.95}));
  wall.position.set(W/2,H/2,0); wall.receiveShadow=true; roomG.add(wall);
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(W+700,H+200),new THREE.MeshStandardMaterial({color:new THREE.Color(S.wall.c).multiplyScalar(.84),roughness:1}));
  outer.position.set(W/2,(H+200)/2,-.5); roomG.add(outer);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W+700,500),new THREE.MeshStandardMaterial({color:css('--scene-floor'),roughness:.9}));
  floor.rotation.x=-Math.PI/2; floor.position.set(W/2,0,246); floor.receiveShadow=true; roomG.add(floor);
  const sk=box(W,8,1.2,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6}),false); sk.position.set(W/2,4,.6); roomG.add(sk);
  sun.position.set(W*.6,H+120,520); sun.target.position.set(W/2,H/2,0);
  const sc=sun.shadow.camera,r=Math.max(W,H)*.8+80; sc.left=-r;sc.right=r;sc.top=r;sc.bottom=-r;sc.near=10;sc.far=1600; sc.updateProjectionMatrix();
}

function buildSystem(A){
  A=A||analyse(); clear(sysG); pickables=[];
  const hwc=HW[S.hw].c, nb=S.bays.length;
  const metal=new THREE.MeshStandardMaterial({color:hwc,roughness:.4,metalness:.35});
  const white=new THREE.MeshStandardMaterial({color:0xf3f4f6,roughness:.4,metalness:.25});
  const slotM=new THREE.MeshBasicMaterial({color:S.hw==='k'?0x6b6f78:0x7d8592});
  const top=S.railTop, bot=S.railTop-S.railH;
  for(let r=0;r<=nb;r++){
    const x=railX(r); const m=box(2.5,S.railH,1.6,metal); m.position.set(x,top-S.railH/2,.8); sysG.add(m);
    if(showSlots) for(let s=0;s<nSlots();s++){const k=new THREE.Mesh(new THREE.PlaneGeometry(.8,3.2),slotM);k.position.set(x,slotY(s)-1.2,1.62);sysG.add(k)}
  }
  if(S.track) S.bays.forEach((b,i)=>{const t=box(b.w,4.5,3,white);t.position.set(railX(i)+b.w/2,top+2.6,1.5);sysG.add(t)});
  // brackets
  A.br.forEach(b=>{
    const x=railX(b.rail), y=slotY(b.slot);
    if(b.kind==='sl1'||b.kind==='sl2'){
      const m=box(b.kind==='sl2'?2.6:1.6,3,40,white); m.position.set(x+(b.kind==='sl1'?(b.side==='L'?.9:-.9):0),y-1.5,1.6+20); sysG.add(m); return;
    }
    const hi=b.kind.startsWith('brh'), g=bracketGeo(b.d,hi);
    const mat=hi?white:metal;
    const m=new THREE.Mesh(g,mat); m.castShadow=true; m.rotation.y=-Math.PI/2; m.position.set(x+.55,y,1.6); sysG.add(m);
  });
  // items
  S.bays.forEach((bay,bi)=>{
    const xL=railX(bi), w=bay.w, cx=xL+w/2;
    bay.items.forEach(it=>{
      const g=new THREE.Group(), y=slotY(it.slot), K=kindOf(it); g.userData.id=it.id;
      if(K==='mel'||K==='flat'){
        const t=thick(K);
        const mat=K==='mel'?new THREE.MeshStandardMaterial({map:woodTex(COL[it.col]),roughness:.6}):new THREE.MeshStandardMaterial({color:0xfafbfc,roughness:.25});
        const m=box(w-.6,t,it.d,mat); m.position.set(cx,y+t/2,1.6+it.d/2); g.add(m);
      } else if(K==='wire'){
        const p=new THREE.Mesh(new THREE.PlaneGeometry(w-.6,it.d),wireMat((w-.6)/2.6,it.d/10)); p.rotation.x=-Math.PI/2; p.position.set(cx,y+1.2,1.6+it.d/2); p.castShadow=true; g.add(p);
        const f1=box(w-.6,2.4,.6,white); f1.position.set(cx,y+1.2,1.6+it.d-.3); g.add(f1);
        const f2=box(w-.6,1,.6,white); f2.position.set(cx,y+.8,2); g.add(f2);
      } else if(K==='basket'){
        const h=it.bk==='d'?28:14, bw=w-4, bd=38;
        const mats=[wireMat(bd/2.6,h/5),wireMat(bd/2.6,h/5),new THREE.MeshBasicMaterial({visible:false}),wireMat(bw/2.6,bd/5),wireMat(bw/2.6,h/5),wireMat(bw/2.6,h/5)];
        const m=new THREE.Mesh(new THREE.BoxGeometry(bw,h,bd),mats); m.castShadow=true; m.position.set(cx,y-3-h/2,1.6+1+bd/2); g.add(m);
        const rim=box(bw+1,1.2,1.2,white); rim.position.set(cx,y-2.6,1.6+1+bd); g.add(rim);
        const rim2=box(bw+1,1.2,1.2,white); rim2.position.set(cx,y-2.6,2.6); g.add(rim2);
      } else if(K==='rack'){
        [-1,1].forEach(sd=>{const s=box(1,1.6,40,white);s.position.set(cx+sd*(w/2-1.2),y,1.6+20);g.add(s)});
        for(let i=0;i<6;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,w-2.4,10),white);c.rotation.z=Math.PI/2;c.position.set(cx,y-.4,1.6+4+i*6.6);c.castShadow=true;g.add(c)}
      } else if(K==='rod'){
        const c=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,w-1.5,18),new THREE.MeshStandardMaterial({color:0xd5d9de,metalness:.7,roughness:.3}));
        c.rotation.z=Math.PI/2; c.position.set(cx,y-5,1.6+it.d*.6); c.castShadow=true; g.add(c);
      } else if(K==='peg'){
        const t=pegTex().clone(); t.needsUpdate=true; t.repeat.set((w-1)/2.5,40/2.5);
        const m=box(w-1,40,1.5,[white,white,white,white,new THREE.MeshStandardMaterial({map:t,roughness:.5}),white]); m.position.set(cx,y-20+3,1.6+.75); g.add(m);
      }
      const bad=A.bad.has(it.id), sel=S.sel===it.id;
      if(bad||sel){const bh=new THREE.BoxHelper(g,bad?0xc8361f:0xff781f);bh.material.depthTest=false;bh.renderOrder=5;sysG.add(g);sysG.add(bh)} else sysG.add(g);
      g.traverse(o=>{if(o.isMesh){o.userData.id=it.id;pickables.push(o)}});
    });
  });
}

let camMode='angle';
function setView(v){
  camMode=v||camMode; const W=S.wall.w,H=S.wall.h;
  const tgt=new THREE.Vector3(W/2,Math.min(H/2+10,S.railTop-S.railH/2+10),15);
  const fov=camera.fov*Math.PI/180, need=Math.max(H*1.05,(W*1.1)/camera.aspect);
  const dist=need/2/Math.tan(fov/2)+60;
  if(camMode==='front') camera.position.set(tgt.x,tgt.y+10,dist);
  else camera.position.set(tgt.x+dist*.45,tgt.y+dist*.18,dist*.9);
  controls.target.copy(tgt); controls.update();
  document.querySelectorAll('#viewGrp [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===camMode));
}
function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
window.addEventListener('resize',()=>{resize();if(mode2d)render2D()});
if(window.ResizeObserver) new ResizeObserver(()=>resize()).observe(host);

/* ---------- Picking & dragging (3D) ---------- */
const ray=new THREE.Raycaster();
function ndc(e){const r=renderer.domElement.getBoundingClientRect();return new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1)}
function planeHit(e,z){ray.setFromCamera(ndc(e),camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),p)?p:null}
function bayAt(x){for(let i=0;i<S.bays.length;i++)if(x>=railX(i)&&x<railX(i+1))return i;return -1}
let downAt=null;
function onDown(e){
  ray.setFromCamera(ndc(e),camera);
  const hit=ray.intersectObjects(pickables,false)[0];
  downAt={x:e.clientX,y:e.clientY,hit:!!hit};
  if(!hit) return;
  const id=hit.object.userData.id, f=findItem(id); if(!f) return;
  controls.enabled=false;
  const z=hit.point.z, p=planeHit(e,z)||hit.point;
  drag={id,z,dy:p.y-slotY(f.it.slot),moved:false};
  select(id,true);
  renderer.domElement.setPointerCapture(e.pointerId);
}
renderer.domElement.addEventListener('pointermove',e=>{
  if(!drag) return; const p=planeHit(e,drag.z); if(!p) return;
  const f=findItem(drag.id); if(!f) return;
  const s=Math.round((S.railTop-5-(p.y-drag.dy))/PITCH), b=bayAt(p.x);
  moveTo(f,b<0?f.b:b,s,true);
});
function endDrag(e){
  if(drag){controls.enabled=true;if(drag.moved){commit()}drag=null;return}
  if(downAt&&!downAt.hit&&e&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<5&&S.sel!=null){S.sel=null;buildSystem();renderSel()}
  downAt=null;
}
renderer.domElement.addEventListener('pointerup',endDrag);
renderer.domElement.addEventListener('pointercancel',endDrag);
function moveTo(f,b,s,live){
  if(b===f.b&&s===f.it.slot) return false;
  if(!canPlace(b,f.it,s,f.it.id)) return false;
  if(b!==f.b){S.bays[f.b].items=S.bays[f.b].items.filter(i=>i.id!==f.it.id);S.bays[b].items.push(f.it);S.active=b}
  f.it.slot=s; if(drag) drag.moved=true;
  if(live){buildSystem();if(mode2d)render2D();renderSel(true);renderWarn()}
  return true;
}

/* ---------- UI helpers ---------- */
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,2200)}
function chip(label,on,dis,fn,cls){const b=document.createElement('button');b.type='button';b.className='chip'+(on?' on':'')+(cls?' '+cls:'');b.innerHTML=label;b.disabled=!!dis;b.onclick=fn;return b}
function photo(ph,dot){return `<img src="photos/${ph}.jpg" alt="" loading="lazy">${dot?`<i style="background:${dot}"></i>`:''}`}
function commit(){save();renderAll()}
function select(id,quiet){S.sel=id;const f=findItem(id);if(f)S.active=f.b;buildSystem();if(mode2d)render2D();renderSel();renderBays();renderBayPick();if(!quiet&&window.innerWidth<=900){}}

/* ---------- Step 1: wall & rails ---------- */
function renderStep1(){
  $('wallW').value=S.wall.w; $('wallH').value=S.wall.h; $('railTop').value=S.railTop;
  const rc=$('railChips'); rc.innerHTML='';
  RAIL_HS.forEach(h=>rc.appendChild(chip(`${h} ซม.<small style="display:block;font-weight:400;font-size:11px;opacity:.8">${h/PITCH} ช่อง</small>`,S.railH===h,false,()=>{setRailH(h)},'sz')));
  const hc=$('hwChips'); hc.innerHTML='';
  Object.entries(HW).forEach(([k,v])=>hc.appendChild(chip(`<i style="background:${v.c}"></i>${v.name}`,S.hw===k,false,()=>{S.hw=k;buildSystem();commit()},'br')));
  const sw=$('trackSw'); sw.setAttribute('aria-checked',String(!!S.track));
  const ac=$('alignChips'); ac.innerHTML='';
  [['l','ชิดซ้าย'],['c','กึ่งกลาง'],['r','ชิดขวา']].forEach(([k,n])=>ac.appendChild(chip(n,S.align===k,false,()=>{S.align=k;buildSystem();commit()})));
  renderBays();
}
function setRailH(h){
  S.railH=h; if(S.railTop-h<0) S.railTop=Math.min(S.wall.h,h+20);
  S.bays.forEach(b=>b.items.forEach(it=>{const mx=nSlots()-span(it);if(it.slot>mx)it.slot=Math.max(0,mx)}));
  buildSystem(); setView(); commit();
}
function renderBays(){
  const box=$('bays'); box.innerHTML='';
  S.bays.forEach((b,i)=>{
    const row=document.createElement('div'); row.className='bayrow'+(S.active===i?' active':'');
    const pick=document.createElement('button'); pick.type='button'; pick.className='pick';
    pick.innerHTML=`ช่อง ${i+1}<small>${b.items.length?b.items.length+' ชิ้น':'ว่าง'} · ราง ${i+1}–${i+2}</small>`;
    pick.onclick=()=>{S.active=i;S.sel=null;buildSystem();renderAll()};
    const cs=document.createElement('div'); cs.className='chips';
    [60,80].forEach(w=>cs.appendChild(chip(String(w),b.w===w,false,()=>{b.w=w;S.active=i;buildSystem();commit()})));
    const x=document.createElement('button'); x.type='button'; x.className='xbtn'; x.textContent='✕'; x.title='ลบช่องนี้'; x.disabled=S.bays.length<2;
    x.onclick=()=>{if(S.bays.length<2)return;S.bays.splice(i,1);S.active=Math.min(S.active,S.bays.length-1);S.sel=null;buildSystem();setView();commit();toast(`ลบช่อง ${i+1} แล้ว`)};
    row.append(pick,cs,x); box.appendChild(row);
  });
}
function addBay(w){if(S.bays.length>=8){toast('ใส่ได้สูงสุด 8 ช่อง');return}S.bays.push({w,items:[]});S.active=S.bays.length-1;buildSystem();setView();commit()}
$('addBay60').onclick=()=>addBay(60); $('addBay80').onclick=()=>addBay(80);
$('trackSw').onclick=()=>{S.track=!S.track;buildSystem();commit()};
const num=(el,min,max,fn)=>el.addEventListener('change',()=>{let v=Math.round(+el.value||0);v=Math.max(min,Math.min(max,v));el.value=v;fn(v)});
num($('wallW'),60,800,v=>{S.wall.w=v;buildRoom();buildSystem();setView();commit()});
num($('wallH'),120,400,v=>{S.wall.h=v;if(S.railTop>v)S.railTop=v;buildRoom();buildSystem();setView();commit()});
num($('railTop'),60,400,v=>{S.railTop=v;buildSystem();setView();commit()});

/* ---------- Step 2: product picker ---------- */
function optsFor(o,box,onChange,widths){
  box.innerHTML='';
  const lab=t=>{const d=document.createElement('div');d.className='label';d.textContent=t;box.appendChild(d)};
  const row=()=>{const d=document.createElement('div');d.className='chips';box.appendChild(d);return d};
  const set=(k,v)=>{o[k]=v;onChange()};
  if(BOARD.includes(o.t)){
    lab('ความลึก (ซม.)'); const r=row(); [30,40].forEach(d=>r.appendChild(chip(String(d),o.d===d,false,()=>set('d',d))));
    if(o.t==='mel'){lab('สีแผ่น'); const r2=row(); Object.values(COL).forEach(c=>r2.appendChild(chip(`<i style="background:${c.c}"></i>${c.name}`,o.col===c.id,false,()=>set('col',c.id),'br')))}
    lab('แบบแขนรับชั้น'); const r3=row();
    r3.appendChild(chip('ธรรมดา',!o.hi,false,()=>set('hi',false)));
    r3.appendChild(chip('ขอบสูง <small style="font-weight:400">(สีขาว)</small>',!!o.hi,false,()=>set('hi',true)));
  } else if(o.t==='basket'){
    lab('ทรงตะกร้า'); const r=row();
    r.appendChild(chip('ทรงตื้น<small style="display:block;font-weight:400;font-size:11px">60×40×14</small>',o.bk==='s',false,()=>set('bk','s'),'sz'));
    r.appendChild(chip('ทรงลึก<small style="display:block;font-weight:400;font-size:11px">60×40×28</small>',o.bk==='d',false,()=>set('bk','d'),'sz'));
  } else if(o.t==='hang'){
    lab('ชนิดราว'); const r=row();
    r.appendChild(chip('ราวแขวนผ้า 6 เส้น',o.hk!=='rod',false,()=>{o.hk='rack';o.d=40;onChange()}));
    r.appendChild(chip('ราวอะลูมิเนียม',o.hk==='rod',false,()=>{o.hk='rod';if(![20,30,40].includes(o.d))o.d=30;onChange()}));
    if(o.hk==='rod'){lab('ความลึกแขนรับชั้น (ซม.)');const r2=row();[20,30,40].forEach(d=>r2.appendChild(chip(String(d),o.d===d,false,()=>set('d',d))))}
  }
}
function normDraft(o){
  if(BOARD.includes(o.t)&&![30,40].includes(o.d)) o.d=30;
  if(o.t==='basket') o.d=40;
  if(o.t==='hang'){ if(o.hk!=='rod'){o.hk='rack';o.d=40} else if(![20,30,40].includes(o.d)) o.d=30 }
  if(o.t!=='mel') o.col=o.col||'w';
  if(!BOARD.includes(o.t)) o.hi=false;
}
function renderStep2(){
  const seg=$('typeSeg'); seg.innerHTML='';
  Object.entries(TYPES).forEach(([k,v])=>{const b=document.createElement('button');b.type='button';b.className=S.draft.t===k?'on':'';b.innerHTML=`<b>${v.name}</b><small>${v.sub}</small>`;
    b.onclick=()=>{S.draft.t=k;normDraft(S.draft);save();renderStep2()};seg.appendChild(b)});
  normDraft(S.draft);
  optsFor(S.draft,$('draftOpts'),()=>{normDraft(S.draft);save();renderStep2()});
  renderBayPick(); renderSpec();
}
function renderBayPick(){
  const bp=$('bayPick'); bp.innerHTML='';
  S.bays.forEach((b,i)=>bp.appendChild(chip(`ช่อง ${i+1}<small style="display:block;font-weight:400;font-size:11px">กว้าง ${b.w}</small>`,S.active===i,S.draft.t==='basket'&&b.w!==60,()=>{S.active=i;S.sel=null;buildSystem();renderAll()},'sz na')));
  const bw=(S.bays[S.active]||{}).w;
  const ok=!(S.draft.t==='basket'&&bw!==60);
  $('addBtn').disabled=!ok; $('addBtn').style.opacity=ok?1:.5;
  $('step2Aux').textContent=S.draft.t==='basket'?'ตะกร้าใส่ได้เฉพาะช่องกว้าง 60':'';
}
function renderSpec(){
  const o=S.draft, w=(S.bays[S.active]||S.bays[0]).w, wOK=!(o.t==='basket'&&w!==60);
  const p=prodOf(o,wOK?w:60), d=o.t==='basket'?null:brDepth(o);
  let brTxt=o.t==='peg'?'เกี่ยวกับรางรับชั้นโดยตรง':o.t==='basket'?'ใช้แขนรับรางเลื่อนตะกร้า 2 ข้าง':`ใช้แขนรับชั้น${o.hi?'ขอบสูง':''} ${d} ซม. 2 ข้าง`;
  if(o.t==='flat') brTxt+=' · วางบนแขนที่มีเดือยยึด';
  $('specBox').innerHTML=`<div class="specrow"><div class="specimg">${photo(p.ph,p.dot)}</div><div><b>${p.name}</b><div class="note">รหัส ${p.code}</div><div class="note">${brTxt}</div>${o.hi&&S.hw==='k'?'<div class="note" style="color:var(--warn)">แขนขอบสูงมีเฉพาะสีขาว</div>':''}</div></div>`;
}
function addItem(all){
  const o=JSON.parse(JSON.stringify(S.draft)); normDraft(o);
  const targets=all?S.bays.map((_,i)=>i).filter(i=>!(o.t==='basket'&&S.bays[i].w!==60)):[S.active];
  if(!targets.length){toast('ไม่มีช่องที่ใส่สินค้านี้ได้');return}
  let slot=-1;
  if(all){ // first slot free in every target bay, so neighbours share double brackets
    for(let s=0;s<nSlots();s++){const it=Object.assign({id:-1},o);if(targets.every(b=>canPlace(b,it,s))&&targets.every(b=>S.bays[b].items.every(x=>{const [a,z]=occ(it,s),[oa,oz]=occ(x);return a-oz>2||oa-z>2}))){slot=s;break}}
    if(slot<0) for(let s=0;s<nSlots();s++){const it=Object.assign({id:-1},o);if(targets.every(b=>canPlace(b,it,s))){slot=s;break}}
  } else slot=freeSlot(S.active,Object.assign({id:-1},o));
  if(slot<0){toast('รางเต็มแล้ว ลองเลื่อนชิ้นอื่น หรือใช้รางที่สูงขึ้น');return}
  let last=null;
  targets.forEach(b=>{const it=Object.assign({},o,{id:uid++,slot});S.bays[b].items.push(it);last=it});
  S.sel=last.id; buildSystem(); commit();
  toast(all?`เพิ่ม ${targets.length} ช่อง ที่ความสูง ${slotY(slot)} ซม.`:`เพิ่มที่ช่อง ${S.active+1} สูง ${slotY(slot)} ซม.`);
}
$('addBtn').onclick=()=>addItem(false);
$('addAllBtn').onclick=()=>addItem(true);

/* ---------- Step 3: selection ---------- */
function renderSel(liveOnly){
  const a=$('selArea'); const f=S.sel!=null?findItem(S.sel):null;
  if(!f){a.innerHTML='<div class="empty">แตะชิ้นงานในภาพเพื่อเลือก แล้วเลื่อนขึ้นลงทีละ 10 ซม. หรือย้ายไปช่องข้าง ๆ</div>';return}
  const {it,b}=f, w=S.bays[b].w, p=prodOf(it,w);
  const pos=`ช่อง ${b+1} · ${it.t==='basket'||it.t==='peg'?'ขอบบน':'ผิวชั้น'}สูงจากพื้น ${slotY(it.slot)} ซม.`;
  if(liveOnly&&a.querySelector('.t small')){a.querySelector('.t small').textContent=pos;return}
  a.innerHTML=`<div class="selcard"><div class="specrow"><div class="specimg">${photo(p.ph,p.dot)}</div><div class="t">${itemLabel(it,w)}<small>${pos}</small><small>รหัส ${p.code}</small></div></div>
    <div class="nudge"><button data-n="up" type="button">▲ ขึ้น 10</button><button data-n="dn" type="button">▼ ลง 10</button><button data-n="l" type="button">◀ ช่องซ้าย</button><button data-n="r" type="button">ช่องขวา ▶</button></div>
    <div id="selOpts"></div>
    <div class="btns"><button class="btn ghost" id="dupAll" type="button">คัดลอกไปทุกช่อง</button><button class="btn danger" id="delSel" type="button">ลบชิ้นนี้</button></div></div>`;
  a.querySelectorAll('[data-n]').forEach(btn=>btn.onclick=()=>{
    const f2=findItem(S.sel); if(!f2) return; const n=btn.dataset.n;
    let ok;
    if(n==='up'||n==='dn'){const dir=n==='up'?-1:1;ok=false;for(let s=f2.it.slot+dir;s>=0&&s<nSlots();s+=dir){if(moveTo(f2,f2.b,s)){ok=true;break}}}
    else {const nb=f2.b+(n==='l'?-1:1);ok=nb>=0&&nb<S.bays.length&&moveTo(f2,nb,f2.it.slot)}
    if(!ok){toast('เลื่อนไปทางนั้นไม่ได้');return}
    buildSystem(); commit();
  });
  optsFor(it,$('selOpts'),()=>{normDraft(it);if(!canPlace(b,it,it.slot,it.id)){const s=freeSlot(b,it,0);if(s>=0)it.slot=s}buildSystem();commit()});
  $('delSel').onclick=()=>{S.bays[b].items=S.bays[b].items.filter(x=>x.id!==it.id);S.sel=null;buildSystem();commit();toast('ลบแล้ว')};
  $('dupAll').onclick=()=>{let n=0;S.bays.forEach((bay,i)=>{if(i===b)return;const c=Object.assign({},it,{id:uid++});if(canPlace(i,c,it.slot)){bay.items.push(c);n++}});
    buildSystem();commit();toast(n?`คัดลอกไป ${n} ช่อง ระดับเดียวกัน`:'ช่องอื่นไม่มีที่ว่างระดับนี้')};
}
const PRESETS={
  office:{name:'มุมทำงาน',railH:150,railTop:200,bays:[{w:80,items:[['mel',2,{d:30,col:'wn'}],['mel',6,{d:30,col:'wn'}],['mel',10,{d:30,col:'wn'}]]},{w:80,items:[['mel',2,{d:30,col:'wn'}],['peg',5],['mel',10,{d:30,col:'wn'}]]}]},
  wardrobe:{name:'ตู้เสื้อผ้าเปิด',railH:150,railTop:205,bays:[{w:80,items:[['wire',0,{d:40}],['hang',1,{hk:'rod',d:30}]]},{w:60,items:[['wire',0,{d:40}],['basket',5,{bk:'s'}],['basket',8,{bk:'d'}],['basket',12,{bk:'s'}]]},{w:80,items:[['wire',0,{d:40}],['hang',3,{hk:'rack',d:40}],['flat',10,{d:40}]]}]},
  store:{name:'ห้องเก็บของ',railH:90,railTop:180,bays:[{w:60,items:[['wire',0,{d:30}],['basket',3,{bk:'s'}],['basket',6,{bk:'s'}]]},{w:60,items:[['wire',0,{d:30}],['peg',3],['flat',8,{d:30}]]}]}
};
function applyPreset(k){
  const p=PRESETS[k]; S.railH=p.railH; S.railTop=p.railTop; S.sel=null; S.active=0;
  S.wall.w=Math.max(S.wall.w,p.bays.reduce((a,b)=>a+b.w,0)+40);
  S.bays=p.bays.map(b=>({w:b.w,items:b.items.map(([t,slot,o])=>{const it=Object.assign({t,d:30,col:'w',hi:false,bk:'s',hk:'rack'},o||{},{id:uid++,slot});normDraft(it);return it})}));
  buildRoom();buildSystem();setView();commit();toast(`ใช้แบบตัวอย่าง "${p.name}"`);
}
function renderPresets(){const p=$('presets');p.innerHTML='';Object.entries(PRESETS).forEach(([k,v])=>{const b=document.createElement('button');b.type='button';b.textContent=v.name;b.onclick=()=>applyPreset(k);p.appendChild(b)})}

/* ---------- Step 4: list ---------- */
function renderList(A){
  const items=bom(A), ul=$('list'); ul.innerHTML='';
  if(!items.length){ul.innerHTML='<li><span></span><span class="nm">ยังไม่มีสินค้า</span><span></span></li>'}
  items.forEach(it=>{const li=document.createElement('li');
    const lr=it.lr?`<small>ซ้าย ${it.L} · ขวา ${it.R}</small>`:'';
    li.innerHTML=`<div class="thumb">${photo(it.ph,it.dot)}</div><div class="nm">${it.name}<small>รหัส <code>${it.code}</code></small>${lr}</div><div class="qty">${it.q}<small>${it.u}</small></div>`;ul.appendChild(li)});
  const n=S.bays.reduce((a,b)=>a+b.items.length,0), brs=A.br.length;
  $('sum').innerHTML=`<span>รางรับชั้น <b>${S.bays.length+1}</b> เส้น</span><span>แขนรับ <b>${brs}</b> ตัว</span><span>ชั้น/ตะกร้า/ราว <b>${n}</b> ชิ้น</span><span>รวม <b>${items.length}</b> รหัสสินค้า</span>`;
  $('lrNote').textContent=items.some(i=>i.lr)?'แขนเดี่ยว (L,R): L คือแขนข้างซ้ายของชั้น R คือข้างขวา หากรหัสนี้ขายเป็นชุดคู่ L+R ให้นับจำนวนชุดตามจำนวนที่มากกว่า':'';
  $('listAux').textContent=`ผนัง ${S.wall.w}×${S.wall.h} ซม.`;
  $('countPill').textContent=`${n} ชิ้น · ${S.bays.length} ช่อง`;
}
function listText(){
  const items=bom(); const lines=[`แบบจัดระบบ FLEXI${S.cur?': '+S.cur.name:''}`,`ผนัง ${S.wall.w}×${S.wall.h} ซม. · ราง ${S.railH} ซม. ปลายรางสูง ${S.railTop} ซม. · ${S.bays.map(b=>b.w).join('+')} ซม.`,''];
  items.forEach(i=>lines.push(`${i.code}  ${i.name}  × ${i.q} ${i.u}${i.lr?` (ซ้าย ${i.L} · ขวา ${i.R})`:''}`));
  return lines.join('\n');
}
$('copyBtn').onclick=async()=>{const t=listText();try{await navigator.clipboard.writeText(t);toast('คัดลอกรายการแล้ว')}catch(e){const c=$('copyBox');c.hidden=false;c.value=t;c.select();toast('กดค้างเพื่อคัดลอก')}};
$('clearBtn').onclick=()=>{$('clearConfirm').hidden=false};
$('clearNo').onclick=()=>{$('clearConfirm').hidden=true};
$('clearYes').onclick=()=>{S.bays.forEach(b=>b.items=[]);S.sel=null;$('clearConfirm').hidden=true;buildSystem();commit();toast('ล้างสินค้าแล้ว')};

function renderWarn(A){A=A||analyse();const w=$('warnbar');w.hidden=!A.warns.length;w.textContent=A.warns.length?'⚠ '+A.warns[0]+(A.warns.length>1?` (+${A.warns.length-1})`:''):''}
function renderAll(){const A=analyse();renderStep1();renderStep2();renderSel();renderList(A);renderWarn(A);if(mode2d)render2D();updCurUI()}

/* ---------- 2D elevation with dimensions ---------- */
let mode2d=false;
function elevSVG(opt){
  opt=opt||{}; const A=analyse(), W=S.wall.w, H=S.wall.h, M=46, R=70;
  const hwc=S.hw==='k'?'#2A2C31':'#9AA3AF', vw=W+M+R+6, vh=H+M+34;
  const X=x=>M+x, Y=y=>M+(H-y);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${opt.px||'100%'}" ${opt.px?`height="${Math.round(opt.px*vh/vw)}"`:'height="100%"'} font-family="Prompt, sans-serif" preserveAspectRatio="xMidYMid meet">`;
  s+=`<defs><pattern id="gw" width="2.6" height="5" patternUnits="userSpaceOnUse"><rect width="2.6" height="5" fill="#fff"/><path d="M1.3 0V5M0 .3H2.6" stroke="#9aa3af" stroke-width=".45"/></pattern><pattern id="pg" width="2.5" height="2.5" patternUnits="userSpaceOnUse"><rect width="2.5" height="2.5" fill="#F3F4F6"/><circle cx="1.25" cy="1.25" r=".45" fill="#8a8f98"/></pattern></defs>`;
  if(opt.mode==='export') s+=`<rect width="${vw}" height="${vh}" fill="#fff"/>`;
  s+=`<rect x="${X(0)}" y="${Y(H)}" width="${W}" height="${H}" fill="${S.wall.c}" stroke="#b8c0cc" stroke-width=".6"/>`;
  s+=`<line x1="${X(-20)}" x2="${X(W+20)}" y1="${Y(0)}" y2="${Y(0)}" stroke="#56627a" stroke-width="1.2"/>`;
  const top=S.railTop, nb=S.bays.length;
  if(S.track) S.bays.forEach((b,i)=>{s+=`<rect x="${X(railX(i))}" y="${Y(top+5)}" width="${b.w}" height="4.5" fill="#fff" stroke="#9aa3af" stroke-width=".4"/>`});
  for(let r=0;r<=nb;r++){const x=railX(r);s+=`<rect x="${X(x)-1.25}" y="${Y(top)}" width="2.5" height="${S.railH}" fill="${hwc}"/>`;
    if(showSlots||opt.mode==='export') for(let k=0;k<nSlots();k++) s+=`<rect x="${X(x)-.4}" y="${Y(slotY(k))-.4}" width=".8" height="3" fill="${S.hw==='k'?'#888':'#fff'}"/>`}
  // items
  const hts=[];
  S.bays.forEach((bay,bi)=>{const xL=railX(bi),w=bay.w;
    bay.items.forEach(it=>{const y=slotY(it.slot),K=kindOf(it),bad=A.bad.has(it.id),sel=S.sel===it.id&&opt.mode!=='export';
      const stroke=bad?'#c8361f':sel?'#ff781f':'#56627a', sw=bad||sel?1.4:.5;
      let g=`<g data-id="${it.id}" style="cursor:grab">`, labY=y;
      if(K==='mel'||K==='flat'){const t=Math.max(thick(K),2.2);g+=`<rect x="${X(xL)+.6}" y="${Y(y+t)}" width="${w-1.2}" height="${t}" fill="${K==='mel'?COL[it.col].c:'#fbfcfd'}" stroke="${stroke}" stroke-width="${sw}"/>`}
      else if(K==='wire'){g+=`<rect x="${X(xL)+.6}" y="${Y(y+2.5)}" width="${w-1.2}" height="2.5" fill="url(#gw)" stroke="${stroke}" stroke-width="${sw}"/>`}
      else if(K==='basket'){const h=it.bk==='d'?28:14;g+=`<rect x="${X(xL)+2}" y="${Y(y-3)}" width="${w-4}" height="${h}" fill="url(#gw)" stroke="${stroke}" stroke-width="${sw}" rx="1"/>`;labY=y-3}
      else if(K==='rack'){g+=`<rect x="${X(xL)+.6}" y="${Y(y+1)}" width="${w-1.2}" height="2" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>`}
      else if(K==='rod'){g+=`<rect x="${X(xL)+.8}" y="${Y(y-3.6)}" width="${w-1.6}" height="2.8" rx="1.4" fill="#cfd4da" stroke="${stroke}" stroke-width="${sw}"/>`}
      else if(K==='peg'){g+=`<rect x="${X(xL)+.5}" y="${Y(y+3)}" width="${w-1}" height="40" fill="url(#pg)" stroke="${stroke}" stroke-width="${sw}"/>`;labY=y+3}
      // invisible hit area for easy tapping
      const hh=K==='basket'?(it.bk==='d'?28:14):K==='peg'?40:8;
      g+=`<rect x="${X(xL)}" y="${Y(labY+(K==='basket'||K==='peg'?0:5))}" width="${w}" height="${hh}" fill="transparent"/>`;
      g+=`<text x="${X(xL)+w/2}" y="${Y(labY)+(K==='basket'||K==='peg'?hh/2+2:-3.6)}" font-size="5" text-anchor="middle" fill="#374458">${itemLabel(it,w)}</text>`;
      g+='</g>'; s+=g;
      // height mark at the right
      s+=`<line x1="${X(xL+w)}" x2="${X(W)+5}" y1="${Y(labY)}" y2="${Y(labY)}" stroke="#c4cad4" stroke-width=".3" stroke-dasharray="1 1"/>`; hts.push(labY);
    })});
  // heights from floor at the right; labels closer than 6 cm are spread apart so they never overlap
  {let last=-1e9;[...new Set(hts)].sort((p,q)=>q-p).forEach(h=>{const ty=Math.max(Y(h)+1.8,last+6);s+=`<text x="${X(W)+6}" y="${ty}" font-size="5" fill="#13284D">${h}</text>`;last=ty})}
  // dimensions: bay widths above rails
  const dy=Y(top)-(S.track?14:9);
  const dim=(x1,x2,y,t)=>`<line x1="${X(x1)}" x2="${X(x2)}" y1="${y}" y2="${y}" stroke="#0755b5" stroke-width=".5"/><line x1="${X(x1)}" x2="${X(x1)}" y1="${y-2}" y2="${y+2}" stroke="#0755b5" stroke-width=".5"/><line x1="${X(x2)}" x2="${X(x2)}" y1="${y-2}" y2="${y+2}" stroke="#0755b5" stroke-width=".5"/><text x="${(X(x1)+X(x2))/2}" y="${y-1.6}" font-size="5.6" text-anchor="middle" fill="#0755b5" font-weight="600">${t}</text>`;
  S.bays.forEach((b,i)=>s+=dim(railX(i),railX(i+1),dy,`${b.w}`));
  if(nb>1) s+=dim(railX(0),railX(nb),dy-9,`รวม ${totalW()}`);
  s+=dim(0,W,vh-12,`ผนัง ${W}`);
  if(railX(0)>0) s+=dim(0,railX(0),Y(0)-6,`${railX(0)}`);
  // rail height from floor (left side)
  s+=`<line x1="${M-18}" x2="${M-18}" y1="${Y(top)}" y2="${Y(0)}" stroke="#ff781f" stroke-width=".5"/><text x="${M-20}" y="${(Y(top)+Y(0))/2}" font-size="5.6" fill="#ff781f" text-anchor="middle" transform="rotate(-90 ${M-20} ${(Y(top)+Y(0))/2})">ปลายราง ${top}</text>`;
  s+=`<line x1="${M-34}" x2="${M-34}" y1="${Y(H)}" y2="${Y(0)}" stroke="#627b9a" stroke-width=".5"/><text x="${M-36}" y="${(Y(H)+Y(0))/2}" font-size="5.6" fill="#627b9a" text-anchor="middle" transform="rotate(-90 ${M-36} ${(Y(H)+Y(0))/2})">ผนังสูง ${H}</text>`;
  s+=`<text x="${X(W)+5}" y="${Y(top)-3}" font-size="4.4" fill="#627b9a">สูงจากพื้น</text>`;
  s+='</svg>'; return s;
}
let drag2=null;
function render2D(){const p=$('plan2d');p.innerHTML=elevSVG();}
function svgPt(e){const svg=$('plan2d').querySelector('svg');const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse())}
$('plan2d').addEventListener('pointerdown',e=>{
  const g=e.target.closest('[data-id]'); if(!g){if(S.sel!=null){S.sel=null;buildSystem();render2D();renderSel()}return}
  const id=+g.dataset.id, f=findItem(id); if(!f) return;
  const p=svgPt(e), M=46, y=S.wall.h-(p.y-M);
  drag2={id,dy:y-slotY(f.it.slot),moved:false}; S.sel=id; S.active=f.b; render2D(); renderSel(); renderBayPick(); renderBays();
  $('plan2d').setPointerCapture(e.pointerId);
});
$('plan2d').addEventListener('pointermove',e=>{
  if(!drag2) return; const f=findItem(drag2.id); if(!f) return;
  const p=svgPt(e), M=46, x=p.x-M, y=S.wall.h-(p.y-M);
  const s=Math.round((S.railTop-5-(y-drag2.dy))/PITCH), b=bayAt(x);
  if(moveTo(f,b<0?f.b:b,s,false)){drag2.moved=true;buildSystem();render2D();renderSel(true);renderWarn()}
});
const end2=()=>{if(drag2&&drag2.moved)commit();drag2=null};
$('plan2d').addEventListener('pointerup',end2); $('plan2d').addEventListener('pointercancel',end2);
function setMode(two){mode2d=two;$('plan2d').hidden=!two;host.style.visibility=two?'hidden':'visible';$('m2d').classList.toggle('on',two);$('m3d').classList.toggle('on',!two);$('viewGrp').style.display=two?'none':'';
  $('hint').textContent=two?'แตะชิ้นงานเพื่อเลือก · ลากขึ้นลงหรือไปช่องข้าง ๆ · ตัวเลขด้านขวาคือความสูงจากพื้น (ซม.)':'แตะชิ้นงานเพื่อเลือก · ลากขึ้นลงทีละ 10 ซม. หรือลากไปช่องข้าง ๆ · ลากที่ว่างเพื่อหมุนมุมมอง';
  if(two)render2D(); else resize(); try{localStorage.setItem(KEY+'-view',two?'2d':'3d')}catch(e){}}
$('m2d').onclick=()=>setMode(true); $('m3d').onclick=()=>setMode(false);
document.querySelectorAll('#viewGrp [data-v]').forEach(b=>b.onclick=()=>setView(b.dataset.v));
$('slotBtn').onclick=()=>{showSlots=!showSlots;$('slotBtn').classList.toggle('on',showSlots);buildSystem();if(mode2d)render2D()};

/* ---------- Export: PNG / PDF with product list ---------- */
let dl=null; (async()=>{try{dl=window.claude?await window.claude.use('downloads'):null}catch(e){dl=null}})();
const PG={w:1754,h:1240,m:70};
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
function snap3D(){
  const keep={p:camera.position.clone(),t:controls.target.clone(),a:camera.aspect,mode:camMode};
  const sel=S.sel; S.sel=null; buildSystem();
  const sz=renderer.getSize(new THREE.Vector2());
  renderer.setSize(1200,800,false); camera.aspect=1.5; camera.updateProjectionMatrix();
  setView('angle'); renderer.render(scene,camera); const url=renderer.domElement.toDataURL('image/jpeg',.9);
  renderer.setSize(sz.x,sz.y,false); camera.aspect=keep.a; camera.updateProjectionMatrix();
  camera.position.copy(keep.p); controls.target.copy(keep.t); controls.update(); camMode=keep.mode;
  document.querySelectorAll('#viewGrp [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===camMode));
  S.sel=sel; buildSystem(); return url;
}
function newPage(n,total,dateStr){
  const c=document.createElement('canvas'); c.width=PG.w; c.height=PG.h; const x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,PG.w,PG.h);
  x.fillStyle='#0755b5'; x.fillRect(0,0,PG.w,110); x.fillStyle='#ff781f'; x.fillRect(0,110,PG.w,6);
  x.fillStyle='#fff'; x.font='700 44px Prompt, sans-serif'; x.textBaseline='middle';
  x.fillText(S.cur?`แบบจัดระบบ FLEXI: ${S.cur.name}`:'แบบจัดระบบ FLEXI ORGANIZE',PG.m,55);
  x.font='400 22px Prompt, sans-serif'; x.textAlign='right';
  x.fillText(`ผนัง ${S.wall.w}×${S.wall.h} ซม. · ราง ${S.railH} ซม. · ${dateStr}`,PG.w-PG.m,46);
  x.fillText(`หน้า ${n}/${total}`,PG.w-PG.m,78); x.textAlign='left';
  x.fillStyle='#8A93A3'; x.font='400 18px Prompt, sans-serif';
  x.fillText('หน่วยเป็นเซนติเมตร · ความสูงวัดจากพื้นถึงผิวชั้น / ขอบบนตะกร้า · ตรวจสอบรหัสสินค้าก่อนสั่งซื้อ',PG.m,PG.h-36);
  return {c,x};
}
function sectionTitle(x,t,y){x.fillStyle='#073574';x.font='600 30px Prompt, sans-serif';x.textBaseline='alphabetic';x.fillText(t,PG.m,y)}
function fitDraw(x,img,bx,by,bw,bh){const s=Math.min(bw/img.width,bh/img.height);const w=img.width*s,h=img.height*s;x.drawImage(img,bx+(bw-w)/2,by+(bh-h)/2,w,h)}
async function buildPages(){
  try{await Promise.all(['700 44px Prompt','600 30px Prompt','400 22px Prompt','600 22px Prompt'].map(f=>document.fonts.load(f)))}catch(e){}
  const d=new Date(), dateStr=`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;
  const A=analyse(), items=bom(A);
  const elevImg=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(elevSVG({mode:'export',px:2400})));
  const shot=await loadImg(snap3D());
  const thumbs=await Promise.all(items.map(it=>loadImg(`photos/${it.ph}.jpg`).catch(()=>null)));
  const ROW=86, perFirst=Math.max(0,Math.floor((PG.h-140-860)/ROW)), perPage=Math.floor((PG.h-190-120)/ROW);
  const listFirst=items.length<=perFirst, total=1+(listFirst?0:Math.ceil(items.length/perPage));
  const pages=[];
  let {c,x}=newPage(1,total,dateStr);
  sectionTitle(x,'แบบด้านผนัง พร้อมระยะ',172);
  fitDraw(x,elevImg,PG.m,190,PG.w-PG.m*2-470,listFirst?600:PG.h-190-90);
  const sx=PG.w-PG.m-440; x.fillStyle='#073574'; x.font='600 30px Prompt, sans-serif'; x.fillText('ภาพ 3D',sx,172);
  x.save(); x.beginPath(); x.roundRect?x.roundRect(sx,190,440,293,14):x.rect(sx,190,440,293); x.clip(); x.drawImage(shot,sx,190,440,293); x.restore();
  x.fillStyle='#F1F5FB'; x.fillRect(sx,505,440,285);
  x.fillStyle='#073574'; x.font='600 26px Prompt, sans-serif'; x.fillText('สรุป',sx+24,548);
  x.font='400 22px Prompt, sans-serif'; x.fillStyle='#142e50';
  const n=S.bays.reduce((a,b)=>a+b.items.length,0);
  [`ช่อง ${S.bays.map(b=>b.w).join(' + ')} ซม.`,`รางรับชั้น ${S.bays.length+1} เส้น · แขน ${A.br.length} ตัว`,`ชั้น ตะกร้า ราว ${n} ชิ้น`,`รวม ${items.length} รหัสสินค้า`].forEach((t,i)=>x.fillText(t,sx+24,592+i*44));
  const head=(x,y)=>{x.fillStyle='#0755b5';x.fillRect(PG.m,y,PG.w-PG.m*2,48);x.fillStyle='#fff';x.font='600 22px Prompt, sans-serif';x.textBaseline='middle';
    x.fillText('รูป',PG.m+20,y+24);x.fillText('รหัส',PG.m+170,y+24);x.fillText('รายการสินค้า',PG.m+330,y+24);x.textAlign='right';x.fillText('จำนวน',PG.w-PG.m-20,y+24);x.textAlign='left';x.textBaseline='alphabetic';return y+48};
  const row=(x,it,img,y,i)=>{
    x.fillStyle=i%2?'#F7F9FC':'#fff'; x.fillRect(PG.m,y,PG.w-PG.m*2,ROW);
    x.strokeStyle='#DCE5F1'; x.strokeRect(PG.m+16,y+8,120,ROW-16); if(img) fitDraw(x,img,PG.m+20,y+11,112,ROW-22);
    x.fillStyle='#0755b5'; x.font='600 24px Prompt, sans-serif'; x.fillText(it.code,PG.m+170,y+52);
    x.fillStyle='#142e50'; x.font='600 24px Prompt, sans-serif'; x.fillText(it.name,PG.m+330,y+(it.lr?40:52));
    if(it.lr){x.fillStyle='#627b9a';x.font='400 19px Prompt, sans-serif';x.fillText(`ซ้าย ${it.L} · ขวา ${it.R}`,PG.m+330,y+68)}
    x.fillStyle='#073574'; x.font='600 34px Prompt, sans-serif'; x.textAlign='right'; x.fillText(String(it.q),PG.w-PG.m-80,y+54);
    x.font='400 20px Prompt, sans-serif'; x.fillStyle='#627b9a'; x.fillText(it.u,PG.w-PG.m-20,y+54); x.textAlign='left';
  };
  let y, idx=0;
  if(listFirst){sectionTitle(x,'รายการสินค้า',852); y=head(x,868); for(;idx<items.length;idx++){row(x,items[idx],thumbs[idx],y,idx);y+=ROW}}
  else {x.fillStyle='#627b9a';x.font='400 22px Prompt, sans-serif';x.fillText(`รายการสินค้า ${items.length} รายการ อยู่หน้าถัดไป`,sx,830)}
  pages.push(c); let pn=2;
  while(idx<items.length){({c,x}=newPage(pn,total,dateStr));sectionTitle(x,pn===2?'รายการสินค้า':'รายการสินค้า (ต่อ)',172);pn++;y=head(x,190);
    for(let k=0;k<perPage&&idx<items.length;k++,idx++){row(x,items[idx],thumbs[idx],y,idx);y+=ROW} pages.push(c)}
  return pages;
}
const stamp=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
function canvasBlob(c,type,q){return new Promise(r=>c.toBlob(r,type,q))}
async function offer(filename,blob,previewCanvas){
  if(!window.claude){try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('บันทึกไฟล์แล้ว');return}catch(e){}}
  if(!dl&&window.claude&&window.claude.use){try{dl=await window.claude.use('downloads')}catch(e){dl=null}}
  if(dl){try{await dl.save({filename,data:blob});toast('บันทึกไฟล์แล้ว');return}catch(e){if(e&&e.code==='declined'){toast('ยกเลิกการบันทึก');return}}}
  $('exportImg').src=previewCanvas.toDataURL('image/png'); $('exportModal').hidden=false;
}
async function doExport(kind){
  const btn=$(kind==='png'?'pngBtn':'pdfBtn'), old=btn.textContent; btn.disabled=true; btn.textContent='กำลังสร้างไฟล์…';
  try{
    const pages=await buildPages();
    const tall=document.createElement('canvas'); tall.width=PG.w; tall.height=PG.h*pages.length;
    const tx=tall.getContext('2d'); pages.forEach((p,i)=>tx.drawImage(p,0,i*PG.h));
    if(kind==='png') await offer(`flexi-plan-${stamp()}.png`,await canvasBlob(tall,'image/png'),tall);
    else{
      if(!window.jspdf){toast('โหลดตัวสร้าง PDF ไม่สำเร็จ ลองบันทึกเป็น PNG แทน');return}
      const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      pages.forEach((p,i)=>{if(i)doc.addPage('a4','landscape');doc.addImage(p.toDataURL('image/jpeg',.92),'JPEG',0,0,297,210)});
      await offer(`flexi-plan-${stamp()}.pdf`,doc.output('blob'),tall);
    }
  }catch(e){console.error(e);toast('สร้างไฟล์ไม่สำเร็จ ลองอีกครั้ง')}
  finally{btn.disabled=false;btn.textContent=old;if(mode2d)render2D()}
}
$('pngBtn').onclick=()=>doExport('png'); $('pdfBtn').onclick=()=>doExport('pdf');
$('exportClose').onclick=()=>{$('exportModal').hidden=true};
window.__flexi={S:()=>S,bom,analyse,buildPages,listText};

/* ---------- Saved designs (browser; signed-in storage when available) ---------- */
const LKEY=KEY+'-designs';
const store={mode:'local',col:null,list:[],ready:false,err:null};
function stateOf(){return JSON.parse(JSON.stringify({wall:S.wall,railH:S.railH,railTop:S.railTop,hw:S.hw,track:S.track,align:S.align,bays:S.bays}))}
const sigOf=st=>JSON.stringify(st);
function isDirty(){return !S.cur||S.cur.sig!==sigOf(stateOf())}
function localList(){try{return JSON.parse(localStorage.getItem(LKEY)||'[]')}catch(e){return []}}
function localWrite(list){try{localStorage.setItem(LKEY,JSON.stringify(list));return true}catch(e){return false}}
function updCurUI(){const n=S.cur?S.cur.name:null;$('curName').textContent=n?`แบบ: ${n}${isDirty()?' · มีการแก้ไข':''}`:'แบบใหม่ · ยังไม่ได้บันทึก';$('myBtnN').textContent=store.list.length?` (${store.list.length})`:''}
async function initStore(){
  store.list=localList(); store.ready=true; updCurUI();
  if(!window.claude||!window.claude.use) return;
  try{
    const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    const id=user?await user.id():null; if(!db||!id) return;
    store.col=db.collection('data/users/'+id); store.mode='db'; store.ready=false;
    const timer=setTimeout(()=>{store.err='ยังเชื่อมต่อที่เก็บแบบไม่ได้ ลองใหม่อีกครั้งภายหลัง';renderDesigns()},10000);
    store.col.orderBy('updatedAt','desc').onSnapshot(snap=>{store.list=snap.docs.map(d=>Object.assign({id:d.id},d.data()));if(!snap.metadata.fromCache){clearTimeout(timer);store.err=null;store.ready=true}updCurUI();renderDesigns()},
      ()=>{clearTimeout(timer);store.err='โหลดแบบที่บันทึกไว้ไม่สำเร็จ';store.ready=true;renderDesigns()});
  }catch(e){}
}
function thumbNow(){try{const src=snap3D();return new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=300;c.height=200;c.getContext('2d').drawImage(i,0,0,300,200);res(c.toDataURL('image/jpeg',.72))};i.onerror=()=>res(null);i.src=src})}catch(e){return Promise.resolve(null)}}
function summaryOf(){return {bays:S.bays.length,items:S.bays.reduce((a,b)=>a+b.items.length,0)}}
async function saveDesign(asNew){
  const name=$('dName').value.trim()||defaultName(); const btn=asNew?$('dSaveNew'):$('dSaveOver'); btn.disabled=true;
  try{
    const st=stateOf(), body={name,updatedAt:Date.now(),state:st,summary:summaryOf(),thumb:await thumbNow()};
    let id=(!asNew&&S.cur)?S.cur.id:null;
    if(store.mode==='db'){if(id)await store.col.doc(id).set(body);else{const ref=await store.col.add(body);id=ref.id}}
    else{const list=localList();if(!id)id='l'+Date.now().toString(36);const i=list.findIndex(d=>d.id===id),rec=Object.assign({id},body);if(i>=0)list[i]=rec;else list.unshift(rec);
      if(!localWrite(list)){toast('พื้นที่ในเบราว์เซอร์เต็ม ลบแบบเก่าก่อนแล้วลองใหม่');return}store.list=list}
    S.cur={id,name,sig:sigOf(st)}; save(); updCurUI(); renderDesigns(); $('saveModal').hidden=true; toast(`บันทึกแบบ "${name}" แล้ว`);
  }catch(e){toast('บันทึกแบบไม่สำเร็จ ลองอีกครั้ง')}finally{btn.disabled=false}
}
function defaultName(){const d=new Date();return `แบบ ${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function openSave(){$('dName').value=S.cur?S.cur.name:defaultName();$('dSaveOver').hidden=!S.cur;$('dSaveOver').textContent=S.cur?`บันทึกทับ "${S.cur.name}"`:'';
  $('dSaveNew').textContent=S.cur?'บันทึกเป็นแบบใหม่':'บันทึกแบบ';$('saveWhere').textContent=store.mode==='db'?'แบบจะเก็บในบัญชีของคุณ เห็นได้เฉพาะคุณ':'แบบจะเก็บในเบราว์เซอร์นี้เท่านั้น';
  $('saveModal').hidden=false;setTimeout(()=>{$('dName').focus();$('dName').select()},30)}
function loadDesign(d){const st=d.state;if(!st||!st.bays){toast('แบบนี้เปิดไม่ได้');return}
  Object.assign(S,JSON.parse(JSON.stringify(st))); S.sel=null; S.active=0;
  S.bays.forEach(b=>b.items.forEach(it=>uid=Math.max(uid,it.id+1)));
  S.cur={id:d.id,name:d.name,sig:sigOf(stateOf())}; buildRoom(); buildSystem(); setView(); commit(); $('designsModal').hidden=true; toast(`เปิดแบบ "${d.name}" แล้ว`)}
let delArm=null;
async function deleteDesign(d){if(delArm!==d.id){delArm=d.id;renderDesigns();return}delArm=null;
  try{if(store.mode==='db')await store.col.doc(d.id).delete();else{store.list=localList().filter(x=>x.id!==d.id);localWrite(store.list)}
    if(S.cur&&S.cur.id===d.id){S.cur=null;save()}updCurUI();renderDesigns();toast(`ลบแบบ "${d.name}" แล้ว`)}catch(e){toast('ลบไม่สำเร็จ ลองอีกครั้ง')}}
function newDesign(){const keep=S.wall;S=DEF();S.wall=keep;S.sel=null;S.cur=null;buildRoom();buildSystem();setView();commit();$('designsModal').hidden=true;toast('เริ่มแบบใหม่แล้ว')}
function renderDesigns(){
  const box=$('dList'); if(!box) return; const dirty=isDirty();
  $('dNote').textContent=store.err?store.err:dirty&&S.cur?`แบบ "${S.cur.name}" มีการแก้ไขที่ยังไม่บันทึก`:'';
  $('dWhere').textContent=store.mode==='db'?'เก็บในบัญชีของคุณ':'เก็บในเบราว์เซอร์นี้';
  if(!store.ready&&!store.list.length){box.innerHTML='<div class="empty">กำลังโหลดแบบที่บันทึกไว้…</div>';return}
  if(!store.list.length){box.innerHTML='<div class="empty">ยังไม่มีแบบที่บันทึกไว้ กด "บันทึกแบบ" ที่ด้านบนเพื่อเก็บแบบที่กำลังจัดอยู่</div>';return}
  box.innerHTML='';
  store.list.forEach(d=>{const el=document.createElement('div');el.className='dcard'+(S.cur&&S.cur.id===d.id?' cur':'');
    const t=new Date(d.updatedAt||0),when=`${t.getDate()}/${t.getMonth()+1}/${t.getFullYear()+543} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`,sm=d.summary||{};
    el.innerHTML=`<div class="dthumb">${d.thumb?`<img src="${d.thumb}" alt="">`:''}</div><div class="dinfo"><b></b><small>${when}</small><small>${sm.bays||0} ช่อง · ${sm.items||0} ชิ้น</small></div><div class="dact"><button class="btn primary-s" type="button">เปิด</button><button class="btn ${delArm===d.id?'danger':'ghost'}" type="button">${delArm===d.id?'ยืนยันลบ':'ลบ'}</button></div>`;
    el.querySelector('b').textContent=d.name||'ไม่มีชื่อ'; const [ob,xb]=el.querySelectorAll('.dact button'); ob.onclick=()=>loadDesign(d); xb.onclick=()=>deleteDesign(d); box.appendChild(el)});
}
$('saveBtn').onclick=openSave;
$('myBtn').onclick=()=>{delArm=null;renderDesigns();$('designsModal').hidden=false};
$('dSaveNew').onclick=()=>saveDesign(true); $('dSaveOver').onclick=()=>saveDesign(false);
$('dCancel').onclick=()=>{$('saveModal').hidden=true}; $('dClose').onclick=()=>{$('designsModal').hidden=true}; $('dNew').onclick=newDesign;
$('saveForm').addEventListener('submit',e=>{e.preventDefault();saveDesign(!S.cur)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('saveModal').hidden=true;$('designsModal').hidden=true}});
setInterval(()=>{if(S.cur)updCurUI()},1500);
initStore();

/* ---------- Boot ---------- */
if(!S.bays.some(b=>b.items.length)&&!localStorage.getItem(KEY+'-seen')){ // first visit: show a filled example
  try{localStorage.setItem(KEY+'-seen','1')}catch(e){}
  const p=PRESETS.wardrobe; S.railH=p.railH;S.railTop=p.railTop;S.wall.w=Math.max(S.wall.w,260);
  S.bays=p.bays.map(b=>({w:b.w,items:b.items.map(([t,slot,o])=>{const it=Object.assign({t,d:30,col:'w',hi:false,bk:'s',hk:'rack'},o||{},{id:uid++,slot});normDraft(it);return it})}));
}
renderPresets(); resize(); buildRoom(); buildSystem(); renderAll(); setView('angle');
try{if(localStorage.getItem(KEY+'-view')==='2d')setMode(true)}catch(e){}
(function loop(){requestAnimationFrame(loop);if(mode2d)return;controls.update();renderer.render(scene,camera)})();
})();
