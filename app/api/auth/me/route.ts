import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    return ok({ user: await getRequestUser(request) });
  } catch (error) {
    return fail(error);
  }
}
