import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { resetPasswordWithOtp } from "@/lib/password-reset";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    return ok(await resetPasswordWithOtp(resetPasswordSchema.parse(await request.json())));
  } catch (error) { return fail(error); }
}
