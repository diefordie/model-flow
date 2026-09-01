// Generic zod body validator middleware. Returns the validated value on
// success; a 400 VALIDATION_ERROR envelope on failure.
//
// We stash the parsed value at `c.get("validated")` — typed at the call site
// via `c.get("validated" as never) as z.infer<typeof schema>`. The `as never`
// cast is the smallest ergonomic escape hatch for Hono's strict Variables
// generics. The zod schema is the single source of truth for the shape.

import type { MiddlewareHandler, Context } from "hono";
import { z, type ZodTypeAny } from "zod";
import { errorResponse } from "../errors.ts";

export function validateBody<S extends ZodTypeAny>(schema: S) {
  type Out = z.infer<S>;
  const mw: MiddlewareHandler = async (c: Context, next) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("; "),
        400
      );
    }
    // Stash on the context with a runtime key; type at the call site.
    (c as unknown as { set: (k: string, v: unknown) => void }).set("validated", parsed.data as Out);
    await next();
    return;
  };
  return mw;
}