import { NextRequest } from "next/server";
import { fail, ok, pageSize } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { getStudentDirectory } from "@/lib/colleges";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    return ok(await getStudentDirectory(await getRequestUser(request), {
      q: params.get("q") ?? undefined,
      college: params.get("college") ?? undefined,
      take: pageSize(params.get("take"), 48, 80),
    }));
  } catch (error) { return fail(error); }
}
