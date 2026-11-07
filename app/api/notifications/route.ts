import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getNotifications, markAllNotificationsRead } from "@/lib/community";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const data = request.nextUrl.searchParams.get("count") === "1"
      ? { unreadCount: await prisma.notification.count({ where: { userId: user.id, OR: [{ readAt: null }, { readAt: { isSet: false } }] } }) }
      : await getNotifications(user.id);
    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return fail(error); }
}
export async function PATCH(request: NextRequest) { try { const user = await requireUser(request); await markAllNotificationsRead(user.id); return ok({ read: true }); } catch (error) { return fail(error); } }
