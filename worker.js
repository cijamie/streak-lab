// Renders the editing preview off the main thread so sliders stay smooth on big photos.
importScripts('engine.js');
let src=null, w=0, h=0, mask=null, rasters={};
self.onmessage=e=>{
  const m=e.data;
  if(m.type==='src'){src=m.src;w=m.w;h=m.h;return}
  if(m.type==='mask'){mask=m.mask;return}
  if(m.type==='rasters'){Object.assign(rasters,m.rasters);return}
  if(m.type==='render'){
    try{
      const r=SL.render({src,w,h,mask,bs:1,rasters,crop:m.crop},m.p);
      self.postMessage({type:'done',id:m.id,out:r.out},[r.out.buffer]);
    }catch(err){self.postMessage({type:'error',id:m.id,message:String(err&&err.message||err)})}
  }
};
