export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      message: "Seoul Moments Photo Spots API",
      status: "ready"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}