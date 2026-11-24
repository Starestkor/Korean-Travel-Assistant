import {json,preflight} from "./_utils/auth.js";

// Public feed: private records are excluded in SQL, and owner identifiers are never returned.
export async function onRequestOptions(){
  return preflight();
}

export async function onRequestGet({request,env}){
  const origin=request.headers.get("Origin");
  try{
    const rows=await env.PHOTO_SPOTS_DB.prepare(
      "SELECT id,place_name,note,latitude,longitude,created_at FROM photo_spots WHERE visibility='public' ORDER BY created_at DESC LIMIT 60"
    ).all();
    const items=(rows.results||[]).map(row=>({
      id:row.id,
      place_name:row.place_name,
      note:row.note,
      latitude:row.latitude,
      longitude:row.longitude,
      created_at:row.created_at,
      image_url:"https://korean-travel-assistant.pages.dev/api/photo-spots/image?id="+encodeURIComponent(row.id)
    }));
    return json({success:true,items},200,origin);
  }catch(error){
    return json({success:false,message:error?.message||"Unable to load community spots"},500,origin);
  }
}
