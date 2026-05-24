import { NextResponse } from "next/server";
import { readModelEnv } from "@/lib/ai/env";
import { AiActionRequestSchema } from "@/lib/ai/schemas";
import { runAiActionWorkflow } from "@/lib/ai/workflow";

export async function POST(request: Request) {
  const env = readModelEnv();

  if (!env.ok) {
    return NextResponse.json(
      { error: env.error, missing: env.missing },
      { status: 503 },
    );
  }

  try {
    const body = AiActionRequestSchema.parse(await request.json());
    const result = await runAiActionWorkflow(body);

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
