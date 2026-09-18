import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, data: null, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Please check the submitted fields.", details: error.flatten() },
      },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500 },
  );
}

export const pageSize = (value: string | null, defaultSize = 20, maximum = 50) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : defaultSize;
};
