// Insert into the experiment_jobs queue. The worker (apps/worker) uses
// `for update skip locked` to claim jobs — see supabase/migrations/0001_init.sql.
//
// The queue table's RLS policy denies all writes from authenticated users
// (only the service-role client can insert). So this helper takes the
// service-role client explicitly — never the per-request client.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobType = "profiling" | "training";

export interface EnqueueJobInput {
  type: JobType;
  experiment_id?: number;
  dataset_id?: number;
  payload?: Record<string, unknown>;
}

export async function enqueueJob(
  supabaseAdmin: SupabaseClient,
  input: EnqueueJobInput
): Promise<void> {
  const { error } = await supabaseAdmin.from("experiment_jobs").insert({
    type: input.type,
    status: "queued",
    experiment_id: input.experiment_id ?? null,
    dataset_id: input.dataset_id ?? null,
    payload: input.payload ?? {},
  });
  if (error) {
    // Queue insert failure must surface — losing a job silently is a worse
    // outcome than failing the parent request.
    throw new Error(`enqueue failed: ${error.message}`);
  }
}