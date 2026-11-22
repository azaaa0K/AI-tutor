import { NextRequest, NextResponse } from "next/server";

type Incoming = { role?: unknown; content?: unknown };

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const messages = normalizeMessages(payload);

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message is empty." }, { status: 400 });
    }

    const response = await fetch("http://127.0.0.1:9931/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Model error" },
        { status: response.status },
      );
    }

    const content = data.choices?.[0]?.message?.content;

    return NextResponse.json({
      answer: typeof content === "string" ? content : "",
      model: typeof data.model === "string" ? data.model : undefined,
      timings: data.timings,
      usage: data.usage,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not connect to the model." },
      { status: 500 },
    );
  }
}

function normalizeMessages(payload: { messages?: Incoming[]; message?: unknown }) {
  if (Array.isArray(payload.messages)) {
    return payload.messages.flatMap((msg) => {
      if (
        !msg ||
        (msg.role !== "user" && msg.role !== "assistant") ||
        typeof msg.content !== "string" ||
        msg.content.trim().length === 0
      ) {
        return [];
      }

      return [{ role: msg.role, content: msg.content }];
    });
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return [{ role: "user" as const, content: payload.message }];
  }

  return [];
}
