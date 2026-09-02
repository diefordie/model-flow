// /api/v1/auth/signup — auto-confirmed user creation + immediate login.
//
// The default Supabase signup flow returns no session if "Confirm email" is
// enabled in the project's auth settings. Dii's local dev setup has it on,
// so manual FE signup currently dead-ends at "Check your email to confirm…".
// This endpoint bypasses that by admin-creating the user with
// `email_confirm: true`, then signing them in and returning a real session.
//
// Uses ErrorEnvelope codes — maps USER_EXISTS to 409 explicitly (the helper
// only knows the canonical 10 codes).

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { type AuthContext } from "../auth.ts";
import { supabaseAdmin } from "../supabase.ts";
import { validateBody } from "../lib/validate.ts";
import { env } from "../env.ts";

const router = new Hono<AuthContext>();

const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

router.post("/signup", validateBody(signupSchema), async (c) => {
  const { email, password } = c.get("validated" as never) as z.infer<typeof signupSchema>;

  // 1. Admin-create with email_confirm: true → no confirmation email needed.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    // Common: user already exists. Surface a clean code; FE can route to /login.
    const msg = createErr.message ?? "Signup failed";
    if (/already registered|already been registered/i.test(msg)) {
      return c.json(
        { success: false, error: { code: "USER_EXISTS", message: msg } },
        409
      );
    }
    return errorResponse(c, "INTERNAL_ERROR", msg);
  }
  if (!created.user) return errorResponse(c, "INTERNAL_ERROR", "No user returned");

  // 2. Sign them in immediately. Reuse anon-key REST endpoint — service-role
  //    can't mint a user session token.
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await r.json().catch(() => null)) as
    | { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: { id: string; email: string | null } }
    | { msg?: string; error_description?: string; message?: string }
    | null;
  if (!r.ok || !body || !("access_token" in body) || !body.access_token) {
    return errorResponse(c, "INTERNAL_ERROR", body && "msg" in body ? body.msg : "Login after signup failed");
  }

  return c.json({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + body.expires_in,
    user: { id: body.user.id, email: body.user.email },
  }, 201);
});

// /api/v1/auth/signin — credentials login.
//
// FE used to hit Supabase directly via /auth/v1/token?grant_type=password,
// but the FE's runtime config sometimes ships with an empty supabaseUrl
// (env not loaded), which collapses the fetch to a relative URL and Nuxt
// answers with a 404 page. Going through the backend keeps the supabaseUrl
// private and gives a single canonical envelope. Reuses the same anon-key
// REST endpoint that signup uses — service-role can't mint user tokens.
//
// Invalid credentials → 401 INVALID_CREDENTIALS. Anything else → 500.

router.post("/signin", validateBody(signupSchema), async (c) => {
  const { email, password } = c.get("validated" as never) as z.infer<typeof signupSchema>;

  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await r.json().catch(() => null)) as
    | { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: { id: string; email: string | null } }
    | { msg?: string; error_description?: string; message?: string; error?: string }
    | null;
  if (!r.ok || !body || !("access_token" in body) || !body.access_token) {
    if (r.status === 400 || r.status === 401) {
      return c.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        401
      );
    }
    const msg = body && "msg" in body ? body.msg : "Signin failed";
    return errorResponse(c, "INTERNAL_ERROR", msg);
  }

  return c.json({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + body.expires_in,
    user: { id: body.user.id, email: body.user.email },
  });
});

export default router;