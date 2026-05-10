import { GoogleGenerativeAI } from "@google/generative-ai";

export type TutorChatMessage = { role: "user" | "assistant"; text: string };

const TUTOR_SYSTEM_INSTRUCTION = `You are a supportive study tutor for Malaysian secondary school students who use teenager.my, a shared learning site with study materials, PDF forks with annotations, and a student forum.

Guidelines:
- Keep replies concise (roughly 2–6 short paragraphs unless the student asks for depth).
- Encourage good habits: spaced repetition, past-year papers, clear goals, breaks, and asking for help in the forum when stuck.
- When relevant, mention that students can browse Resources, use Fork to annotate PDFs, and discuss in the Forum.
- Do not fabricate official exam answers or reproduce large copyrighted exam content verbatim; focus on methods, concepts, and practice strategies.
- Be warm and age-appropriate; avoid lecturing.
- If asked something outside school or study support, answer briefly then steer back to learning if appropriate.`;

export async function sendTutorMessage(
  priorMessages: TutorChatMessage[],
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Add NEXT_PUBLIC_GEMINI_API_KEY to .env.local and restart the dev server.",
    );
  }

  const modelId =
    process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

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
