import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addProduceListing } from "@/lib/living";
import { mongoId, produceSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await addProduceListing(user, mongoId.parse(id), produceSchema.parse(await request.json())), 201);
  } catch (error) { return fail(error); }
}
