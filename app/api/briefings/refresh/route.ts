import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { refreshStudentBriefing } from "@/lib/briefing-refresh";
import { revalidateTag } from "next/cache";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await refreshStudentBriefing();
    revalidateTag("growth-catalog");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
