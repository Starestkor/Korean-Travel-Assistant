// Cloudflare Pages Function: functions/api/interpret.js
// Required Cloudflare Pages secrets:
// ELEVENLABS_API_KEY (speech recognition) and OPENAI_API_KEY (translation).
// Never expose either key in index.html.

const corsHeaders = (request) => {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = new Set([
    "https://starestkor.github.io",
    "https://korean-travel-assistant.pages.dev"
  ]);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://starestkor.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
};

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);
  const json = (data, status = 200) => Response.json(data, { status, headers });

  try {
    if (!env.ELEVENLABS_API_KEY) return json({ error: "ElevenLabs API key is not configured on Cloudflare (ELEVENLABS_API_KEY)." }, 500);
    if (!env.OPENAI_API_KEY) return json({ error: "OpenAI API key is not configured on Cloudflare (OPENAI_API_KEY)." }, 500);

    const incoming = await request.formData();
    const audio = incoming.get("audio");
    const language = String(incoming.get("language") || "en").toLowerCase();
    const direction = String(incoming.get("direction") || "staffToUser");
    if (!["staffToUser", "userToStaff"].includes(direction)) return json({ error: "Invalid translation direction." }, 400);
    if (!(audio instanceof File) || audio.size === 0) return json({ error: "Audio file is missing or empty." }, 400);
    if (audio.size > 20 * 1024 * 1024) return json({ error: "Recording is too large. Please record a shorter phrase." }, 413);

    // ElevenLabs Scribe v3 uses ISO-639-3 language codes.
    const languageCodes = {
      en: "eng", es: "spa", zh: "zho", ja: "jpn", fr: "fra", de: "deu",
      ar: "ara", pt: "por", ru: "rus", vi: "vie", id: "ind", ne: "nep",
      th: "tha", si: "sin", ko: "kor"
    };
    const speechLanguageCode = direction === "staffToUser" ? "kor" : languageCodes[language];
    if (!speechLanguageCode) return json({ error: `Unsupported language selection: ${language}` }, 400);

    const elevenForm = new FormData();
    elevenForm.append("file", audio, audio.name || "travel-speech.webm");
    elevenForm.append("model_id", "scribe_v3");
    elevenForm.append("language_code", speechLanguageCode);
    elevenForm.append("tag_audio_events", "false");
    elevenForm.append("diarize", "false");

    const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      body: elevenForm
    });
    const sttData = await sttResponse.json().catch(() => ({}));
    if (!sttResponse.ok) {
      const detail = sttData.detail?.message || sttData.detail || sttData.message || `ElevenLabs returned HTTP ${sttResponse.status}.`;
      return json({ error: `Speech recognition failed: ${String(detail)}` }, 502);
    }

    const transcript = String(sttData.text || "").trim();
    if (!transcript) return json({ error: "No speech was detected. Please speak clearly and try again." }, 422);

    const languageNames = {
      en: "English", es: "Spanish", zh: "Simplified Chinese", ja: "Japanese", fr: "French",
      de: "German", ar: "Modern Standard Arabic", pt: "Portuguese", ru: "Russian",
      vi: "Vietnamese", id: "Indonesian", ne: "Nepali", th: "Thai", si: "Sinhala", ko: "Korean"
    };
    const targetLanguage = direction === "staffToUser" ? (languageNames[language] || "English") : "Korean";
    const sourceLanguage = direction === "staffToUser" ? "Korean" : (languageNames[language] || "the selected language");

    const translationResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: direction === "staffToUser"
          ? `You are a professional Korean-to-${targetLanguage} interpreter for travelers in South Korea. Translate the Korean speech naturally and accurately into ${targetLanguage}. Do not summarize or omit details. Preserve prices, times, locations, names, warnings, conditions, and politeness. Return only the translation, with no preface.`
          : `You are a professional ${sourceLanguage}-to-Korean interpreter helping a traveler communicate with Korean staff. Translate naturally and accurately into Korean. Preserve intent, politeness, prices, times, locations, names, and important details. Do not summarize or add information. Return only the Korean translation, with no preface.`,
        input: transcript,
        max_output_tokens: 700
      })
    });
    const translationData = await translationResponse.json().catch(() => ({}));
    if (!translationResponse.ok) {
      return json({ error: translationData.error?.message || `Translation failed (HTTP ${translationResponse.status}).` }, 502);
    }
    const translation = (translationData.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n").trim();
    if (!translation) return json({ error: "The translation was empty." }, 502);

    return json({ transcript, translation, transcriptionProvider: "ElevenLabs Scribe v3" });
  } catch (error) {
    return json({ error: error?.message || "Unexpected server error." }, 500);
  }
}
