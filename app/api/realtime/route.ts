import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();
const format = (event: RealtimeEvent) => encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));
      const stopPublic = subscribe("public", (event) => controller.enqueue(format(event)));
      const stopUser = user ? subscribe(`user:${user.id}`, (event) => controller.enqueue(format(event))) : () => undefined;
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 25_000);
      request.signal.addEventListener("abort", () => { clearInterval(heartbeat); stopPublic(); stopUser(); controller.close(); }, { once: true });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
