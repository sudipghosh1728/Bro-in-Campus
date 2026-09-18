import { NextRequest } from "next/server";
import { clearSessionCookie, revokeRequestSession } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    await revokeRequestSession(request);
    const response = ok({ loggedOut: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return fail(error);
  }
}
