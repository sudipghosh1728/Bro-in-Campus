import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { subscribeToNewsletter } from "@/lib/growth";
import { newsletterSubscriptionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const input = newsletterSubscriptionSchema.parse(await request.json());
    return ok(await subscribeToNewsletter({ ...input, userId: user?.id }), 201);
  } catch (error) {
    return fail(error);
  }
}
