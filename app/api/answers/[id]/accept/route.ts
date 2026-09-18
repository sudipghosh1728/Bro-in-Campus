import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { acceptAnswer } from "@/lib/community";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) { try { const { id } = await context.params; return ok(await acceptAnswer(await requireUser(request), id)); } catch (error) { return fail(error); } }
