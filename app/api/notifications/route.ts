import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getNotifications, markAllNotificationsRead } from "@/lib/community";

export async function GET(request: NextRequest) { try { const user = await requireUser(request); return ok(await getNotifications(user.id)); } catch (error) { return fail(error); } }
export async function PATCH(request: NextRequest) { try { const user = await requireUser(request); await markAllNotificationsRead(user.id); return ok({ read: true }); } catch (error) { return fail(error); } }
