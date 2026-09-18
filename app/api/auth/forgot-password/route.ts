import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { requestPasswordReset } from "@/lib/password-reset";
import { allowRequest } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!allowRequest(`forgot-password:${ip}`, 5, 60 * 60 * 1000)) throw new ApiError(429, "RATE_LIMITED", "Too many reset requests. Please try again later.");
    const input = forgotPasswordSchema.parse(await request.json());
    if (!allowRequest(`forgot-password-email:${input.email}`, 3, 15 * 60 * 1000)) throw new ApiError(429, "RATE_LIMITED", "Too many reset requests. Please wait a few minutes before requesting another code.");
    return ok(await requestPasswordReset(input.email));
  } catch (error) { return fail(error); }
}
