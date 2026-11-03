#!/usr/bin/env node
// Internal: the background service process. Started by `tut`; stopped by `tut-kill`.
import { runService } from "../src/service.js";

runService().catch((e) => {
  console.error(`tut-service: ${e.message}`);
  process.exit(1);
});
