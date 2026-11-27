import { NextResponse } from "next/server";
import { ReportServiceError } from "@/lib/reports/service";

export function reportErrorResponse(error: unknown): NextResponse {
  if (error instanceof ReportServiceError) {
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

export function reportPdfResponse(
  pdf: Uint8Array,
  filename: string,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(Buffer.from(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      ...additionalHeaders,
    },
  });
}
