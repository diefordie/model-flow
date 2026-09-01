// Hono middleware: validate the Bearer JWT and attach the user to context.
// Uses supabaseAdmin.auth.getUser(jwt) — signature-verified, no extra secret needed.

import type { Context, MiddlewareHandler } from "hono";
import { supabaseAdmin, supabaseForRequest, type SupabaseClient } from "./supabase.ts";
import { errorResponse } from "./errors.ts";

// Re-export so routes can import supabaseAdmin alongside auth helpers.
export { supabaseAdmin };

export type AuthUser = { id: string; email: string | null };

export type AuthContext = {
  Variables: { user: AuthUser; jwt: string };
};

export const requireAuth: MiddlewareHandler<AuthContext> = async (c, next) => {
  const authHeader = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return errorResponse(c, "UNAUTHORIZED", "Missing bearer token");

  const jwt = match[1]!;
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) {
    return errorResponse(c, "UNAUTHORIZED", "Invalid or expired token");
  }
  c.set("user", { id: data.user.id, email: data.user.email ?? null });
  c.set("jwt", jwt);
  await next();
};

// Per-request client — applies RLS as the calling user.
export function requestClient(c: Context<AuthContext>): SupabaseClient {
  return supabaseForRequest(c.get("jwt"));
}