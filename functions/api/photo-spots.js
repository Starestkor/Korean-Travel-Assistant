import {json,preflight,verifyGoogle,safeError} from "./_utils/auth.js";
const MAX_BYTES=8*1024*1024;
const TYPES=new Set(["image/jpeg","image/png","image/webp"]);
export async function onRequestOptions(){return preflight();}
export async function onRequestGet({request,env}) {
 try {
  const user=await verifyGoogle(request,env);
  const rows=await env.PHOTO_SPOTS_DB.prepare("SELECT id,place_name,note,visibility,latitude,longitude,created_at FROM photo_spots WHERE owner_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
  return json({success:true,items:(rows.results||[]).map(x=>({...x,image_url:"https://korean-travel-assistant.pages.dev/api/photo-spots/image?id="+encodeURIComponent(x.id)}))},200,request.headers.get("Origin"));
 } catch(e){return json({success:false,message:safeError(e)},401,request.headers.get("Origin"));}
}
export async function onRequestPost({request,env}) {
 let objectKey=null;
 try {
  const user=await verifyGoogle(request,env);
  const form=await request.formData(), file=form.get("photo");
  if(!(file instanceof File)) return json({success:false,message:"Photo file is required"},400,request.headers.get("Origin"));
  if(!TYPES.has(file.type)||file.size<1||file.size>MAX_BYTES) return json({success:false,message:"Only JPG, PNG or WebP photos up to 8MB are allowed"},400,request.headers.get("Origin"));
  const place=String(form.get("place_name")||"").trim().slice(0,120);
  const note=String(form.get("note")||"").trim().slice(0,1000);
  const visibility=String(form.get("visibility")||"private")==="public"?"public":"private";
  if(!place) return json({success:false,message:"Place name is required"},400,request.headers.get("Origin"));
  const lat=form.get("latitude"),lng=form.get("longitude");
  const latitude=lat==null||lat===""?null:Number(lat),longitude=lng==null||lng===""?null:Number(lng);
  if((latitude!==null&&(!Number.isFinite(latitude)||latitude < -90||latitude>90))||(longitude!==null&&(!Number.isFinite(longitude)||longitude < -180||longitude>180))) return json({success:false,message:"Invalid coordinates"},400,request.headers.get("Origin"));
  const id=crypto.randomUUID();objectKey=user.id+"/"+id;
  await env.PHOTO_BUCKET.put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:"private, max-age=0"}});
  try {
   await env.PHOTO_SPOTS_DB.prepare("INSERT INTO photo_spots (id,owner_id,place_name,note,visibility,latitude,longitude,object_key,content_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,user.id,place,note,visibility,latitude,longitude,objectKey,file.type,new Date().toISOString()).run();
  } catch(dbError){await env.PHOTO_BUCKET.delete(objectKey);throw dbError;}
  return json({success:true,id},201,request.headers.get("Origin"));
 } catch(e){return json({success:false,message:safeError(e)},400,request.headers.get("Origin"));}
}
