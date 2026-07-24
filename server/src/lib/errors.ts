// server/src/lib/errors.ts
import type { ApiErrorBody } from "../../../shared/types";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, "BAD_REQUEST", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class UpstreamError extends ApiError {
  constructor(source: string, detail: string) {
    super(502, "UPSTREAM_ERROR", `${source}: ${detail}`);
  }
}

// v1.4: SIWE auth errors.
export class UnauthorizedError extends ApiError {
  constructor(message = "authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "not the resource owner") {
    super(403, "FORBIDDEN", message);
  }
}

export function toErrorBody(message: string, code: string): ApiErrorBody {
  return { error: message, code, ts: Date.now() };
}
