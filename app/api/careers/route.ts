import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { createCareerOpportunity, getCareerDirectory } from "@/lib/campus";
import { careerOpportunitySchema } from "@/lib/validation";

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

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return ok(await createCareerOpportunity(user, careerOpportunitySchema.parse(await request.json())), 201);
  } catch (error) {
    return fail(error);
  }
}
