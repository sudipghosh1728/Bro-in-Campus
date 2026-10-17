import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { createCampusEvent, getCampusEvents } from "@/lib/campus";
import { campusEventSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    return ok(await getCampusEvents(await getRequestUser(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return ok(await createCampusEvent(user, campusEventSchema.parse(await request.json())), 201);
  } catch (error) {
    return fail(error);
  }
}
