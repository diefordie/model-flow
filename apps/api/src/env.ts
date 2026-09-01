// Centralised, validated env. Fail fast at boot if anything required is missing.
// Loaded once by index.ts; everything else imports `env` from here.

import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_DATASETS: z.string().default("datasets"),
  SUPABASE_STORAGE_BUCKET_MODELS: z.string().default("models"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WORKER_CALLBACK_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[env] invalid environment:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();