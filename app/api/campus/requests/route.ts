import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createServiceRequest, getCampusRequests } from "@/lib/campus";
import { serviceRequestSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    return ok(await getCampusRequests(await requireUser(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return ok(await createServiceRequest(user, serviceRequestSchema.parse(await request.json())), 201);
  } catch (error) {
    return fail(error);
  }
}
