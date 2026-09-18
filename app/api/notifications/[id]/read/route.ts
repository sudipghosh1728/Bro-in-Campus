import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/community";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) { try { const { id } = await context.params; const user = await requireUser(request); await markNotificationRead(user.id, id); return ok({ read: true }); } catch (error) { return fail(error); } }
