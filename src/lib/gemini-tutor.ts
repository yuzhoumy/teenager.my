import { DEFAULT_GEMINI_MODEL, TUTOR_SYSTEM_INSTRUCTION } from "@/lib/gemini-tutor-prompt";

export type TutorChatMessage = { role: "user" | "assistant"; text: string };

/** Static hosts (e.g. GitHub Pages) have no `/api/tutor` — try browser Gemini when key is present. */
async function sendTutorViaBrowserGemini(
  priorMessages: TutorChatMessage[],
  userMessage: string,
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const modelId =
    process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
  });

  const history = priorMessages.map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: message.text }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  const text = result.response.text().trim();
  return text || "I couldn’t generate a reply — try rephrasing your question.";
}

function shouldTryBrowserFallback(status: number): boolean {
  return status === 404 || status === 405 || status === 503;
}

/**
 * Prefers `POST /api/tutor/` (keeps `GEMINI_API_KEY` on the server).
 * On static hosts (GitHub Pages), that route does not exist → falls back to browser Gemini when
 * `NEXT_PUBLIC_GEMINI_API_KEY` is set at build time (restrict key by HTTP referrer in Google AI Studio).
 */
export async function sendTutorMessage(
  priorMessages: TutorChatMessage[],
  userMessage: string,
): Promise<string> {
  const url = "/api/tutor/";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priorMessages, userMessage }),
      credentials: "same-origin",
    });
  } catch {
    const direct = await sendTutorViaBrowserGemini(priorMessages, userMessage);
    if (direct !== null) return direct;
    throw new Error("Could not reach the tutor. Check your connection.");
  }

  let data: { reply?: string; error?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // e.g. HTML error page from CDN
  }

  if (res.ok && typeof data.reply === "string") {
    return data.reply;
  }

  if (shouldTryBrowserFallback(res.status)) {
    const direct = await sendTutorViaBrowserGemini(priorMessages, userMessage);
    if (direct !== null) return direct;
  }

  const msg =
    typeof data.error === "string" && data.error
      ? data.error
      : `Tutor request failed (${res.status}).`;

  if ((res.status === 404 || res.status === 405) && !process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim()) {
    throw new Error(
      `${msg} This site is hosted as static files (e.g. GitHub Pages). Add secret NEXT_PUBLIC_GEMINI_API_KEY to your build for the tutor, or deploy on Vercel with GEMINI_API_KEY for /api/tutor.`,
    );
  }

  throw new Error(msg);
}
