import { NextRequest } from "next/server";
import { fail, ok, pageSize } from "@/lib/api";
import { searchCommunity } from "@/lib/community";
import { searchSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const input = searchSchema.parse({ q: request.nextUrl.searchParams.get("q"), type: request.nextUrl.searchParams.get("type") ?? "all" });
    return ok(await searchCommunity(input.q, input.type, pageSize(request.nextUrl.searchParams.get("take"))));
  } catch (error) { return fail(error); }
}
