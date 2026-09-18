import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createReport } from "@/lib/community";
import { reportSchema } from "@/lib/validation";

export async function POST(request: NextRequest) { try { return ok(await createReport(await requireUser(request), reportSchema.parse(await request.json())), 201); } catch (error) { return fail(error); } }
