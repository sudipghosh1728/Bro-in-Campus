import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { getCareerDirectory } from "@/lib/campus";

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") ?? undefined;
    const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;
    if (type && !["INTERNSHIP", "FULL_TIME", "PART_TIME", "APPRENTICESHIP"].includes(type)) return ok(await getCareerDirectory(await getRequestUser(request), { q }));
    return ok(await getCareerDirectory(await getRequestUser(request), { q, type }));
  } catch (error) {
    return fail(error);
  }
}
