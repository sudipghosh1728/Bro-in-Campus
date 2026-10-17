import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { refreshStudentBriefing } from "@/lib/briefing-refresh";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return ok(await refreshStudentBriefing());
  } catch (error) {
    return fail(error);
  }
}
