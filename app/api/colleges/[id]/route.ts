import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateCollegeLocation } from "@/lib/colleges";
import { mongoId, placeLocationSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await updateCollegeLocation(user, mongoId.parse(id), placeLocationSchema.parse(await request.json())));
  } catch (error) { return fail(error); }
}
