import { NextResponse } from "next/server";
import { z } from "zod";
import { readModelEnv } from "@/lib/ai/env";
import { generateWordPair } from "@/lib/ai/model";

const RequestSchema = z.object({
  locale: z.enum(["zh-CN", "en-US"]),
});

export async function POST(request: Request) {
  const env = readModelEnv();

  if (!env.ok) {
    return NextResponse.json(
      { error: env.error, missing: env.missing },
      { status: 503 },
    );
  }

  try {
    const body = RequestSchema.parse(await request.json());
    const wordPair = await generateWordPair(body.locale);

    return NextResponse.json({ wordPair });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
