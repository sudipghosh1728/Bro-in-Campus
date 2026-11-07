import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateCollegeDepartments } from "@/lib/colleges";
import { collegeDepartmentsSchema, mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const input = collegeDepartmentsSchema.parse(await request.json());
    return ok(await updateCollegeDepartments(user, mongoId.parse(id), input.departmentSlugs));
  } catch (error) {
    return fail(error);
  }
}
