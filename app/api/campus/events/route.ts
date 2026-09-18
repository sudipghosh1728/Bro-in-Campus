import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { getCampusEvents } from "@/lib/campus";

export async function GET(request: NextRequest) {
  try {
    return ok(await getCampusEvents(await getRequestUser(request)));
  } catch (error) {
    return fail(error);
  }
}
