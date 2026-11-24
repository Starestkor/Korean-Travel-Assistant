const ALLOWED_ORIGIN = "https://starestkor.github.io";
export function cors(origin) {
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
  return headers;
}
export function json(data, status=200, origin=ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {status, headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}});
}
export function preflight() { return new Response(null,{status:204,headers:{...cors(ALLOWED_ORIGIN),"Access-Control-Max-Age":"86400"}}); }
export async function verifyGoogle(request, env) {
  const origin=request.headers.get("Origin");
  if(origin && origin!==ALLOWED_ORIGIN) throw new Error("Origin not allowed");
  const auth=request.headers.get("Authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token) throw new Error("Google login required");
  const res=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(token));
  if(!res.ok) throw new Error("Google token expired or invalid. Please sign in again.");
  const info=await res.json();
  if(info.aud!==env.GOOGLE_CLIENT_ID || !["accounts.google.com","https://accounts.google.com"].includes(info.iss) || Number(info.exp)*1000<Date.now() || info.email_verified!=="true" || !info.sub) throw new Error("Google account verification failed");
  return {id:info.sub,email:info.email||"",name:info.name||"",picture:info.picture||""};
}
export function safeError(error) { return error?.message || "Request failed"; }
