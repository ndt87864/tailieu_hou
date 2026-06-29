import { supabaseAdmin } from "../config/db.js";

let isProcessing = false;
let workerInterval: NodeJS.Timeout | null = null;

/**
 * Executes a batch of registrations from the queue.
 */
async function processQueueBatch() {
  try {
    // Call the database function to process a batch of 50 items
    const { data: processedCount, error } = await supabaseAdmin.rpc(
      "process_registration_queue_batch",
      { batch_size: 50 }
    );

    if (error) {
      console.error("Error invoking process_registration_queue_batch RPC:", error);
      return;
    }

    if (processedCount && Number(processedCount) > 0) {
      console.log(`[Queue Worker] Processed ${processedCount} pending registrations.`);
    }
  } catch (err) {
    console.error("[Queue Worker] Unexpected error:", err);
  }
}

/**
 * Starts the background queue worker.
 */
export function startRegistrationQueueWorker() {
  if (workerInterval) {
    console.warn("[Queue Worker] Worker is already running.");
    return;
  }

  console.log("🚀 Starting Registration Queue Worker (interval: 2000ms)...");

  workerInterval = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await processQueueBatch();
    } finally {
      isProcessing = false;
    }
  }, 2000);
}

/**
 * Stops the background queue worker.
 */
export function stopRegistrationQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("🛑 Stopped Registration Queue Worker.");
  }
}
