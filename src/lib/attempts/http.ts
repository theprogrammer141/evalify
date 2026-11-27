import { NextResponse } from "next/server";
import { AttemptServiceError } from "@/lib/attempts/service";

export function attemptErrorResponse(error: unknown): NextResponse {
  if (error instanceof AttemptServiceError) {
    return NextResponse.json(
      { error: error.code },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  throw error;
}

export function invalidRequestResponse(): NextResponse {
  return NextResponse.json(
    { error: "invalid_request" },
    {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
