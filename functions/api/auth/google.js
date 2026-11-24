import {json,preflight,verifyGoogle,safeError} from "../_utils/auth.js";
export async function onRequestOptions(){return preflight();}
export async function onRequestPost({request,env}) {
 try {
  const origin=request.headers.get("Origin");
  const body=await request.json();
  if(!body.credential) return json({success:false,message:"Google credential is required"},400,origin);
  const user=await verifyGoogle(new Request(request.url,{headers:{Origin:origin||"",Authorization:"Bearer "+body.credential}}),env);
  return json({success:true,user},200,origin);
 } catch(e) { return json({success:false,message:safeError(e)},401,request.headers.get("Origin")); }
}
