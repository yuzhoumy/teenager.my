import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_GEMINI_MODEL, TUTOR_SYSTEM_INSTRUCTION } from "@/lib/gemini-tutor-prompt";
import type { TutorChatMessage } from "@/lib/gemini-tutor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Gemini API key is not configured on the server. For production, add GEMINI_API_KEY in your hosting dashboard (Vercel / Netlify / Cloudflare → Environment Variables), then redeploy. Local-only .env.local does not apply to the live site.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const priorMessages = (body as { priorMessages?: TutorChatMessage[] }).priorMessages;
  const userMessage = (body as { userMessage?: string }).userMessage?.trim();

  if (!Array.isArray(priorMessages) || typeof userMessage !== "string" || !userMessage) {
    return NextResponse.json({ error: "Expected priorMessages array and non-empty userMessage." }, { status: 400 });
  }

  for (const entry of priorMessages) {
    if (
      !entry ||
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.text !== "string"
    ) {
      return NextResponse.json({ error: "Invalid priorMessages entry." }, { status: 400 });
    }
  }

  const modelId =
    process.env.GEMINI_MODEL?.trim() ||
    process.env.GEMINI_API_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;

  try {
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
    const reply = text || "I couldn’t generate a reply — try rephrasing your question.";
    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
