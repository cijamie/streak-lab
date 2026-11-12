// Streak Lab image pipeline. Pure functions on RGBA pixel arrays, shared by the page (index.html) and the
// preview worker (worker.js). Nothing here touches the DOM.
//
// Pipeline, in order:
//   1. global adjustments and tone curve, then local adjustments through masks
//   2. streak layers (linear, radial, swirl, edge, path), each optionally limited to a mask
//   3. warps: slit-scan, zoom/spin blur, datamosh
//   4. protect (keeps the subject sharp), edge overlap, echo trails, bloom on streaks
//   5. duotone grade and grain (optionally only inside a mask)
//   6. halation, light leak, lens flare
//   7. risograph, dither, contours
//   8. vignette (relative to the crop) and sharpening
(function(root){
'use strict';
const TAU=Math.PI*2;
const lum=(d,i)=>(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;
const rnd=(i,s)=>{const x=Math.sin((i+s*1013.7)*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sstep=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function maxR(cx,cy,w,h){return Math.ceil(Math.max(Math.hypot(cx,cy),Math.hypot(w-cx,cy),Math.hypot(cx,h-cy),Math.hypot(w-cx,h-cy)))}
function dirVectors(tx,ty,p){const v=p.side;
  if(v==='up')return[[0,-1]]; if(v==='down')return[[0,1]]; if(v==='left')return[[-1,0]]; if(v==='right')return[[1,0]];
  if(v==='angle'){const a=p.angle*Math.PI/180;return[[Math.sin(a),-Math.cos(a)]]}
  const s=v==='a'?[1]:v==='b'?[-1]:[1,-1]; return s.map(g=>[ty*g,-tx*g])}

// ---------- streaks
function streakCols(d,w,r0,p,bs,touched,dist){
  const thr=p.thr/100, jit=p.jit/100, bw=Math.max(1,Math.round(p.band*bs)), lf=p.len/100;
  if(p.method==='sort'){sortCols(d,w,r0,thr,lf,bw,jit,p.seed,touched,dist,p.skey||'lum',(p.upper??100)/100);return}
  for(let bx=0;bx<w;bx+=bw){
    const be=Math.min(w,bx+bw); let L=0;
    for(let x=bx;x<be;x++)L+=lum(d,(r0*w+x)*4); L/=(be-bx);
    const t=Math.max(0,Math.min(1,(L-thr)/(1-thr+1e-6)));
    const len=Math.round(Math.sqrt(t)*lf*(1-jit+jit*rnd(bx/bw|0,p.seed))*r0); if(len<1)continue; const fs=len*.8;
    for(let x=bx;x<be;x++){
      const s=(r0*w+x)*4, R=d[s], G=d[s+1], B=d[s+2];
      for(let k=1;k<=len&&r0-k>=0;k++){
        const q=(r0-k)*w+x, i=q*4, f=k<fs?1:(len-k)/(len-fs+1e-6);
        d[i]+=(R-d[i])*f; d[i+1]+=(G-d[i+1])*f; d[i+2]+=(B-d[i+2])*f;
        if(touched)touched[q]=1; if(dist)dist[q]=k;
      }
    }
  }
}
function hueSat(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=mx-mn;let h=0;
  if(c){h=mx===r?((g-b)/c+6)%6:mx===g?(b-r)/c+2:(r-g)/c+4}return[h/6,mx?c/mx:0]}
function sortCols(d,w,r0,thr,lf,bw,jit,sd,touched,dist,key,upper){
  const buf=[], inRange=l=>l>=thr&&l<=upper;
  const k=key==='hue'?i=>hueSat(d[i],d[i+1],d[i+2])[0]:key==='sat'?i=>hueSat(d[i],d[i+1],d[i+2])[1]:i=>lum(d,i);
  for(let x=0;x<w;x++){
    const lim=Math.max(0,Math.round(r0-lf*r0*(1-jit+jit*rnd(x/bw|0,sd))));
    let y=r0;
    while(y>=lim){
      while(y>=lim&&!inRange(lum(d,(y*w+x)*4)))y--;
      const end=y; buf.length=0;
      while(y>=lim&&inRange(lum(d,(y*w+x)*4))){const i=(y*w+x)*4;buf.push([d[i],d[i+1],d[i+2],k(i)]);y--}
      if(buf.length>1){buf.sort((a,b)=>b[3]-a[3]);
        for(let j=0;j<buf.length;j++){const q=(end-j)*w+x,i=q*4;d[i]=buf[j][0];d[i+1]=buf[j][1];d[i+2]=buf[j][2];if(touched)touched[q]=1;if(dist)dist[q]=r0-(end-j)}}
    }
  }
}
// reorient an RGBA (or single-channel) array: T = transpose, V = flip vertically
function reorient(d,w,h,ops,ch){
  let a=d,W=w,H=h;
  for(const op of ops){const o=new a.constructor(a.length);
    if(op==='T'){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const s=(y*W+x)*ch,t=(x*H+y)*ch;for(let k=0;k<ch;k++)o[t+k]=a[s+k]}const t=W;W=H;H=t}
    else{for(let y=0;y<H;y++)o.set(a.subarray((H-1-y)*W*ch,(H-y)*W*ch),y*W*ch)}
    a=o}
  return{d:a,w:W,h:H}}
function linear(c,out,p,dist){
  const dir=p.vdir||'up', s=p.startV/100;
  if(dir==='up'){streakCols(out,c.w,Math.min(c.h-1,Math.round(s*(c.h-1))),p,c.bs,null,dist);return}
  const ops=dir==='down'?['V']:dir==='left'?['T']:['T','V'], inv=ops.slice().reverse();
  const R=reorient(out,c.w,c.h,ops,4), D=dist?reorient(dist,c.w,c.h,ops,1):null;
  const along=dir==='down'?c.h:c.w, r0=Math.round((dir==='left'?s:1-s)*(along-1));
  streakCols(R.d,R.w,Math.min(R.h-1,r0),p,c.bs,null,D&&D.d);
  out.set(reorient(R.d,R.w,R.h,inv,4).d); if(dist)dist.set(reorient(D.d,R.w,R.h,inv,1).d);
}
function radial(c,out,p,dist){
  const {src,w,h}=c, cx=p.cx*w, cy=p.cy*h, R=maxR(cx,cy,w,h), A=Math.min(12000,Math.ceil(TAU*R));
  const cs=new Float64Array(A), sn=new Float64Array(A);
  for(let a=0;a<A;a++){cs[a]=Math.cos(a/A*TAU);sn[a]=Math.sin(a/A*TAU)}
  const pd=new Uint8ClampedArray(A*R*4);
  for(let j=0;j<R;j++){const r=R-1-j;
    for(let a=0;a<A;a++){const x=Math.round(cx+r*cs[a]), y=Math.round(cy+r*sn[a]);
      if(x>=0&&x<w&&y>=0&&y<h){const i=(y*w+x)*4,o=(j*A+a)*4;pd[o]=src[i];pd[o+1]=src[i+1];pd[o+2]=src[i+2]}}}
  const touched=new Uint8Array(A*R), pdist=dist?new Float32Array(A*R):null;
  streakCols(pd,A,R-1-Math.round(p.startR/100*(R-1)),p,c.bs,touched,pdist);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=x-cx, dy=y-cy, r=Math.round(Math.hypot(dx,dy)), j=R-1-r; if(j<0)continue;
    let th=Math.atan2(dy,dx); if(th<0)th+=TAU;
    const a=Math.round(th/TAU*A)%A, q=j*A+a; if(!touched[q])continue;
    const o=q*4, i=(y*w+x)*4; out[i]=pd[o]; out[i+1]=pd[o+1]; out[i+2]=pd[o+2];
    if(dist)dist[y*w+x]=pdist[q];
  }
}
// swirl: bright areas trail around a centre point, like star trails. Each ring keeps a running colour that
// bright pixels feed strongly and slowly lets go as it travels round.
function swirl(c,out,p,dist){
  const {src,w,h}=c, cx=p.cx*w, cy=p.cy*h, R=maxR(cx,cy,w,h), thr=p.thr/100, jit=p.jit/100, lf=p.len/100, sg=p.spin==='ccw'?-1:1, bw=Math.max(1,Math.round(p.band*c.bs)), AMAX=8192;
  const ringA=r=>Math.min(AMAX,Math.max(1,Math.ceil(TAU*r))), off=new Uint32Array(R+2);let tot=0;for(let r=0;r<=R;r++){off[r]=tot;tot+=ringA(r)}
  const ring=new Uint8ClampedArray(tot*3), k2=(1-thr)*(1-thr)+1e-6;
  for(let r=1;r<=R;r++){const A=ringA(r),L=Math.max(2,lf*A*.6*(1-jit+jit*rnd((r/bw)|0,p.seed))),d=Math.exp(-1/L),dc=Math.cos(sg*TAU/A),ds=Math.sin(sg*TAU/A);
    let co=1,si=0,S0=0,S1=0,S2=0,Wt=0;
    for(let k=0;k<2*A;k++){const x=Math.round(cx+r*co),y=Math.round(cy+r*si);
      if(x>=0&&x<w&&y>=0&&y<h){const i=(y*w+x)*4,l=lum(src,i),e=Math.max(0,l-thr),wk=1+12*e*e/k2;S0=S0*d+src[i]*wk;S1=S1*d+src[i+1]*wk;S2=S2*d+src[i+2]*wk;Wt=Wt*d+wk}
      else{S0*=d;S1*=d;S2*=d;Wt*=d}
      if(k>=A&&Wt>0){const o=(off[r]+(k-A))*3;ring[o]=S0/Wt;ring[o+1]=S1/Wt;ring[o+2]=S2/Wt}
      const nc=co*dc-si*ds;si=co*ds+si*dc;co=nc}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-cx,dy=y-cy,r=Math.round(Math.hypot(dx,dy));if(r<1||r>R)continue;
    const A=ringA(r);let u=sg*Math.atan2(dy,dx)/TAU;u-=Math.floor(u);const a=Math.round(u*A)%A,o=(off[r]+a)*3,i=(y*w+x)*4;
    out[i]=ring[o];out[i+1]=ring[o+1];out[i+2]=ring[o+2];if(dist)dist[y*w+x]=r}
}
function resample(e,w,h,step){const xs=[],ys=[];
  for(let i=1;i<e.length;i++){const ax=e[i-1].x*w,ay=e[i-1].y*h,bx=e[i].x*w,by=e[i].y*h,l=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.ceil(l/step));
    for(let k=0;k<n;k++){xs.push(ax+(bx-ax)*k/n);ys.push(ay+(by-ay)*k/n)}}
  if(e.length){xs.push(e[e.length-1].x*w);ys.push(e[e.length-1].y*h)}
  return[xs,ys]}
function tangents(xs,ys,win){const N=xs.length,tx=new Float64Array(N),ty=new Float64Array(N);
  for(let k=0;k<N;k++){const a=Math.max(0,k-win),b=Math.min(N-1,k+win);const dx=xs[b]-xs[a],dy=ys[b]-ys[a],l=Math.hypot(dx,dy)||1;tx[k]=dx/l;ty[k]=dy/l}
  return[tx,ty]}
function edgeStreaks(c,out,p,dist,over){
  const {src,w,h}=c, thr=p.thr/100, jit=p.jit/100, bw=Math.max(1,Math.round(p.band*c.bs)), maxLen=p.len/100*.75*Math.hypot(w,h);
  const perp=['a','b','both'].includes(p.side), step=.5, win=Math.max(3,Math.round(8*c.bs)), fe=p.soft>0?p.soft/100*.02*Math.hypot(w,h):0;
  (p.edges||[]).forEach((e,ei)=>{
    const [xs,ys]=resample(e,w,h,step);
    const N=xs.length; if(N<3)return;
    const tx=new Float64Array(N),ty=new Float64Array(N),ang=new Float64Array(N);
    for(let k=0;k<N;k++){const a=Math.max(0,k-win),b=Math.min(N-1,k+win);let dx=xs[b]-xs[a],dy=ys[b]-ys[a],l=Math.hypot(dx,dy)||1;tx[k]=dx/l;ty[k]=dy/l;ang[k]=Math.atan2(ty[k],tx[k])}
    const per=Math.max(1,Math.round(bw/step)), bands=Math.ceil(N/per), blen=new Float64Array(bands);
    for(let b=0;b<bands;b++){let L=0,n=0;
      for(let k=b*per;k<Math.min(N,(b+1)*per);k++){const x=Math.round(xs[k]),y=Math.round(ys[k]);if(x>=0&&x<w&&y>=0&&y<h){L+=lum(src,(y*w+x)*4);n++}}
      if(!n)continue; L/=n;
      const t=Math.max(0,Math.min(1,(L-thr)/(1-thr+1e-6)));
      blen[b]=Math.sqrt(t)*maxLen*(1-jit+jit*rnd(b+ei*7919,p.seed))}
    for(let k=0;k<N;k++){
      const len=blen[(k/per)|0]; if(len<1)continue;
      const sx=Math.round(xs[k]),sy=Math.round(ys[k]); if(sx<0||sx>=w||sy<0||sy>=h)continue;
      const s=(sy*w+sx)*4, R=src[s],G=src[s+1],B=src[s+2], fs=len*.8;
      let dth=perp&&k<N-1?Math.abs(ang[k+1]-ang[k]):0; if(dth>Math.PI)dth=TAU-dth;
      for(const [nx,ny] of dirVectors(tx[k],ty[k],p)){
        if(over&&fe>0)for(let d=-fe;d<1;d+=.6){ // overlap: reach back over the edge, fading in towards the line
          const t=(d+fe)/(fe+1), a=t*t*(3-2*t), x=Math.round(xs[k]+nx*d), y=Math.round(ys[k]+ny*d);
          if(x<0||x>=w||y<0||y>=h)continue; const q=y*w+x;
          if(a>over.a[q]){over.a[q]=a;over.c[q*3]=R;over.c[q*3+1]=G;over.c[q*3+2]=B}}
        for(let d=1;d<=len;d+=.7){
          const f=d<fs?1:(len-d)/(len-fs+1e-6), wide=Math.min(6,Math.ceil(step+d*dth));
          for(let j=0;j<wide;j++){
            const x=Math.round(xs[k]+nx*d+tx[k]*j*.9), y=Math.round(ys[k]+ny*d+ty[k]*j*.9);
            if(x<0||x>=w||y<0||y>=h)continue;
            const q=y*w+x, i=q*4; out[i]+=(R-out[i])*f; out[i+1]+=(G-out[i+1])*f; out[i+2]+=(B-out[i+2])*f;
            if(dist&&d<dist[q])dist[q]=d;
          }
        }
      }
    }
  });
}
// path: a ribbon that smears colour along a curve you draw, like light trails bending with it.
// Each line across the ribbon keeps a running colour that bright pixels feed strongly and slowly lets go.
function pathStreaks(c,out,p,dist){
  const {src,w,h}=c, thr=p.thr/100, jit=p.jit/100, bw=Math.max(1,Math.round(p.band*c.bs)), lf=p.len/100, hw=Math.max(2,(p.pw??25)/100*.08*Math.hypot(w,h));
  (p.edges||[]).forEach((e,ei)=>{
    const [xs,ys]=resample(e,w,h,.5), N=xs.length; if(N<4)return;
    const [tx,ty]=tangents(xs,ys,Math.max(4,Math.round(10*c.bs)));
    for(let o=-hw;o<=hw;o+=.5){
      const b=Math.floor((o+hw)/bw), L=Math.max(4,lf*N*.5*(1-jit+jit*rnd(b+ei*7919,p.seed))), d=Math.exp(-1/L), edgeA=sstep((hw-Math.abs(o))/(hw*.35+1));
      let S0=0,S1=0,S2=0,Wt=0;
      for(let k=0;k<N;k++){const x=Math.round(xs[k]-ty[k]*o),y=Math.round(ys[k]+tx[k]*o);if(x<0||x>=w||y<0||y>=h){S0*=d;S1*=d;S2*=d;Wt*=d;continue}
        const q=y*w+x,i=q*4,l=lum(src,i),wk=1+12*Math.max(0,l-thr)*Math.max(0,l-thr)/((1-thr)*(1-thr)+1e-6);
        S0=S0*d+src[i]*wk;S1=S1*d+src[i+1]*wk;S2=S2*d+src[i+2]*wk;Wt=Wt*d+wk;
        if(k<2)continue;const a=edgeA*Math.min(1,k/12);
        out[i]+=(S0/Wt-out[i])*a;out[i+1]+=(S1/Wt-out[i+1])*a;out[i+2]+=(S2/Wt-out[i+2])*a;
        if(dist){const dd=k*.5;if(dd<dist[q])dist[q]=dd}}
    }
  });
}
function streakLayer(c,out,p,dist,over){
  if(p.mode==='vertical')linear(c,out,p,dist);
  else if(p.mode==='radial')radial(c,out,p,dist);
  else if(p.mode==='swirl')swirl(c,out,p,dist);
  else if(p.mode==='path')pathStreaks(c,out,p,dist);
  else edgeStreaks(c,out,p,dist,over);
}
// the layers to render: the selected one comes from the flat settings, the rest from p.layers
function layerList(p){
  if(!p.layers||p.layers.length<2)return[{...p}];
  return p.layers.map((L,i)=>i===p.act?{...p}:{...p,...L});
}

// ---------- adjustments
const ADJ0={exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,sat:0};
const CURVE0=[0,25,50,75,100];
function adjActive(a,curve){if(curve&&curve.some((v,i)=>v!==CURVE0[i]))return true;if(!a)return false;for(const k in ADJ0)if(a[k])return true;return false}
// monotone cubic through 5 evenly spaced points (Fritsch–Carlson)
function curveFn(pts){const n=pts.length,x=pts.map((_,i)=>i/(n-1)),y=pts.map(v=>v/100),d=[],m=new Array(n);
  for(let i=0;i<n-1;i++)d.push((y[i+1]-y[i])/(x[i+1]-x[i]));
  m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){if(!d[i]){m[i]=m[i+1]=0;continue}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i]}}
  return t=>{t=clamp(t,0,1);const i=Math.min(n-2,Math.floor(t*(n-1))),hh=x[i+1]-x[i],u=(t-x[i])/hh,u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*y[i]+(u3-2*u2+u)*hh*m[i]+(-2*u3+3*u2)*y[i+1]+(u3-u2)*hh*m[i+1]}}
function toneLUT(a,curve){const lut=new Uint8ClampedArray(256),A={...ADJ0,...a},ev=Math.pow(2,A.exposure/50),k=A.contrast/100,
    bp=-A.blacks/100*.12,wp=1-A.whites/100*.12,sh=A.shadows/100,hi=A.highlights/100,cf=curve?curveFn(curve):null;
  for(let v=0;v<256;v++){let x=v/255*ev;
    x=(x-bp)/(wp-bp); x=clamp(x,0,1.5);
    x+=sh*1.2*x*(1-x)*(1-x); x+=hi*1.2*x*x*(1-Math.min(1,x));
    x=clamp(x,0,1);
    x=k>=0?x+k*(sstep(x)-x):x+k*(x-.5)*.7;
    if(cf)x=cf(x);
    lut[v]=Math.round(clamp(x,0,1)*255)}
  return lut}
function adjust(d,a,curve,alpha){
  const A={...ADJ0,...a},lut=toneLUT(A,curve),t=A.temp/100,m=A.tint/100,rm=1+.22*t,bm=1-.22*t,gm=1-.16*m,s=A.sat/100,vb=A.vibrance/100,
    wb=t||m, col=s||vb;
  for(let i=0,px=0;i<d.length;i+=4,px++){const al=alpha?alpha[px]:1;if(al<=0)continue;
    let r=d[i],g=d[i+1],b=d[i+2];
    if(wb){r*=rm;g*=gm;b*=bm;if(m){r*=1+.08*m;b*=1+.08*m}}
    r=lut[r>255?255:r|0];g=lut[g>255?255:g|0];b=lut[b>255?255:b|0];
    if(col){const L=r*.299+g*.587+b*.114,mx=Math.max(r,g,b),mn=Math.min(r,g,b),cur=mx?(mx-mn)/mx:0,f=1+s+vb*(1-cur);r=L+(r-L)*f;g=L+(g-L)*f;b=L+(b-L)*f}
    if(al<1){r=d[i]+(r-d[i])*al;g=d[i+1]+(g-d[i+1])*al;b=d[i+2]+(b-d[i+2])*al}
    d[i]=r;d[i+1]=g;d[i+2]=b}
}

// ---------- masks: shapes rasterised to 0..1 weights at any size
function boxBlur(a,w,h,r,passes){if(r<1)return a;
  const pass=(src,horiz)=>{const o=new Float32Array(src.length),n=horiz?w:h,lines=horiz?h:w,d=2*r+1;
    for(let l=0;l<lines;l++){const at=k=>horiz?l*w+k:k*w+l;let sum=0;
      for(let k=-r;k<=r;k++)sum+=src[at(Math.min(n-1,Math.max(0,k)))];
      for(let k=0;k<n;k++){o[at(k)]=sum/d;sum+=src[at(Math.min(n-1,k+r+1))]-src[at(Math.max(0,k-r))]}}
    return o};
  for(let k=0;k<(passes||2);k++){a=pass(a,true);a=pass(a,false)}return a}
function dot(m,w,h,t,px,py,rad){
  const x0=Math.max(0,px-rad|0),x1=Math.min(w-1,px+rad|0),y0=Math.max(0,py-rad|0),y1=Math.min(h-1,py+rad|0),r2=rad*rad,v=t==='paint'?1:0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if((x-px)**2+(y-py)**2<=r2)m[y*w+x]=v;
}
function applyRaster(m,w,h,R){if(!R)return;const {w:rw,h:rh,data}=R;
  for(let y=0;y<h;y++){const fy=Math.min(rh-1,Math.max(0,(y+.5)*rh/h-.5)),y0=fy|0,y1=Math.min(rh-1,y0+1),ty=fy-y0;
    for(let x=0;x<w;x++){const fx=Math.min(rw-1,Math.max(0,(x+.5)*rw/w-.5)),x0=fx|0,x1=Math.min(rw-1,x0+1),tx=fx-x0;
      const v=(data[y0*rw+x0]*(1-tx)+data[y0*rw+x1]*tx)*(1-ty)+(data[y1*rw+x0]*(1-tx)+data[y1*rw+x1]*tx)*ty;
      if(v>=100)m[y*w+x]=1}}}
// protect mask from strokes ({t:'paint'|'erase',x,y,r} or {t:'auto',id})
function maskAt(strokes,w,h,rasters){const m=new Uint8Array(w*h);
  for(const s of strokes||[]){if(s.t==='auto')applyRaster(m,w,h,rasters&&rasters[s.id]);else dot(m,w,h,s.t,s.x*w,s.y*h,s.r*w)}return m}
const maskCache=new Map();
function maskAlpha(M,w,h,rasters){
  const key=JSON.stringify(M)+'|'+w+'x'+h;const hit=maskCache.get(key);if(hit)return hit;
  const a=new Float32Array(w*h), diag=Math.hypot(w,h), fpx=Math.max(1,Math.round((M.feather??30)/100*.04*diag));
  if(M.type==='linear'){const ax=M.a.x*w,ay=M.a.y*h,bx=M.b.x*w,by=M.b.y*h,vx=bx-ax,vy=by-ay,l2=vx*vx+vy*vy||1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)a[y*w+x]=1-sstep(((x-ax)*vx+(y-ay)*vy)/l2)}
  else if(M.type==='radial'){const cx=M.c.x*w,cy=M.c.y*h,r=Math.max(2,M.r*Math.max(w,h)),inner=r*(1-clamp((M.feather??30)/100,0,.98));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=Math.hypot(x-cx,y-cy);a[y*w+x]=1-sstep((d-inner)/(r-inner+1e-6))}}
  else if(M.type==='sky'&&M.pts&&M.pts.length>1){const P=M.pts;let j=0;
    for(let x=0;x<w;x++){const u=x/(w-1);while(j<P.length-2&&P[j+1].x<u)j++;const p0=P[j],p1=P[j+1],t=clamp((u-p0.x)/((p1.x-p0.x)||1),0,1),yh=(p0.y+(p1.y-p0.y)*t)*h;
      for(let y=0;y<h;y++)a[y*w+x]=sstep((yh-y)/(fpx*2)+.5)}}
  else{ // brush or subject: hard shape, then feathered
    const m=new Uint8Array(w*h);
    if(M.type==='subject')applyRaster(m,w,h,rasters&&rasters[M.raster]);
    else for(const s of M.strokes||[])dot(m,w,h,s.t,s.x*w,s.y*h,s.r*w);
    let f=new Float32Array(w*h);for(let i=0;i<f.length;i++)f[i]=m[i];
    if((M.feather??30)>0){f=boxBlur(f,w,h,Math.max(1,Math.round(fpx/2)),2)}
    a.set(f)}
  if(M.invert)for(let i=0;i<a.length;i++)a[i]=1-a[i];
  if(maskCache.size>24)maskCache.clear(); maskCache.set(key,a); return a}
function findMask(p,id){return id&&p.masks?p.masks.find(m=>m.id===id):null}

// ---------- protect weight: smooths the boundary of the protected area
function softMask(m,w,h,r){
  let any=false;for(let i=0;i<m.length;i++)if(m[i]){any=true;break} if(!any)return null;
  let a=new Float32Array(m.length);for(let i=0;i<m.length;i++)a[i]=m[i];
  a=boxBlur(a,w,h,r,2);
  for(let i=0;i<a.length;i++){const t=Math.max(0,Math.min(1,(a[i]-.25)*2));a[i]=t*t*(3-2*t)}
  return a}
function blendInto(base,out,mode,a,alpha){
  for(let k=0,px=0;k<out.length;k+=4,px++){const aa=alpha?a*alpha[px]:a;if(aa<=0){if(alpha){out[k]=base[k];out[k+1]=base[k+1];out[k+2]=base[k+2]}continue}
    for(let j=k;j<k+3;j++){const b=base[j],o=out[j];
    const r=mode==='lighten'?(o>b?o:b):mode==='darken'?(o<b?o:b):mode==='screen'?255-(255-b)*(255-o)/255:o;
    out[j]=b+(r-b)*aa}}
}

// ---------- grade
function grade(out,p,alpha){
  const c=[hex(p.c1),hex(p.c2),hex(p.c3)], lut=new Uint8Array(768);
  for(let v=0;v<256;v++){const t=v/255, seg=t<.5?0:1, f=t<.5?t*2:(t-.5)*2;
    for(let k=0;k<3;k++)lut[v*3+k]=c[seg][k]+(c[seg+1][k]-c[seg][k])*f}
  const amt=p.amt/100, g=p.grain*1.1, sd=p.seed|0;
  for(let o=0,px=0;o<out.length;o+=4,px++){
    let n=0; if(g){let x=Math.imul(px^sd,2654435761);x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;n=((x>>>0)/4294967296-.5)*g}
    const v=Math.round(lum(out,o)*255), a=alpha?amt*alpha[px]:amt;
    for(let k=0;k<3;k++)out[o+k]=out[o+k]+(lut[v*3+k]-out[o+k])*a+n;
    out[o+3]=255;
  }
  return out;
}

// ---------- effects
const sample=(d,w,h,x,y,o)=>{x=x<0?0:x>=w?w-1:x|0;y=y<0?0:y>=h?h-1:y|0;const i=(y*w+x)*4;o[0]=d[i];o[1]=d[i+1];o[2]=d[i+2]};
function slitScan(out,w,h,f,seed){
  const src=new Uint8ClampedArray(out), rows=f.dir!=='cols', n=rows?h:w, len=rows?w:h, A=f.amount/100*.25*len, fq=Math.max(.2,f.freq/10);
  const off=new Float32Array(n);
  for(let i=0;i<n;i++){const u=i/(n-1);
    off[i]=f.shape==='ramp'?A*(u*2-1):f.shape==='noise'?A*(2*(rnd(Math.floor(u*fq*8),seed)*(1-((u*fq*8)%1))+rnd(Math.floor(u*fq*8)+1,seed)*((u*fq*8)%1))-1):A*Math.sin(u*TAU*fq)}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;let sx=x,sy=y;if(rows)sx=x+off[y];else sy=y+off[x];
    const x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0,cl=(v,m)=>v<0?0:v>=m?m-1:v;
    if(rows){const i0=(y*w+cl(x0,w))*4,i1=(y*w+cl(x0+1,w))*4;for(let k=0;k<3;k++)out[o+k]=src[i0+k]+(src[i1+k]-src[i0+k])*fx}
    else{const i0=(cl(y0,h)*w+x)*4,i1=(cl(y0+1,h)*w+x)*4;for(let k=0;k<3;k++)out[o+k]=src[i0+k]+(src[i1+k]-src[i0+k])*fy}}
}
function radialBlur(out,w,h,f){
  const src=new Uint8ClampedArray(out), cx=f.cx/100*w, cy=f.cy/100*h, N=18, amt=f.amount/100, spin=f.mode==='spin', s=[0,0,0];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0;const dx=x-cx,dy=y-cy;
    for(let k=0;k<N;k++){const t=k/(N-1);let sx,sy;
      if(spin){const a=(t-.5)*amt*.5,ca=Math.cos(a),sa=Math.sin(a);sx=cx+dx*ca-dy*sa;sy=cy+dx*sa+dy*ca}
      else{const z=1-amt*.35*t;sx=cx+dx*z;sy=cy+dy*z}
      sample(src,w,h,sx+.5,sy+.5,s);r+=s[0];g+=s[1];b+=s[2]}
    const o=(y*w+x)*4;out[o]=r/N;out[o+1]=g/N;out[o+2]=b/N}
}
function datamosh(out,w,h,f,bs){
  const B=Math.max(4,Math.round(f.size*bs)), amt=f.amount/100, sd=f.seed||1;
  for(let by=0,bi=0;by<h;by+=B)for(let bx=0;bx<w;bx+=B,bi++){
    if(rnd(bi,sd)>amt*.6)continue;
    const kind=rnd(bi+7,sd), dx=Math.round((rnd(bi+3,sd)-.5)*B*6), dy=kind<.6?-B*(1+Math.floor(rnd(bi+5,sd)*3)):Math.round((rnd(bi+9,sd)-.5)*B*2);
    for(let y=by;y<Math.min(h,by+B);y++)for(let x=bx;x<Math.min(w,bx+B);x++){const sx=clamp(x+dx,0,w-1),sy=clamp(y+dy,0,h-1),o=(y*w+x)*4,i=(sy*w+sx)*4;out[o]=out[i];out[o+1]=out[i+1];out[o+2]=out[i+2]}}
}
function echo(out,w,h,f,alpha){
  const E=new Uint8ClampedArray(out), n=clamp(Math.round(f.n),1,10), sp=f.spacing/100*.12*Math.hypot(w,h), th=f.angle*Math.PI/180, ux=Math.sin(th), uy=-Math.cos(th), op=f.opacity/100;
  for(let k=n;k>=1;k--){const dx=ux*sp*k,dy=uy*sp*k,a=op*Math.pow(1-k/(n+1),1+f.fade/25);
    for(let y=0;y<h;y++){const sy=Math.round(y-dy);if(sy<0||sy>=h)continue;
      for(let x=0;x<w;x++){const sx=Math.round(x-dx);if(sx<0||sx>=w)continue;const q=sy*w+sx,m=alpha[q];if(m<=.01)continue;
        const o=(y*w+x)*4,i=q*4,t=m*a;out[o]+=(E[i]-out[o])*t;out[o+1]+=(E[i+1]-out[o+1])*t;out[o+2]+=(E[i+2]-out[o+2])*t}}}
  for(let q=0;q<w*h;q++){const m=alpha[q];if(m<=0)continue;const o=q*4;out[o]+=(E[o]-out[o])*m;out[o+1]+=(E[o+1]-out[o+1])*m;out[o+2]+=(E[o+2]-out[o+2])*m}
}
function glow(out,w,h,weight,radius,passes){ // blurred bright parts, as a float RGB buffer
  const n=w*h,ch=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];
  for(let q=0;q<n;q++){const wt=weight(q);if(wt<=0)continue;const o=q*4;ch[0][q]=out[o]*wt;ch[1][q]=out[o+1]*wt;ch[2][q]=out[o+2]*wt}
  return ch.map(c=>boxBlur(c,w,h,radius,passes||3))}
const screenAdd=(out,o,r,g,b)=>{out[o]=255-(255-out[o])*(255-Math.min(255,r))/255;out[o+1]=255-(255-out[o+1])*(255-Math.min(255,g))/255;out[o+2]=255-(255-out[o+2])*(255-Math.min(255,b))/255};
function bloom(out,w,h,f,streaked,bs){
  const thr=f.thr/100, amt=f.amount/100*2.6;
  const G=glow(out,w,h,q=>streaked[q]?sstep((lum(out,q*4)-thr)/(1-thr+1e-6)):0,Math.max(2,Math.round((f.radius||30)/100*.03*Math.hypot(w,h))));
  for(let q=0;q<w*h;q++)screenAdd(out,q*4,G[0][q]*amt,G[1][q]*amt,G[2][q]*amt)}
function halation(out,w,h,f){
  const thr=f.thr/100, amt=f.amount/100*3.4, tint=hex(f.color||'#ff5a24');
  const G=glow(out,w,h,q=>sstep((lum(out,q*4)-thr)/(1-thr+1e-6)),Math.max(2,Math.round(f.radius/100*.025*Math.hypot(w,h))));
  for(let q=0;q<w*h;q++){const v=(G[0][q]*.3+G[1][q]*.59+G[2][q]*.11)/255*amt;if(v>0)screenAdd(out,q*4,tint[0]*v,tint[1]*v,tint[2]*v)}}
function cropBox(c,w,h){const k=c.crop||{x:0,y:0,w:1,h:1};return{x:k.x*w,y:k.y*h,w:k.w*w,h:k.h*h}}
function leak(out,w,h,f,cb){
  // a warm glow entering from a point on the frame edge (position goes clockwise from top-left)
  const t=((f.pos%100)+100)%100/100, per=2*(cb.w+cb.h); let d=t*per,px,py;
  if(d<cb.w){px=cb.x+d;py=cb.y}else if((d-=cb.w)<cb.h){px=cb.x+cb.w;py=cb.y+d}else if((d-=cb.h)<cb.w){px=cb.x+cb.w-d;py=cb.y+cb.h}else{d-=cb.w;px=cb.x;py=cb.y+cb.h-d}
  const R=f.size/100*.9*Math.hypot(cb.w,cb.h), amt=f.amount/100, c1=hex(f.color||'#ff7a2e'), c2=[255,60,110];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const r=Math.hypot(x-px,y-py)/R;if(r>=1)continue;const a=Math.pow(1-r,2)*amt,m=Math.min(1,r*1.4);
    screenAdd(out,(y*w+x)*4,(c1[0]+(c2[0]-c1[0])*m)*a,(c1[1]+(c2[1]-c1[1])*m)*a,(c1[2]+(c2[2]-c1[2])*m)*a)}}
function flare(out,w,h,f,cb){
  const px=cb.x+f.x/100*cb.w, py=cb.y+f.y/100*cb.h, cx=cb.x+cb.w/2, cy=cb.y+cb.h/2, D=Math.hypot(cb.w,cb.h), amt=f.amount/100;
  const parts=[[0,.06,[255,240,210],1],[0,.22,[255,170,90],.35],[.5,.05,[120,200,255],.25],[.8,.09,[255,120,200],.18],[1.25,.03,[200,255,170],.3],[1.6,.12,[255,200,120],.12]];
  for(const [t,rr,col,a0] of parts){const qx=px+(cx-px)*t*2,qy=py+(cy-py)*t*2,R=rr*D,x0=Math.max(0,qx-R|0),x1=Math.min(w-1,qx+R|0),y0=Math.max(0,qy-R|0),y1=Math.min(h-1,qy+R|0);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const r=Math.hypot(x-qx,y-qy)/R;if(r>=1)continue;const a=(t?sstep((1-r)*3)*.8:Math.pow(1-r,2.2))*a0*amt;
      screenAdd(out,(y*w+x)*4,col[0]*a,col[1]*a,col[2]*a)}}}
function riso(out,w,h,f,p,bs,L0){
  // two inks (mid and shadow colours) printed as rotated dot screens on highlight-coloured paper, slightly misregistered
  const paper=hex(p.c3), inkA=hex(p.c2), inkB=hex(p.c1), S=Math.max(3,f.dot/100*14*bs+2), mis=f.mis/100*S*1.5, amt=f.amount/100, src=new Uint8ClampedArray(out);
  const screens=[[15*Math.PI/180,0,0,inkA,L=>.9*Math.pow(clamp((.95-L)/.95,0,1),1.2)],[75*Math.PI/180,mis,mis*.6,inkB,L=>Math.pow(clamp((.5-L)/.5,0,1),1.1)]];
  const res=new Float32Array(w*h*3);for(let q=0;q<w*h;q++){res[q*3]=paper[0];res[q*3+1]=paper[1];res[q*3+2]=paper[2]}
  for(const [ang,ox,oy,ink,dens] of screens){const ca=Math.cos(ang),sa=Math.sin(ang);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x-ox,Y=y-oy,u=(X*ca+Y*sa)/S,v=(-X*sa+Y*ca)/S,cu=Math.floor(u)+.5,cv=Math.floor(v)+.5;
      const sx=(cu*ca-cv*sa)*S+ox,sy=(cu*sa+cv*ca)*S+oy,i=(clamp(Math.round(sy),0,h-1)*w+clamp(Math.round(sx),0,w-1))*4;
      const rad=Math.sqrt(dens(L0?L0[i>>2]:lum(src,i)))*.72, dd=Math.hypot(u-cu,v-cv), cov=clamp((rad-dd)*S+.5,0,1);
      if(cov>0){const q=(y*w+x)*3;for(let k=0;k<3;k++)res[q+k]*=1-cov*(1-ink[k]/255)}}}
  for(let q=0;q<w*h;q++){const o=q*4;for(let k=0;k<3;k++)out[o+k]+=(res[q*3+k]-out[o+k])*amt}}
const BAYER=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
function dither(out,w,h,f,p,streaked,bs){
  const pal=(f.palette==='mono'?[p.c1,p.c3]:f.palette==='four'?[p.c1,p.c2,p.c3,'#ffffff']:[p.c1,p.c2,p.c3]).map(hex), S=Math.max(1,Math.round(f.scale*bs)),
    bw=Math.ceil(w/S), bh=Math.ceil(h/S), g=new Float32Array(bw*bh*3), only=f.scope==='streaks';
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){let r=0,gg=0,b=0,n=0;
    for(let y=by*S;y<Math.min(h,by*S+S);y++)for(let x=bx*S;x<Math.min(w,bx*S+S);x++){const o=(y*w+x)*4;r+=out[o];gg+=out[o+1];b+=out[o+2];n++}
    const q=(by*bw+bx)*3;g[q]=r/n;g[q+1]=gg/n;g[q+2]=b/n}
  const near=(r,gg,b)=>{let best=0,bd=1e9;for(let k=0;k<pal.length;k++){const c=pal[k],d=(c[0]-r)**2+(c[1]-gg)**2+(c[2]-b)**2;if(d<bd){bd=d;best=k}}return best};
  const idx=new Uint8Array(bw*bh);
  if(f.mode==='bayer'){for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){const q=(by*bw+bx)*3,t=(BAYER[(by&7)*8+(bx&7)]/64-.5)*96;idx[by*bw+bx]=near(g[q]+t,g[q+1]+t,g[q+2]+t)}}
  else{for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){const q=(by*bw+bx)*3,k=near(g[q],g[q+1],g[q+2]),c=pal[k];idx[by*bw+bx]=k;
    for(let j=0;j<3;j++){const e=(g[q+j]-c[j])/8;for(const [ddx,ddy] of [[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]]){const nx=bx+ddx,ny=by+ddy;if(nx<0||nx>=bw||ny>=bh)continue;g[(ny*bw+nx)*3+j]+=e}}}}
  const amt=f.amount/100;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=y*w+x;if(only&&!streaked[q])continue;const c=pal[idx[((y/S)|0)*bw+((x/S)|0)]],o=q*4;for(let k=0;k<3;k++)out[o+k]+=(c[k]-out[o+k])*amt}}
function contours(out,w,h,f,p,bs,L0){
  let L=L0?Float32Array.from(L0):new Float32Array(w*h);if(!L0)for(let q=0;q<w*h;q++)L[q]=lum(out,q*4);
  L=boxBlur(L,w,h,Math.max(2,Math.round(3*bs)),2);
  const n=Math.max(2,Math.round(f.levels)), line=new Uint8Array(w*h), wt=Math.max(1,Math.round(f.weight*bs));
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const q=y*w+x,a=Math.floor(L[q]*n);if(a!==Math.floor(L[q+1]*n)||a!==Math.floor(L[q+w]*n))line[q]=1}
  let lw=new Float32Array(w*h);for(let q=0;q<w*h;q++)lw[q]=line[q];if(wt>1){lw=boxBlur(lw,w,h,Math.ceil(wt/2),1);for(let q=0;q<w*h;q++)lw[q]=lw[q]>.12?1:lw[q]*8}
  const col=hex(f.color==='dark'?p.c1:f.color==='mid'?p.c2:p.c3), paper=hex(f.color==='dark'?p.c3:p.c1), op=f.opacity/100, map=f.style==='map';
  for(let q=0;q<w*h;q++){const o=q*4;if(map){for(let k=0;k<3;k++)out[o+k]+=(paper[k]-out[o+k])*op}const a=Math.min(1,lw[q])*op;if(a>0)for(let k=0;k<3;k++)out[o+k]+=(col[k]-out[o+k])*a}}
function vignette(out,w,h,f,cb){
  const k=f.amount/100, mid=clamp(f.mid/100,.05,.95), cx=cb.x+cb.w/2, cy=cb.y+cb.h/2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-cx)/(cb.w/2),dy=(y-cy)/(cb.h/2),d=Math.sqrt((dx*dx+dy*dy)/2),v=sstep((d-mid)/(1.1-mid));if(!v)continue;
    const o=(y*w+x)*4;if(k<0){const m=1+k*v;out[o]*=m;out[o+1]*=m;out[o+2]*=m}else{const a=k*v;out[o]+=(255-out[o])*a;out[o+1]+=(255-out[o+1])*a;out[o+2]+=(255-out[o+2])*a}}}
function sharpen(out,w,h,f,bs){
  const amt=f.amount/100*1.6, r=Math.max(1,Math.round(bs*(f.radius||1)));
  for(let k=0;k<3;k++){let c=new Float32Array(w*h);for(let q=0;q<w*h;q++)c[q]=out[q*4+k];const b=boxBlur(c,w,h,r,1);
    for(let q=0;q<w*h;q++)out[q*4+k]=c[q]+(c[q]-b[q])*amt}}

// ---------- the whole pipeline
function render(c,p,wantDist){
  const n=c.w*c.h, fx=p.fx||{}, on=k=>fx[k]&&fx[k].on, rasters=c.rasters, masks=p.masks||[];
  // 1. adjustments
  let base=c.src;
  const locals=masks.filter(m=>m.adj&&adjActive(m.adj));
  if(adjActive(p.adj,p.curve)||locals.length){base=new Uint8ClampedArray(c.src);
    if(adjActive(p.adj,p.curve))adjust(base,p.adj,p.curve,null);
    for(const m of locals)adjust(base,m.adj,null,maskAlpha(m,c.w,c.h,rasters))}
  const cc=base===c.src?c:{...c,src:base};
  const out=new Uint8ClampedArray(base), dist=wantDist?new Float32Array(n).fill(Infinity):null;
  // 2. streak layers
  const list=p.noStreaks?[]:layerList(p), over=list.some(l=>l.mode==='edge'&&l.soft>0)?{a:new Float32Array(n),c:new Float32Array(n*3)}:null,
    plain=lp=>(lp.opacity==null||lp.opacity>=100)&&(!lp.blend||lp.blend==='normal')&&!findMask(p,lp.maskId);
  if(list.length===1&&plain(list[0]))streakLayer(cc,out,list[0],dist,over);
  else list.forEach((lp,i)=>{ // later layers sample the result of the earlier ones, then blend over it
    const before=new Uint8ClampedArray(out), lc=i?{...cc,src:before}:cc, d=dist?new Float32Array(n).fill(Infinity):null, M=findMask(p,lp.maskId);
    streakLayer(lc,out,lp,d,over); if(!plain(lp))blendInto(before,out,lp.blend||'normal',(lp.opacity??100)/100,M?maskAlpha(M,c.w,c.h,rasters):null);
    if(d)for(let j=0;j<d.length;j++)if(d[j]<dist[j])dist[j]=d[j]});
  // 3. warps
  if(on('slit'))slitScan(out,c.w,c.h,fx.slit,p.seed|0);
  if(on('blur'))radialBlur(out,c.w,c.h,fx.blur);
  if(on('mosh'))datamosh(out,c.w,c.h,fx.mosh,c.bs);
  // 4. protect, overlap, echo, bloom
  const pr=p.psoft>0?Math.round(p.psoft*c.bs):0, soft=pr>0?softMask(c.mask,c.w,c.h,pr):null;
  if(soft){for(let i=0;i<n;i++){const a=soft[i];if(!a)continue;const o=i*4;
      out[o]+=(base[o]-out[o])*a;out[o+1]+=(base[o+1]-out[o+1])*a;out[o+2]+=(base[o+2]-out[o+2])*a;if(dist&&a>.5)dist[i]=Infinity}}
  else for(let i=0;i<n;i++)if(c.mask[i]){const o=i*4;out[o]=base[o];out[o+1]=base[o+1];out[o+2]=base[o+2];if(dist)dist[i]=Infinity}
  if(over)for(let i=0;i<n;i++){const a=over.a[i];if(!a)continue;const o=i*4;
    out[o]+=(over.c[i*3]-out[o])*a;out[o+1]+=(over.c[i*3+1]-out[o+1])*a;out[o+2]+=(over.c[i*3+2]-out[o+2])*a;if(dist&&a>.3&&!(dist[i]<1))dist[i]=1}
  if(on('echo')){const M=findMask(p,fx.echo.src);let al=M?maskAlpha(M,c.w,c.h,rasters):soft;
    if(!al&&!M){al=new Float32Array(n);let any=0;for(let i=0;i<n;i++)if(c.mask[i]){al[i]=1;any=1}if(!any)al=null}
    if(al)echo(out,c.w,c.h,fx.echo,al)}
  let streaked=null;
  if(on('bloom')||(on('dither')&&fx.dither.scope==='streaks')){streaked=new Uint8Array(n);
    for(let i=0;i<n;i++){const o=i*4;if(Math.abs(out[o]-base[o])+Math.abs(out[o+1]-base[o+1])+Math.abs(out[o+2]-base[o+2])>18)streaked[i]=1}}
  if(on('bloom'))bloom(out,c.w,c.h,fx.bloom,streaked,c.bs);
  // 5. grade (risograph and contours read brightness from before the grade and grain)
  let L0=null;if(on('riso')||on('contour')){L0=new Float32Array(n);for(let i=0;i<n;i++)L0[i]=lum(out,i*4)}
  const GM=findMask(p,p.gradeMask);
  grade(out,p,GM?maskAlpha(GM,c.w,c.h,rasters):null);
  // 6-8. light, texture, finish
  const cb=cropBox(c,c.w,c.h);
  if(on('hal'))halation(out,c.w,c.h,fx.hal);
  if(on('leak'))leak(out,c.w,c.h,fx.leak,cb);
  if(on('flare'))flare(out,c.w,c.h,fx.flare,cb);
  if(on('riso'))riso(out,c.w,c.h,fx.riso,p,c.bs,L0);
  if(on('dither'))dither(out,c.w,c.h,fx.dither,p,streaked,c.bs);
  if(on('contour'))contours(out,c.w,c.h,fx.contour,p,c.bs,L0);
  if(on('vig')&&fx.vig.amount)vignette(out,c.w,c.h,fx.vig,cb);
  if(on('sharp')&&fx.sharp.amount)sharpen(out,c.w,c.h,fx.sharp,c.bs);
  for(let i=3;i<out.length;i+=4)out[i]=255;
  if(!wantDist)return{out};
  return{out,dist,orig:render(c,{...p,noStreaks:true}).out};
}
function cropArray(d,w,h,cr,ch){ // cut a normalised crop rect out of an array (ch = channels)
  const x0=Math.round(cr.x*w),y0=Math.round(cr.y*h),cw=Math.max(1,Math.min(w-x0,Math.round(cr.w*w))),chh=Math.max(1,Math.min(h-y0,Math.round(cr.h*h)));
  if(x0===0&&y0===0&&cw===w&&chh===h)return{d,w,h};
  const o=new d.constructor(cw*chh*ch);for(let y=0;y<chh;y++)o.set(d.subarray(((y0+y)*w+x0)*ch,((y0+y)*w+x0+cw)*ch),y*cw*ch);
  return{d:o,w:cw,h:chh}}

root.SL={TAU,lum,rnd,hex,clamp,sstep,maxR,dirVectors,layerList,render,compute:render,maskAt,maskAlpha,softMask,adjActive,toneLUT,curveFn,cropArray,ADJ0,CURVE0,boxBlur};
})(typeof self!=='undefined'?self:this);
