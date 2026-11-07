import { NextRequest } from "next/server";
import { fail, ok, pageSize } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { createQuestion, getDiscoverFeed } from "@/lib/community";
import { questionSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const user = await getRequestUser(request);
    const sort = params.get("sort");
    const data = await getDiscoverFeed(user, { q: params.get("q") ?? undefined, topic: params.get("topic") ?? undefined, cursor: params.get("cursor") ?? undefined, take: pageSize(params.get("take")), feedOnly: params.get("sidebar") === "0", sort: sort === "trending" || sort === "recommended" ? sort : "latest" });
    const response = ok(data);
    // Likes, bookmarks and recommendations are specific to the current viewer.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = questionSchema.parse(await request.json());
    return ok(await createQuestion(user, input), 201);
  } catch (error) {
    return fail(error);
  }
}
