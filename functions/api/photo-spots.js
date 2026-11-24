
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://starestkor.github.io",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet() {
  return json({
    success: true,
    service: "Seoul Moments Photo Spots",
    message: "Photo Spots API is connected",
    version: "1.0.0"
  });
}

export async function onRequestPost() {
  return json({
    success: false,
    message: "Database and Google authentication setup is required."
  }, 501);
}
