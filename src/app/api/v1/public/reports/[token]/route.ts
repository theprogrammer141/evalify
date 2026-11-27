import { NextResponse } from "next/server";
import { getPublicReportVerification } from "@/lib/reports/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const verification = await getPublicReportVerification(token);
  return NextResponse.json(
    verification,
    {
      status: verification.status === "nonexistent" ? 404 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
