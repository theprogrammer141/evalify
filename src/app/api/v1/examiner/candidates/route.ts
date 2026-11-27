import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { searchCandidates } from "@/lib/examinations/service";

export async function GET(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const search = new URL(request.url).searchParams.get("search") ?? "";
  if (search.trim().length < 2) {
    return NextResponse.json(
      { error: "search_too_short", message: "Enter at least two characters." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { candidates: await searchCandidates(search) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
