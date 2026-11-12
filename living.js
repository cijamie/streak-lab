// Pulse and Flow: two ways to give a still photograph a movement it couldn't capture.
// Pulse: something in the photo sends a disturbance through the space around it.
// Flow: one detail stays perfectly still while the rest of the photo flows around it.
// Both render on the GPU (WebGL) and record a seamless loop with MediaRecorder.
(function(){
const MODE=document.body.dataset.mode==='flow'?'flow':'pulse', OTHER=MODE==='pulse'?'flow':'pulse';
const $=id=>document.getElementById(id), TAU=Math.PI*2;

// ---------- settings: P belongs to this tool, S is shared by both so a series matches
const DEF={
  pulse:{style:'ripple',strength:35,reach:55,settle:50,still:8,dir:0,variety:55,seed:1,pt:{x:.5,y:.45},zoom:100,fx:50,fy:50},
  flow:{style:'last',strength:60,dir:0,halo:35,soften:35,size:12,shape:0,variety:55,seed:1,pt:{x:.5,y:.45},zoom:100,fx:50,fy:50}};
const SDEF={grade:'muted',grain:22,dur:8,aspect:'45'};
const P=JSON.parse(JSON.stringify(DEF[MODE])), S={...SDEF};
const STYLES={
  pulse:{
    ripple:'A soft wave spreads from the source, bends what it passes, and sometimes leaves a weaker, slightly different echo.',
    breathe:'The space around the source slowly expands and contracts, like something breathing in the room.',
    tension:'Straight lines bow toward the source, hold, then let go with a small rebound.',
    aftershock:'One clear disturbance, followed by smaller and smaller echoes.',
    interrupted:'The pulse begins, hesitates part way, then carries on.',
    directional:'The disturbance travels one way, down a hallway or along a road, instead of spreading equally. Set the direction below.'},
  flow:{
    anchor:'The subject stays intact while the surroundings stream past it, parting around it like a current around a stone.',
    last:'Only a small detail stays. Everything else stretches into long bands, softens toward colour and pulls apart in patches, then comes back.',
    resist:'The stretching creeps up to the subject as if to pull it apart, slows at its edge, and retreats. It never quite succeeds.'}};

// ---------- small helpers
let toastT=0;const status=t=>{const el=$('status');el.textContent=t;el.hidden=!t;clearTimeout(toastT);if(t)toastT=setTimeout(()=>el.hidden=true,5000)};
const tick=()=>new Promise(r=>setTimeout(r,30));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const easeIO=t=>t<=0?0:t>=1?1:t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function rng(seed){let a=(seed*2654435761)>>>0||1;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const loadImg=b=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(b)});
const isHeic=f=>/hei[cf]/i.test(f.type||'')||/\.(heic|heif)$/i.test(f.name||'');
let heicP=null;
function convertHeic(f){if(!heicP)heicP=new Promise((res,rej)=>{if(window.heic2any)return res(window.heic2any);const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';s.onload=()=>res(window.heic2any);s.onerror=()=>{heicP=null;rej(new Error('the HEIC converter couldn’t load'))};document.head.appendChild(s)});
  return heicP.then(h=>h({blob:f,toType:'image/jpeg',quality:.95})).then(b=>new File([Array.isArray(b)?b[0]:b],(f.name||'photo').replace(/\.(heic|heif)$/i,'')+'.jpg',{type:'image/jpeg'}))}
async function readPhoto(f){try{return{img:await loadImg(f),blob:f}}catch(e){if(isHeic(f)){status('Converting the HEIC photo…');const j=await convertHeic(f);return{img:await loadImg(j),blob:j}}throw new Error('that file couldn’t be opened')}}
const idb=(()=>{let dbp=null;const open=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('streaklab',2);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
  const run=(n,m,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction(n,m),r=fn(t.objectStore(n));t.oncomplete=()=>res(r&&r.result);t.onerror=t.onabort=()=>rej(t.error)}));
  return{get:k=>run('kv','readonly',s=>s.get(k)),set:(k,v)=>run('kv','readwrite',s=>s.put(v,k))}})();
async function saveFiles(list){
  const files=list.map(f=>new File([f.blob],f.name,{type:f.blob.type}));
  if(navigator.canShare&&navigator.canShare({files})){try{await navigator.share({files});return}catch(e){if(e.name==='AbortError')return}}
  for(const f of list){const a=document.createElement('a');a.href=URL.createObjectURL(f.blob);a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);await new Promise(r=>setTimeout(r,400))}}
const stamp=()=>new Date().toISOString().slice(0,19).replace(/[-:T]/g,'');

// ---------- the photo, framed to the video's shape
let img=null, blob=null, name='', framed=null, W=1080, H=1350, mask=null; // mask: AI outline {w,h,data,fit,key} in framed pixels
const minDim=()=>Math.min(W,H);
function dims(){if(S.aspect==='orig'&&img){const r=clamp(img.naturalHeight/img.naturalWidth,.5,2);return[1080,Math.round(1080*r/2)*2]}
  return({'45':[1080,1350],'11':[1080,1080],'916':[1080,1920]})[S.aspect]||[1080,1350]}
const frameKey=()=>JSON.stringify([S.aspect,P.zoom,P.fx,P.fy,name]);
function buildFramed(){if(!img)return;[W,H]=dims();const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.imageSmoothingQuality='high';
  const s=Math.max(W/img.naturalWidth,H/img.naturalHeight)*P.zoom/100,dw=img.naturalWidth*s,dh=img.naturalHeight*s;
  x.drawImage(img,-(dw-W)*P.fx/100,-(dh-H)*P.fy/100,dw,dh);framed=c;
  if(mask&&mask.key!==frameKey()){mask=null;status('The outline was cleared because the framing changed. Find it again if you need it.')}
  if(R){R.setImage(c);R.setMask(mask)}syncAnchorUI();dirty=true}

// ---------- shaders
const COMMON=`precision highp float;
uniform sampler2D uTex;uniform vec2 uCan,uRes;uniform float uMin,uGrain,uFrame;uniform int uGrade;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){return .55*vnoise(p)+.3*vnoise(p*2.03+7.1)+.15*vnoise(p*4.01+3.7);}
vec3 tex(vec2 q){return texture2D(uTex,clamp(q/uRes,vec2(0.),vec2(1.))).rgb;}
vec2 pix(){vec2 f=gl_FragCoord.xy/uCan;return vec2(f.x,1.-f.y)*uRes;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 grade(vec3 c){float l=luma(c);
  if(uGrade==1){c=mix(vec3(l),c,.62);c=c*.9+.045;c*=vec3(1.03,1.,.95);}
  else if(uGrade==2){c=mix(vec3(l),c,.72);c=mix(c*vec3(.82,.93,1.14),c*vec3(1.1,1.,.84),smoothstep(.15,.85,l));c=c*.94+.02;}
  else if(uGrade==3){c=vec3(l)*vec3(1.04,1.,.92);c=(c-.5)*1.08+.5;c=c*.93+.03;}
  else if(uGrade==4){c=mix(vec3(l),c,.8);c=c*.8+.1;c*=vec3(1.03,1.,.95);}
  return c;}
vec3 finish(vec3 c){c=grade(c);c+=(hash(gl_FragCoord.xy+fract(uFrame*.618034)*97.)-.5)*uGrain*.1;return clamp(c,0.,1.);}
`;
// Pulse: up to eight disturbances, each a ring (radius, amplitude, width, noise phase) with a lean (direction, bias, unevenness)
const PULSE_FS=COMMON+`uniform vec2 uSrc;uniform float uProt,uReach;uniform int uKind,uN;uniform vec4 uE[8];uniform vec4 uF[8];
void main(){vec2 p=pix(),v=p-uSrc;float d=length(v);vec2 n=d>.001?v/d:vec2(0.);
  float keep=smoothstep(uProt,uProt*1.7+uMin*.012,d),fall=1./(1.+d/(uReach*1.5));
  vec2 disp=vec2(0.);float sh=0.;
  for(int i=0;i<8;i++){if(i>=uN)break;vec4 e=uE[i],f=uF[i];float c=dot(n,f.xy),w=mix(1.,smoothstep(-.35,1.,c),f.z);
    if(uKind==0){float de=d*mix(1.,.55,f.z*max(c,0.)),un=(vnoise(n*2.4+e.w)-.5)*2.*f.w,R=e.x*(1.+.35*un),x=(de-R)/e.z,g=exp(-x*x);
      disp+=n*(e.y*-x*g*2.33*w*fall);sh+=e.y/uMin*(1.-2.*x*x)*g*w*fall;}
    else if(uKind==1){float r=d/uReach,g=r*exp(-r*r)*1.65;disp-=n*(e.y*g*w);sh+=e.y/uMin*exp(-r*r)*w*.5;}
    else{float r=d/uReach,g=exp(-r*r)*min(1.,d/(uProt*2.+1.));disp+=n*(e.y*g*w);sh-=e.y/uMin*exp(-r*r)*w*.4;}}
  vec3 col=tex(p+disp*keep)*(1.+sh*keep*3.5);
  gl_FragColor=vec4(finish(col),1.);}`;
// Flow: a current around (or past) the protected detail. Each area has its own start and return time.
const FLOW_FS=COMMON+`uniform vec2 uC,uAx,uDir,uStrong;uniform sampler2D uMask;uniform float uHasMask,uAmt,uT,uSpread,uSeed,uHalo,uSoft,uWob,uBand;uniform int uKind;uniform vec4 uEnv;
float prot(vec2 q){if(uHasMask>.5)return texture2D(uMask,clamp(q/uRes,vec2(0.),vec2(1.))).r;float r=length((q-uC)/uAx);return 1.-smoothstep(.94,1.04,r);}
void main(){vec2 p=pix();vec3 orig=tex(p);float m=prot(p);vec2 rel=p-uC;float rr=length(rel/uAx);
  float d1=(fbm(p/(uMin*.5)+uSeed)-.5)*uSpread,d2=(fbm(p/(uMin*.35)+uSeed+17.3)-.5)*uSpread;
  float e=smoothstep(uEnv.x+d1,uEnv.y+d1,uT)*(1.-smoothstep(uEnv.z+d2,uEnv.w+d2,uT));
  vec2 pd=vec2(-uDir.y,uDir.x),dir=uDir;float spd=1.;
  if(uKind==0){float a=sqrt(uAx.x*uAx.y)*1.1;vec2 z=vec2(dot(rel,uDir),dot(rel,pd))/a;float r2=max(dot(z,z),1.04),r4=r2*r2;
    vec2 vel=vec2(1.-(z.x*z.x-z.y*z.y)/r4,-2.*z.x*z.y/r4);spd=length(vel);vec2 vn=vel/max(spd,1e-3);dir=uDir*vn.x+pd*vn.y;}
  float ang=(fbm(p/(uMin*.3)+uSeed+5.1)-.5)*uWob,ca=cos(ang),sa=sin(ang);dir=vec2(dir.x*ca-dir.y*sa,dir.x*sa+dir.y*ca);
  float q=dot(p,pd),band=.6*vnoise(vec2(q/(uMin*uBand),uSeed*3.1))+.4*vnoise(vec2(q/(uMin*uBand*5.),uSeed*1.7+4.)),trail=.2+1.6*band*band;
  vec2 ds=p-uStrong;float strong=1.+.9*exp(-dot(ds,ds)/(uMin*uMin*.1)),h;
  if(uKind==0)h=smoothstep(1.,1.+uHalo,rr);
  else if(uKind==1)h=smoothstep(1.,1.+uHalo*.5,rr)*mix(1.,.3+smoothstep(.3,.7,vnoise(p/(uMin*.2)+uSeed+9.)),.6);
  else h=smoothstep(1.03,1.03+uHalo*2.*(1.12-e),rr);
  float L=uAmt*e*strong*trail*h*mix(1.,spd,.5);
  vec3 acc=vec3(0.);float ws=0.;
  for(int k=0;k<12;k++){float s=(float(k)+1.)/12.;vec2 qq=p-dir*L*s;float w=(.35+s)*(1.-prot(qq));acc+=tex(qq)*w;ws+=w;}
  vec3 col=ws>.001?acc/ws:orig;
  col=mix(col,vec3(luma(col)),e*uSoft*(1.-m)*.55);
  col=mix(col,orig,m);
  gl_FragColor=vec4(finish(col),1.);}`;

// ---------- WebGL renderer
const gl$=$('gl');let R=null;
function makeRenderer(cv){
  const gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,MODE==='pulse'?PULSE_FS:FLOW_FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const al=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
  const mkTex=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t};
  const t0=mkTex(),t1=mkTex();gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,1,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,new Uint8Array([0]));
  const L={};const loc=n=>n in L?L[n]:(L[n]=gl.getUniformLocation(pr,n));
  gl.uniform1i(loc('uTex'),0);gl.uniform1i(loc('uMask'),1);
  return{
    setImage(c){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,c)},
    setMask(m){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t1);if(m)gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,m.w,m.h,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,m.data);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,1,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,new Uint8Array([0]))},
    draw(u){gl.viewport(0,0,cv.width,cv.height);
      for(const k in u){const v=u[k],l=loc(k);if(l==null)continue;
        if(k[1]==='K'||k==='uGrade'||k==='uN')gl.uniform1i(l,v);
        else if(typeof v==='number')gl.uniform1f(l,v);
        else if(v.length===2)gl.uniform2fv(l,v);else if(v.length===4)gl.uniform4fv(l,v);else gl.uniform4fv(l,v)}
      gl.drawArrays(gl.TRIANGLES,0,3)}}}
const GRADES={none:0,muted:1,night:2,mono:3,faded:4};

// ---------- Pulse: a "personality" generated once per seed, then animated smoothly
function pulsePlan(){
  const r=rng(P.seed*7919+11),v=P.variety/100,D=S.dur,M=minDim(),J=a=>1+(r()*2-1)*a*v;
  const kind=P.style==='breathe'?1:P.style==='tension'?2:0, directional=P.style==='directional';
  const open=1+r()*.9*v, pause=Math.max(1.2,D*.18), end=D-pause, reach=P.reach/100*M, settle=.5+P.settle/100*2.2;
  const amp=P.strength/100*.035*M, baseDir=directional?P.dir*Math.PI/180:r()*TAU, bias0=directional?.88:.08+.3*v;
  const ev=[], words=[];
  const ring=(t0,a,o={})=>{const dir=baseDir+(r()*2-1)*(directional?.25:1.4)*v;
    ev.push({t0,a:amp*a,spd:reach*1.15*J(.35),w:M*.035*J(.3),dx:Math.cos(dir),dy:Math.sin(dir),bias:Math.min(.95,bias0*J(.6)),un:(.15+.85*v)*(.3+.7*r()),ph:r()*50,dec:settle*J(.35),hes:o.hes||null})};
  if(kind===0){
    if(P.style==='aftershock'){ring(open,1);let t=open,gap=.3+.3*r(),a=.5;const n=2+Math.round(r()*(1+2*v));
      for(let k=0;k<n&&t+gap<end-1;k++){t+=gap;gap*=1.25+.5*r();ring(t,a*J(.3));a*=.5+.2*r()}
      words.push(`one clear disturbance, then ${ev.length-1} smaller echo${ev.length>2?'es':''}`)}
    else if(P.style==='interrupted'){const n=1+(D>=8&&r()<.3+.5*v?1:0);let t=open;
      for(let k=0;k<n;k++){const hes={at:.25+.4*r(),len:.45+.9*r()*(.4+v)};ring(t,k?.6*J(.3):1,{hes});words.push(k?`a second, weaker try ${(t-open).toFixed(1)} s later`:`hesitates for ${hes.len.toFixed(1)} s, then carries on`);t+=hes.at+hes.len+1.5+r()*2;if(t>end-2.5)break}}
    else{let t=open,k=0,echoes=0;const n=1+(r()<.3+.4*v?1:0)+(D>=10&&r()<.5*v?1:0);
      while(k<n){ring(t,k?.75*J(.4):1);if(r()<.35+.35*v){ring(t+.45+.55*r(),.3+.3*r());echoes++}k++;t+=1.8+r()*(1+2.4*v);if(t>end-2.5)break}
      words.push(k===1?`one pulse${echoes?' with a weaker echo':''}`:`${k} pulses${echoes?`, ${echoes===k?'each':echoes===1?'one':echoes} with a weaker echo`:''}`)}}
  const breaths=[], pulls=[];
  if(kind===1){let t=open*.6;while(t<end-1.8){const dur=2.2+r()*1.3*(.5+v);breaths.push({t0:t,dur,a:amp*2.2*J(.5)});t+=dur+r()*1.4*v}
    words.push(`${breaths.length} breath${breaths.length>1?'s':''}`)}
  if(kind===2){let t=open;const n=1+(D>=8&&r()<.25+.5*v?1:0);
    for(let k=0;k<n;k++){const p={t0:t,att:1.2+r()*1*(.5+v),hold:.4+.7*r(),rel:.3+.3*r(),a:amp*2.6*(k?.6:1)*J(.3)};
      if(t+p.att+p.hold+1.5>end){if(k)break;const sc=Math.max(.3,(end-t-1.5)/(p.att+p.hold));p.att*=sc;p.hold*=sc}pulls.push(p);t+=p.att+p.hold+1.6+r()*1.5}
    words.push(`${pulls.length===1?'one long pull':pulls.length+' pulls'} and a release`)}
  const dir=baseDir, lean=['right','down-right','down','down-left','left','up-left','up','up-right'][Math.round(((dir%TAU+TAU)%TAU)/(TAU/8))%8];
  const first=kind===0?ev[0].t0:kind===1?breaths[0].t0:pulls[0].t0;
  const w0=words.join('; '),desc=`${w0[0].toUpperCase()+w0.slice(1)}. Starts after ${first.toFixed(1)} s${kind===0||v>.3?`, leans ${lean}`:''}${kind===0?`, settles ${settle<1.1?'quickly':settle<2?'gently':'slowly'}`:''}, then ${(D-end).toFixed(1)} s of quiet before it loops.`;
  // the state of every disturbance at time t, packed for the shader
  const fade=t=>1-sm((t-end)/(pause*.6));
  function at(t){const E=new Float32Array(32),F=new Float32Array(32);let n=0;const f=fade(t);
    const put=(Rr,A,Wd,ph,dx,dy,bias,un)=>{if(n>=8||Math.abs(A)<amp*.01)return;E.set([Rr,A,Wd,ph],n*4);F.set([dx,dy,bias,un],n*4);n++};
    if(kind===0)for(const e of ev){const tau=t-e.t0;if(tau<0)continue;let tw=tau,dip=1;
      if(e.hes){const h=e.hes;if(tau>h.at&&tau<h.at+h.len){tw=h.at+(tau-h.at)*.06;dip=1-.15*Math.sin(Math.PI*(tau-h.at)/h.len)}else if(tau>=h.at+h.len)tw=tau-h.len*.94}
      const A=e.a*sm(tw/.25)*Math.exp(-tw/e.dec)*dip*f;put(e.spd*tw*(1-.12*Math.min(tw/3,1)),A,e.w*(1+.35*tw),e.ph,e.dx,e.dy,e.bias,e.un)}
    else if(kind===1){let A=0;for(const b of breaths){const s=(t-b.t0)/b.dur;if(s>0&&s<1)A+=b.a*Math.pow(Math.sin(Math.PI*Math.pow(s,.8)),2)}put(0,A*f,1,0,Math.cos(dir),Math.sin(dir),bias0*.6,0)}
    else{let A=0;for(const p of pulls){const tau=t-p.t0;if(tau<0)continue;
      if(tau<p.att)A+=p.a*easeIO(tau/p.att);else if(tau<p.att+p.hold)A+=p.a*(1+.03*Math.sin(tau*23)*v);
      else{const u=(tau-p.att-p.hold)/p.rel;A+=p.a*Math.exp(-1.6*u)*Math.cos(2.4*u)}}
      put(0,A*f,1,0,Math.cos(dir),Math.sin(dir),bias0*.6,0)}
    return{E,F,n}}
  return{kind,at,desc,reach}}

// ---------- Flow: one envelope for the whole photo, with every area starting and returning at its own time
function anchorGeom(){const M=minDim();
  if(mask&&mask.fit)return{c:[mask.fit.cx*W,mask.fit.cy*H],ax:[mask.fit.ax*W,mask.fit.ay*H]};
  const base=P.size/100*M,s=P.shape/100*.8;return{c:[P.pt.x*W,P.pt.y*H],ax:[base*Math.exp(s),base*Math.exp(-s)]}}
const fr=x=>x-Math.floor(x);
function hashJ(x,y){x=fr(x*123.34);y=fr(y*456.21);const d=x*(x+45.32)+y*(y+45.32);x+=d;y+=d;return fr(x*y)}
function vnoiseJ(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const a=hashJ(ix,iy),b=hashJ(ix+1,iy),c=hashJ(ix,iy+1),d=hashJ(ix+1,iy+1);return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy}
const fbmJ=(x,y)=>.55*vnoiseJ(x,y)+.3*vnoiseJ(x*2.03+7.1,y*2.03+7.1)+.15*vnoiseJ(x*4.01+3.7,y*4.01+3.7);
function flowPlan(){
  const r=rng(P.seed*7919+5),v=P.variety/100,D=S.dur,M=minDim();
  const spread=v*D*.16;let rs=Math.max(.7+r()*.5,.45+spread/2);
  const rise=D*(.3+.08*r()),hold=D*(.08+.08*r()),fall=D*(.26+.06*r());
  let env=[rs,rs+rise,rs+rise+hold,rs+rise+hold+fall];const last=D-.5-spread/2;if(env[3]>last){const k=(last-rs)/(env[3]-rs);env=env.map(x=>rs+(x-rs)*k)}
  const strong=[r(),r()],seed=r()*100,ang=P.dir*Math.PI/180+(r()*2-1)*.2*v,wob=.15+v*.9,band=.008+.014*r();
  const where=(x,y)=>(y<.34?'top':y>.66?'bottom':'middle')+(x<.34?' left':x>.66?' right':'');
  // which area starts first: average the same timing noise the shader uses, per third of the frame
  let firstAt='',lo=1e9;for(let gy=0;gy<3;gy++)for(let gx=0;gx<3;gx++){if(gx===1&&gy===1)continue;let a=0;
    for(let j=0;j<16;j++){const X=(gx+(j%4+.5)/4)/3*W,Y=(gy+(Math.floor(j/4)+.5)/4)/3*H;a+=fbmJ(X/(M*.5)+seed,Y/(M*.5)+seed)}
    if(a<lo){lo=a;firstAt=where((gx+.5)/3,(gy+.5)/3).replace('middle ','')}}
  const desc=`Holds still for ${env[0].toFixed(1)} s. ${v>.15?`The ${firstAt} starts to move first; `:''}the longest trails form near the ${where(strong[0],strong[1]).replace('middle ','')}, peak at ${env[1].toFixed(1)} s, ${spread>.6?'return unevenly':'return together'} and settle by ${Math.min(D,env[3]+spread/2).toFixed(1)} s.`;
  return{env,spread,strong,seed,dir:[Math.cos(ang),Math.sin(ang)],wob,band,desc}}

// ---------- drawing a frame
let plan=null, planKey='', dirty=true, frameNo=0;
function getPlan(){const k=JSON.stringify([P,S,W,H,!!mask]);if(k!==planKey){planKey=k;plan=MODE==='pulse'?pulsePlan():flowPlan();$('persona').textContent=plan.desc;$('seedLabel').textContent='Personality #'+P.seed}return plan}
function render(t){if(!R||!framed)return;const pl=getPlan(),M=minDim();
  const u={uCan:[gl$.width,gl$.height],uRes:[W,H],uMin:M,uGrain:S.grain/100,uFrame:frameNo++,uGrade:GRADES[S.grade]||0};
  if(MODE==='pulse'){const s=pl.at(t);Object.assign(u,{uSrc:[P.pt.x*W,P.pt.y*H],uProt:P.still/100*M*.5,uReach:pl.reach,uKind:pl.kind,uN:s.n,'uE[0]':s.E,'uF[0]':s.F})}
  else{const g=anchorGeom();Object.assign(u,{uC:g.c,uAx:g.ax,uDir:pl.dir,uStrong:[pl.strong[0]*W,pl.strong[1]*H],uHasMask:mask?1:0,uAmt:P.strength/100*.5*M,uT:t,uSpread:pl.spread,
    uSeed:pl.seed,uHalo:P.halo/100*1.5,uSoft:P.soften/100*(P.style==='last'?1:.5),uWob:pl.wob,uBand:pl.band,uKind:{anchor:0,last:1,resist:2}[P.style]||0,uEnv:pl.env})}
  R.draw(u)}

// ---------- preview loop and transport
let playing=true, tNow=0, last=performance.now(), recording=false, guideUntil=0, scrubbing=false;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.1,(now-last)/1000);last=now;if(!framed||recording)return;
  if(playing&&!scrubbing){tNow=(tNow+dt)%S.dur;dirty=true}
  if(dirty){render(tNow);dirty=false;$('scrub').value=Math.round(tNow/S.dur*1000);$('time').textContent=`${tNow.toFixed(1)} / ${S.dur} s`}
  drawGuides(now)}
requestAnimationFrame(loop);
function setPlaying(v){playing=v;$('play').setAttribute('aria-label',v?'Pause':'Play');$('playIcon').innerHTML=v?'<path d="M7 4.5v11M13 4.5v11"/>':'<path d="M6.5 4l9 6-9 6z"/>'}
$('play').onclick=()=>setPlaying(!playing);
$('scrub').oninput=()=>{scrubbing=true;setPlaying(false);tNow=$('scrub').value/1000*S.dur;dirty=true};
$('scrub').onchange=()=>{scrubbing=false};
addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();setPlaying(!playing)}});

// ---------- guides: where the source / anchor is, shown while you place it
const ov=$('ov'),ox=ov.getContext('2d');
function fit(){if(!framed)return;const v=$('view'),pad=matchMedia('(max-width:599px)').matches?12:40,s=Math.min((v.clientWidth-pad)/W,(v.clientHeight-pad)/H),cw=Math.max(40,W*s),ch=Math.max(40,H*s);
  if(!recording){const k=Math.min(1,Math.max(cw,ch)*Math.min(2,devicePixelRatio||1)/Math.max(W,H)),w=Math.round(W*k),h=Math.round(H*k);if(gl$.width!==w||gl$.height!==h){gl$.width=w;gl$.height=h;dirty=true}}
  for(const c of [gl$,ov]){c.style.width=cw+'px';c.style.height=ch+'px'}const dpr=devicePixelRatio||1;ov.width=Math.round(cw*dpr);ov.height=Math.round(ch*dpr);guideUntil=Math.max(guideUntil,performance.now()+10)}
addEventListener('resize',fit);
let guideShown=false;
function drawGuides(now){const show=!recording&&(now<guideUntil||!playing);if(!show&&!guideShown)return;guideShown=show;
  ox.clearRect(0,0,ov.width,ov.height);if(!show)return;const k=ov.width/W;ox.save();ox.scale(k,k);ox.lineWidth=2/k;
  ox.strokeStyle='rgba(247,178,103,.95)';ox.fillStyle='rgba(247,178,103,.95)';ox.setLineDash([7/k,5/k]);
  const arrow=(x,y,a,len)=>{ox.save();ox.setLineDash([]);ox.translate(x,y);ox.rotate(a);ox.beginPath();ox.moveTo(0,0);ox.lineTo(len,0);ox.stroke();ox.beginPath();ox.moveTo(len,0);ox.lineTo(len-12/k,-7/k);ox.lineTo(len-12/k,7/k);ox.fill();ox.restore()};
  if(MODE==='pulse'){const x=P.pt.x*W,y=P.pt.y*H,M=minDim();ox.beginPath();ox.arc(x,y,Math.max(6/k,P.still/100*M*.5),0,TAU);ox.stroke();
    ox.setLineDash([]);ox.beginPath();ox.arc(x,y,4/k,0,TAU);ox.fill();ox.globalAlpha=.35;ox.setLineDash([3/k,7/k]);ox.beginPath();ox.arc(x,y,P.reach/100*M,0,TAU);ox.stroke();ox.globalAlpha=1;
    if(P.style==='directional')arrow(x,y,P.dir*Math.PI/180,M*.18)}
  else{const g=anchorGeom();if(!mask){ox.beginPath();ox.ellipse(g.c[0],g.c[1],g.ax[0],g.ax[1],0,0,TAU);ox.stroke()}
    else{ox.setLineDash([]);ox.beginPath();ox.arc(g.c[0],g.c[1],4/k,0,TAU);ox.fill()}
    const a=P.dir*Math.PI/180,M=minDim();arrow(M*.09+Math.max(0,-Math.cos(a))*M*.16,M*.09+Math.max(0,-Math.sin(a))*M*.16,a,M*.14)}
  ox.restore()}
let drag=false;
function placeAt(e){const r=gl$.getBoundingClientRect();P.pt={x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};
  if(mask){mask=null;R.setMask(null);syncAnchorUI()}dirty=true;guideUntil=performance.now()+1500}
gl$.addEventListener('pointerdown',e=>{if(recording)return;drag=true;gl$.setPointerCapture(e.pointerId);placeAt(e)});
gl$.addEventListener('pointermove',e=>{if(drag)placeAt(e)});
['pointerup','pointercancel'].forEach(t=>gl$.addEventListener(t,()=>{if(drag){drag=false;persist()}}));

// ---------- controls: data-key ranges and segments bind to P, or to S with data-store="S"
const FMT={pct:v=>v+'%',deg:v=>v+'°',settle:v=>v<30?'Quickly':v<70?'Gently':'Slowly',shape:v=>v<-15?'Tall':v>15?'Wide':'Round'};
const store=el=>el.dataset.store==='S'?S:P;
function syncOut(el){const o=el.parentNode.querySelector('output');if(o)o.textContent=(FMT[el.dataset.fmt]||(v=>v))(+el.value);el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%')}
function syncUI(){
  document.querySelectorAll('input[type=range][data-key]').forEach(el=>{el.value=store(el)[el.dataset.key];syncOut(el)});
  document.querySelectorAll('[data-key]:not(input)').forEach(g=>g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(store(g)[g.dataset.key])===b.dataset.v)));
  document.querySelectorAll('[data-show]').forEach(el=>el.hidden=!el.dataset.show.split(' ').includes(P.style));
  $('styleHint').textContent=STYLES[MODE][P.style]||'';syncAnchorUI()}
function changed(framing){if(framing)buildFramed();dirty=true;guideUntil=performance.now()+1200;persist()}
document.querySelectorAll('input[type=range][data-key]').forEach(el=>el.addEventListener('input',()=>{store(el)[el.dataset.key]=+el.value;syncOut(el);changed(['zoom','fx','fy'].includes(el.dataset.key))}));
document.querySelectorAll('[data-key]:not(input)').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=g.dataset.key,st=store(g);st[k]='num' in g.dataset?+b.dataset.v:b.dataset.v;
  if(k==='dur')tNow=Math.min(tNow,S.dur-.01);syncUI();changed(k==='aspect')}));
$('reroll').onclick=()=>{P.seed=1+Math.floor(Math.random()*9999);tNow=0;setPlaying(true);changed();status('A new personality. The timing, echoes and unevenness have changed; the idea stays the same.')};

// ---------- Flow: find the exact outline of the detail with an on-device AI model
const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const SEG_MODEL='https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
let segP=null,segBusy=false;
function getSegmenter(){if(!segP)segP=(async()=>{const v=await import(MP+'/vision_bundle.mjs'),fs=await v.FilesetResolver.forVisionTasks(MP+'/wasm');
    return v.InteractiveSegmenter.createFromOptions(fs,{baseOptions:{modelAssetPath:SEG_MODEL,delegate:'CPU'},outputCategoryMask:false,outputConfidenceMasks:true})})().catch(e=>{segP=null;throw e});return segP}
function syncAnchorUI(){if(MODE!=='flow')return;$('clearSubj').hidden=!mask;$('findSubj').textContent=mask?'Find it again':'Find its outline (AI)';
  document.querySelectorAll('#size,#shape').forEach(el=>{el.disabled=!!mask;el.closest('.sl').style.opacity=mask?.45:1})}
if(MODE==='flow'){
  $('findSubj').onclick=async()=>{if(!framed||segBusy)return;segBusy=true;status('Loading the outline finder (about 15 MB, first time only)…');
    try{const seg=await getSegmenter();status('Finding the outline…');await tick();let best=null;
      seg.segment(framed,{keypoint:{x:P.pt.x,y:P.pt.y}},res=>{for(const m of res.confidenceMasks||[]){const f=m.getAsFloat32Array(),mw=m.width,mh=m.height,
        at=f[Math.min(mh-1,Math.floor(P.pt.y*mh))*mw+Math.min(mw-1,Math.floor(P.pt.x*mw))];if(!best||at>best.at)best={at,w:mw,h:mh,f:Float32Array.from(f)}}});
      if(!best||best.at<.4){status('Couldn’t find an outline there. Tap the middle of the detail and try again, or keep the oval.');segBusy=false;return}
      const d=new Uint8Array(best.f.length);let n=0,sx=0,sy=0,sxx=0,syy=0;
      for(let i=0;i<d.length;i++){const v=sm((best.f[i]-.25)/.35);d[i]=Math.round(v*255);if(v>.5){const x=(i%best.w)/best.w,y=Math.floor(i/best.w)/best.h;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y}}
      if(n<d.length*.0008){status('That outline was too small to use. Try tapping the middle of it.');segBusy=false;return}
      const cx=sx/n,cy=sy/n;mask={w:best.w,h:best.h,data:d,key:frameKey(),fit:{cx,cy,ax:Math.max(.01,2*Math.sqrt(Math.max(0,sxx/n-cx*cx))),ay:Math.max(.01,2*Math.sqrt(Math.max(0,syy/n-cy*cy)))}};
      R.setMask(mask);syncAnchorUI();dirty=true;persist();status('Outline found. It stays perfectly still; the flow parts around it.')}
    catch(e){status('Couldn’t run the outline finder: '+(e.message||e)+'. It needs an internet connection the first time.')}
    segBusy=false};
  $('clearSubj').onclick=()=>{mask=null;R.setMask(null);syncAnchorUI();dirty=true;persist()}}

// ---------- photos
async function setPhoto(f,nm,quiet){try{const r=await readPhoto(f);img=r.img;blob=r.blob;name=nm||f.name||'photo';show();buildFramed();persist();
  if(!quiet)status(MODE==='pulse'?'Tap the thing whose presence moves the space.':'Tap the one detail the photograph refuses to lose.');guideUntil=performance.now()+2500}
  catch(e){status('Couldn’t open that photo: '+(e.message||e))}}
function show(){$('empty').hidden=true;$('view').hidden=false;$('transport').hidden=false;['makeTop','make','stillBtn','toOther'].forEach(k=>$(k).disabled=false);
  if(!R){try{R=makeRenderer(gl$)}catch(e){R=null;console.error(e)}if(!R){status('This browser can’t run WebGL, which this tool needs. Try another browser.');return}}
  requestAnimationFrame(fit)}
const pick=()=>$('file').click();$('pick').onclick=pick;$('pick2').onclick=pick;
$('file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f){mask=null;Object.assign(P,{zoom:100,fx:50,fy:50});syncUI();setPhoto(f)}};
addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/')||isHeic(f));if(!f)return;e.preventDefault();mask=null;setPhoto(f)});
addEventListener('paste',e=>{const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(it){mask=null;setPhoto(it.getAsFile(),'pasted photo')}});

// a sample drawn on the fly: a night street with one lit window, a doorway and a parked motorbike
function sampleBlob(){const w=1400,h=1750,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');let s=11;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0d1626');g.addColorStop(.62,'#1b2433');g.addColorStop(.63,'#232830');g.addColorStop(1,'#111419');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.fillStyle='#2a3141';x.fillRect(80,120,1240,980);for(let i=0;i<9000;i++){x.fillStyle=rnd()<.5?'rgba(255,255,255,.035)':'rgba(0,0,0,.08)';x.fillRect(80+rnd()*1240,120+rnd()*980,3,3)}
  for(let r=0;r<3;r++)for(let k=0;k<4;k++){const X=170+k*290,Y=200+r*270,lit=r===1&&k===2;
    x.fillStyle=lit?'#f2b45e':'#121a28';x.fillRect(X,Y,170,190);
    if(lit){const gl=x.createRadialGradient(X+85,Y+95,10,X+85,Y+95,260);gl.addColorStop(0,'rgba(247,178,103,.35)');gl.addColorStop(1,'rgba(247,178,103,0)');x.fillStyle=gl;x.fillRect(X-200,Y-200,570,590);
      x.fillStyle='#c9803a';x.fillRect(X+10,Y+120,150,60);x.fillStyle='#ffe2ad';x.fillRect(X+100,Y+30,40,60)}
    x.strokeStyle='#3a4357';x.lineWidth=8;x.strokeRect(X,Y,170,190);x.beginPath();x.moveTo(X+85,Y);x.lineTo(X+85,Y+190);x.stroke()}
  x.fillStyle='#0b0f17';x.fillRect(560,880,220,220);x.fillStyle='#4a3a2c';x.fillRect(575,895,190,205);
  x.fillStyle='#1c212b';x.fillRect(0,1100,w,60);
  x.strokeStyle='rgba(230,220,190,.55)';x.lineWidth=14;x.setLineDash([120,90]);x.beginPath();x.moveTo(0,1480);x.lineTo(w,1480);x.stroke();x.setLineDash([]);
  for(let i=0;i<14000;i++){x.fillStyle=rnd()<.5?'rgba(255,255,255,.04)':'rgba(0,0,0,.12)';x.fillRect(rnd()*w,1160+rnd()*590,3,3)}
  x.fillStyle='#3b4150';x.fillRect(1190,520,16,640);const lg=x.createRadialGradient(1198,520,5,1198,520,320);lg.addColorStop(0,'rgba(255,236,200,.75)');lg.addColorStop(1,'rgba(255,236,200,0)');x.fillStyle=lg;x.fillRect(880,200,640,640);
  const pool=x.createRadialGradient(1100,1260,10,1100,1260,380);pool.addColorStop(0,'rgba(255,230,190,.22)');pool.addColorStop(1,'rgba(255,230,190,0)');x.fillStyle=pool;x.fillRect(700,1100,800,450);
  x.fillStyle='#07090d';x.strokeStyle='#07090d';x.lineWidth=16;x.beginPath();x.arc(960,1300,62,0,TAU);x.stroke();x.beginPath();x.arc(1210,1300,62,0,TAU);x.stroke();
  x.beginPath();x.moveTo(960,1300);x.lineTo(1040,1210);x.lineTo(1160,1210);x.lineTo(1210,1300);x.stroke();x.beginPath();x.ellipse(1070,1195,90,26,0,0,TAU);x.fill();
  x.beginPath();x.moveTo(1150,1210);x.lineTo(1180,1130);x.lineTo(1215,1125);x.stroke();x.fillStyle='#c33a2c';x.beginPath();x.ellipse(1110,1225,60,28,0,0,TAU);x.fill();
  return new Promise(r=>c.toBlob(r,'image/jpeg',.9))}
async function loadSample(){const b=await sampleBlob();mask=null;Object.assign(P,{zoom:100,fx:50,fy:50,...(MODE==='pulse'?{pt:{x:.596,y:.323},still:16}:{pt:{x:.775,y:.71},size:14,shape:30})});syncUI();
  await setPhoto(new File([b],'sample.jpg',{type:'image/jpeg'}),'Sample: night street',true);
  status(MODE==='pulse'?'The lit window is the source. Tap anywhere else to move it.':'The motorbike stays still. Tap anything else to keep that instead.')}
$('sample').onclick=loadSample;$('sample2').onclick=loadSample;

// ---------- saving: state on this device, shared series settings, and handing the photo to the other tool
let saveT=0;function persist(){clearTimeout(saveT);saveT=setTimeout(()=>{idb.set(MODE,{v:1,blob,name,P,mask}).catch(()=>{});idb.set('living-series',S).catch(()=>{})},400)}
$('toOther').onclick=async()=>{if(!blob)return;try{
  const pt=MODE==='pulse'?{...P.pt}:(mask&&mask.fit?{x:mask.fit.cx,y:mask.fit.cy}:{...P.pt});
  await idb.set(OTHER,{v:1,blob,name,P:{pt,zoom:P.zoom,fx:P.fx,fy:P.fy,seed:P.seed},mask:null,handoff:true});await idb.set('living-series',S);location.href=OTHER+'.html'}
  catch(e){status('Couldn’t hand the photo over: '+(e.message||e))}};

// ---------- export: a still frame, or one seamless loop recorded in real time
$('stillBtn').onclick=()=>{if(!framed)return;const keep=[gl$.width,gl$.height];gl$.width=W;gl$.height=H;render(tNow);
  gl$.toBlob(b=>{gl$.width=keep[0];gl$.height=keep[1];dirty=true;saveFiles([{blob:b,name:`${MODE}-${stamp()}.jpg`}])},'image/jpeg',.95)};
function pickMime(){if(typeof MediaRecorder==='undefined')return null;for(const m of['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'])if(MediaRecorder.isTypeSupported(m))return m;return''}
let vidFile=null, stopRec=false;
async function makeVideo(){if(!framed||recording)return;const mime=pickMime();if(mime===null||!gl$.captureStream){status('This browser can’t record video. Try Safari or Chrome.');return}
  recording=true;stopRec=false;$('recbar').hidden=false;['make','makeTop'].forEach(k=>$(k).disabled=true);ox.clearRect(0,0,ov.width,ov.height);
  const keep=[gl$.width,gl$.height];gl$.width=W;gl$.height=H;frameNo=0;render(0);
  try{const stream=gl$.captureStream(30),rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:14e6}:{videoBitsPerSecond:14e6}),chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};const done=new Promise(r=>rec.onstop=r);rec.start(250);
    const D=S.dur,t0=performance.now();let shown=-1;
    await new Promise(res=>{const step=()=>{const t=(performance.now()-t0)/1000;if(t>=D||stopRec){res();return}render(t);
      const left=Math.ceil(D-t);if(left!==shown){shown=left;$('recbar').textContent=`Recording · ${left} s`}requestAnimationFrame(step)};requestAnimationFrame(step)});
    render(D-.001);await new Promise(r=>setTimeout(r,80));rec.stop();await done;stream.getTracks().forEach(t=>t.stop());
    const type=rec.mimeType||mime||'video/webm',ext=type.includes('mp4')?'mp4':'webm',b=new Blob(chunks,{type:type.split(';')[0]});
    vidFile={blob:b,name:`${MODE}-${P.style}-${stamp()}.${ext}`};const v=$('vid');if(v.src.startsWith('blob:'))URL.revokeObjectURL(v.src);v.src=URL.createObjectURL(b);$('vidBox').hidden=false;v.play().catch(()=>{});
    status(`Video ready: ${ext.toUpperCase()}, ${(b.size/1e6).toFixed(1)} MB, one ${D} s loop.`+(ext==='webm'?' This browser only records WebM; Instagram wants MP4, so convert it or record in Safari.':''));
    if(matchMedia('(max-width:899px) and (orientation:portrait),(max-width:599px)').matches)$('vidBox').scrollIntoView({behavior:'smooth',block:'center'})}
  catch(e){status('Couldn’t make the video: '+(e.message||e))}
  gl$.width=keep[0];gl$.height=keep[1];recording=false;$('recbar').hidden=true;['make','makeTop'].forEach(k=>$(k).disabled=false);dirty=true;fit()}
$('make').onclick=makeVideo;$('makeTop').onclick=makeVideo;
$('saveVid').onclick=()=>{if(vidFile)saveFiles([vidFile])};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recording){stopRec=true;status('Recording stopped because the screen was hidden. Keep this screen open while it records.')}});

// ---------- start: shared series settings, then the last photo (or one handed over from the other tool)
syncUI();
(async()=>{try{const ss=await idb.get('living-series');if(ss)Object.assign(S,ss);
  const s=await idb.get(MODE);if(s&&s.blob){Object.assign(P,s.P||{});if(s.mask&&!s.handoff)mask=s.mask;syncUI();await setPhoto(s.blob,s.name,!s.handoff);
    if(s.handoff){status(MODE==='flow'?'The same photo, now with Flow. The source of the pulse is what stays still.':'The same photo, now with Pulse. What stayed still is the source of the pulse.');persist()}}
  syncUI()}catch(e){}})();
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
