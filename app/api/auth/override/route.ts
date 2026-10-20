import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Temporary admin override has been disabled. Please sign in with a valid authorized account." },
    { status: 403 }
  );
}