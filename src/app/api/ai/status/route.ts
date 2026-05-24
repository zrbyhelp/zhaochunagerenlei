import { NextResponse } from "next/server";
import { modelStatus } from "@/lib/ai/env";

export function GET() {
  return NextResponse.json(modelStatus());
}
