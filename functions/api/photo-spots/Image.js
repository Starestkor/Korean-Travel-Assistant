import {json,preflight,verifyGoogle} from "../_utils/auth.js";
export async function onRequestOptions(){return preflight();}
export async function onRequestGet({request,env}) {
 const origin=request.headers.get("Origin");
 try {
  const url=new URL(request.url),id=url.searchParams.get("id");
  if(!id) return json({success:false,message:"Photo ID required"},400,origin);
  const row=await env.PHOTO_SPOTS_DB.prepare("SELECT owner_id,visibility,object_key,content_type FROM photo_spots WHERE id=?").bind(id).first();
  if(!row) return json({success:false,message:"Photo not found"},404,origin);
  if(row.visibility!=="public") {
   const user=await verifyGoogle(request,env);
   if(user.id!==row.owner_id) return json({success:false,message:"Not authorized"},403,origin);
  }
  const object=await env.PHOTO_BUCKET.get(row.object_key);
  if(!object) return json({success:false,message:"Photo file not found"},404,origin);
  const allowedOrigin=origin==="https://starestkor.github.io"||origin==="https://korean-travel-assistant.pages.dev"?origin:"https://starestkor.github.io";
  const headers=new Headers({"Content-Type":row.content_type,"Cache-Control":row.visibility==="public"?"public, max-age=300":"private, no-store","Access-Control-Allow-Origin":allowedOrigin,"Vary":"Origin"});
  return new Response(object.body,{headers});
 } catch(e){return json({success:false,message:e.message||"Unable to load image"},401,origin);}
}
