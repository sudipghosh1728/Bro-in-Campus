import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toggleOpportunitySave } from "@/lib/campus";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await toggleOpportunitySave(await requireUser(request), (await params).id, true));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await toggleOpportunitySave(await requireUser(request), (await params).id, false));
  } catch (error) {
    return fail(error);
  }
}
