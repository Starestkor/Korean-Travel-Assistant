// Cloudflare Pages Function: functions/api/interpret.js
// Add OPENAI_API_KEY as a Cloudflare Pages secret. Never put the key in index.html.
export async function onRequestPost({ request, env }) {
  const cors = { "Access-Control-Allow-Origin": new URL(request.url).origin };
  try {
    if (!env.OPENAI_API_KEY) return Response.json({ error: "Server API key is not configured." }, { status: 500, headers: cors });
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    const language = String(incoming.get("language") || "en");
    const direction = String(incoming.get("direction") || "staffToUser");
    const validDirections = new Set(["staffToUser", "userToStaff"]);
    if (!validDirections.has(direction)) return Response.json({ error: "Invalid translation direction." }, { status: 400, headers: cors });
    if (!(audio instanceof File)) return Response.json({ error: "Audio file is missing." }, { status: 400, headers: cors });
    if (audio.size > 20 * 1024 * 1024) return Response.json({ error: "Recording is too large. Please record a shorter phrase." }, { status: 413, headers: cors });

    const languageNamesForTranscription = {
      en:"English", es:"Spanish", zh:"Mandarin Chinese", ja:"Japanese", fr:"French",
      de:"German", ar:"Arabic", pt:"Portuguese", ru:"Russian", vi:"Vietnamese",
      id:"Indonesian", ne:"Nepali", th:"Thai", si:"Sinhala"
    };
    const audioForm = new FormData();
    audioForm.append("file", audio, audio.name || "staff-speech.webm");
    audioForm.append("model", "gpt-4o-transcribe");
    const speechLanguage = direction === "staffToUser" ? "Korean" : (languageNamesForTranscription[language] || "the selected language");
    // Explicit language hint helps recognition when the speaker is using one language at a time.
    const speechLanguageCode = direction === "staffToUser" ? "ko" : language;
    audioForm.append("language", speechLanguageCode);
    audioForm.append("prompt", direction === "staffToUser"
      ? "Korean speech from a shop, restaurant, hotel, or transportation employee in South Korea. Common phrases include: ì¼ë§ìì, ì´ê±° ì¼ë§ìì, ì¹´ë ë¼ì, í¬ì¥í´ ì£¼ì¸ì, ì´ëìì, ì¬ê¸°ì ë´ë ¤ ì£¼ì¸ì. Preserve Korean particles, honorific endings, prices, dates, times, numbers, and place names. Do not translate; transcribe exactly what was said."
      : `Speech in ${speechLanguage} from a traveler in South Korea. Transcribe in ${speechLanguage}, not Korean or English unless those words were actually spoken. Preserve names, numbers, prices, places, and short travel phrases. Do not translate; transcribe exactly what was said.`);

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: audioForm
    });
    const transcriptionData = await transcriptionResponse.json();
    if (!transcriptionResponse.ok) {
      return Response.json({ error: transcriptionData.error?.message || "Speech recognition failed." }, { status: 502, headers: cors });
    }
    const transcript = String(transcriptionData.text || "").trim();
    if (!transcript) return Response.json({ error: "No speech was detected." }, { status: 422, headers: cors });

    const languageNames = {
      en:"English", es:"Spanish", zh:"Simplified Chinese", ja:"Japanese", fr:"French",
      de:"German", ar:"Modern Standard Arabic", pt:"Portuguese", ru:"Russian",
      vi:"Vietnamese", id:"Indonesian", ne:"Nepali", th:"Thai", si:"Sinhala", ko:"Korean"
    };
    const targetLanguage = direction === "staffToUser" ? (languageNames[language] || "English") : "Korean";
    const sourceLanguage = direction === "staffToUser" ? "Korean" : (languageNames[language] || "the selected language");
    const translationResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: direction === "staffToUser"
          ? `You are a professional Korean-to-${targetLanguage} interpreter for travelers in South Korea. Translate the Korean staff speech naturally and accurately into ${targetLanguage}. Do not summarize or omit details. Preserve prices, times, locations, names, warnings, conditions, and politeness. If a phrase is ambiguous, briefly mark the uncertainty rather than inventing details. Return only the translation, with no preface.`
          : `You are a professional ${sourceLanguage}-to-Korean interpreter helping a traveler communicate with Korean staff. Translate the traveler's speech naturally and accurately into Korean that a shop, restaurant, hotel, or transportation employee can understand. Preserve intent, politeness, prices, times, locations, names, and important details. Do not summarize or add information. Return only the Korean translation, with no preface.`,
        input: transcript,
        max_output_tokens: 700
      })
    });
    const translationData = await translationResponse.json();
    if (!translationResponse.ok) {
      return Response.json({ error: translationData.error?.message || "Translation failed." }, { status: 502, headers: cors });
    }
    const translation = (translationData.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n").trim();
    if (!translation) return Response.json({ error: "The translation was empty." }, { status: 502, headers: cors });
    return Response.json({ transcript, translation }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected server error." }, { status: 500, headers: cors });
  }
}
