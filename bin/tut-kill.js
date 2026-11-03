#!/usr/bin/env node
// Stops the background service and every job it started.
import { killService } from "../src/service-client.js";

try {
  const r = await killService();
  if (!r.running) {
    console.log(r.stale ? "No background service was running (old files cleaned up)." : "No background service is running. Nothing to stop.");
  } else {
    console.log(`Stopped the background service (pid ${r.pid}) and ${r.jobs} running job(s).${r.forced ? " It had to be forced." : ""}`);
  }
} catch (e) {
  console.error(`tut-kill: ${e.message}`);
  process.exit(1);
}
