#!/usr/bin/env node
// serif-brain — bagimsiz proje hafiza CLI
// Kullanim: serif-brain <komut> [opsiyonlar]

process.removeAllListeners("warning");

import { run } from "../src/cli/index.mjs";

run(process.argv.slice(2))
  .then((code) => process.exit(typeof code === "number" ? code : 0))
  .catch((err) => {
    console.error(`\n[serif-brain] HATA: ${err.message}`);
    if (process.env.SERIF_BRAIN_DEBUG) console.error(err.stack);
    process.exit(1);
  });
