import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createCompanyReview } from "@/lib/campus";
import { companyReviewSchema } from "@/lib/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    return ok(await createCompanyReview(user, (await params).id, companyReviewSchema.parse(await request.json())), 201);
  } catch (error) {
    return fail(error);
  }
}
