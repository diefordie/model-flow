// Standard error envelope per PRD §4.7.
// All routes funnel failures through `errorResponse(code, message, status)`.

import type { Context } from "hono";
import type { ErrorCode, ErrorEnvelope } from "@model-flow/shared";

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Request validation failed.",
  INVALID_DATASET: "Dataset content or schema is invalid.",
  UNSUPPORTED_FILE: "File type is not supported.",
  FILE_TOO_LARGE: "File exceeds the configured size limit.",
  INVALID_CONFIGURATION: "Pipeline or model configuration is invalid.",
  TRAINING_FAILED: "Training job failed.",
  MODEL_ERROR: "Could not load or use the trained model.",
  DATA_PROCESSING_ERROR: "Failed to process dataset.",
  NOT_FOUND: "Resource not found.",
  UNAUTHORIZED: "Authentication required.",
  FORBIDDEN: "You do not have access to this resource.",
  INTERNAL_ERROR: "Internal server error.",
};

export function errorResponse(
  c: Context,
  code: ErrorCode,
  message?: string,
  status?: number
) {
  const statusByCode: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    INVALID_DATASET: 400,
    UNSUPPORTED_FILE: 415,
    FILE_TOO_LARGE: 413,
    INVALID_CONFIGURATION: 400,
    TRAINING_FAILED: 422,
    MODEL_ERROR: 500,
    DATA_PROCESSING_ERROR: 500,
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    INTERNAL_ERROR: 500,
  };
  const body: ErrorEnvelope = {
    success: false,
    error: { code, message: message ?? MESSAGES[code] },
  };
  return c.json(body, (status ?? statusByCode[code]) as 400);
}