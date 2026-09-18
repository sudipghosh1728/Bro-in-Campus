import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { addLocalMarket, getResidenceLivingData, syncNearbyMarkets } from "@/lib/living";
import { marketSchema, mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return ok(await getResidenceLivingData(mongoId.parse(id), await getRequestUser(request)));
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const collegeId = mongoId.parse(id);
    const body = await request.json();
    if (body?.action === "sync") return ok(await syncNearbyMarkets(user, collegeId));
    return ok(await addLocalMarket(user, collegeId, marketSchema.parse(body)), 201);
  } catch (error) { return fail(error); }
}
