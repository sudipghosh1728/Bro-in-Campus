import { NextRequest } from "next/server";
import { fail, ok, pageSize } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { createCollege, getCollegeDirectory } from "@/lib/colleges";
import { collegeSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const data = await getCollegeDirectory(user, { q: request.nextUrl.searchParams.get("q") ?? undefined, take: pageSize(request.nextUrl.searchParams.get("take"), 36, 60) });
    return ok(data);
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = collegeSchema.parse(await request.json());
    return ok(await createCollege(user, input), 201);
  } catch (error) { return fail(error); }
}
