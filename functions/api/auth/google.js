
const ALLOWED_ORIGIN = "https://starestkor.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("Origin"))
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");

  if (origin !== ALLOWED_ORIGIN) {
    return json({ success: false, message: "Origin not allowed" }, 403, origin);
  }

  try {
    if (!env.GOOGLE_CLIENT_ID) {
      return json({ success: false, message: "Google login is not configured" }, 500, origin);
    }

    const body = await request.json();
    const idToken = body.credential;

    if (!idToken || typeof idToken !== "string") {
      return json({ success: false, message: "Google credential is required" }, 400, origin);
    }

    const response = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" +
      encodeURIComponent(idToken)
    );

    if (!response.ok) {
      return json({ success: false, message: "Invalid Google token" }, 401, origin);
    }

    const user = await response.json();

    if (
      user.aud !== env.GOOGLE_CLIENT_ID ||
      !["accounts.google.com", "https://accounts.google.com"].includes(user.iss) ||
      Number(user.exp) <= Math.floor(Date.now() / 1000) ||
      user.email_verified !== "true" ||
      !user.sub
    ) {
      return json({ success: false, message: "Google account verification failed" }, 401, origin);
    }

    return json({
      success: true,
      user: {
        id: user.sub,
        email: user.email,
        name: user.name || "",
        picture: user.picture || ""
      }
    }, 200, origin);

  } catch (error) {
    return json({
      success: false,
      message: "Google login verification failed"
    }, 500, origin);
  }
}

