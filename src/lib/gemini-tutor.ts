export type TutorChatMessage = { role: "user" | "assistant"; text: string };

/**
 * Calls the server Route Handler so the Gemini API key stays on the server.
 * Configure GEMINI_API_KEY in .env.local (local) and in your host’s env (production).
 */
export async function sendTutorMessage(
  priorMessages: TutorChatMessage[],
  userMessage: string,
): Promise<string> {
  // Relative URL + trailing slash matches `trailingSlash: true` and avoids POST→GET mishandling on redirects.
  const url = "/api/tutor/";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priorMessages, userMessage }),
    credentials: "same-origin",
  });

  let data: { reply?: string; error?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      typeof data.error === "string" && data.error
        ? data.error
        : `Tutor request failed (${res.status}).`;
    throw new Error(msg);
  }

  if (typeof data.reply !== "string") {
    throw new Error("Invalid response from tutor.");
  }

  return data.reply;
}
