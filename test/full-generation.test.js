import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  MIDI_CHANNEL_PARAM_ID,
  PROGRAM_PARAM_ID,
  BANK_LSB_PARAM_ID,
  BANK_MSB_PARAM_ID,
  SEND_PROGRAM_CHANGE_PARAM_ID,
  generate,
  paramCount,
  paramOffset,
} from "../src/presets.js";

async function listPresetFiles(root) {
  const results = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".pst")) {
        results.push(path.relative(root, absolutePath));
      }
    }
  }

  await walk(root);
  return results.sort();
}

test("generates the complete Yamaha Genos preset set", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "genos-full-generation-"));
  try {
    await generate({ output: directory, clean: true });

    const files = await listPresetFiles(directory);
    assert.equal(files.length, 1711);

    const cfxConcertGrand = await readFile(
      path.join(directory, "Genos Piano", "S.Art! CFX ConcertGrand.pst"),
    );
    assert.equal(cfxConcertGrand.length, 376);
    assert.equal(paramCount(cfxConcertGrand), 15);
    assert.equal(cfxConcertGrand.readUInt32LE(paramOffset(cfxConcertGrand, MIDI_CHANNEL_PARAM_ID) + 4), 0);
    assert.equal(cfxConcertGrand.readUInt32LE(paramOffset(cfxConcertGrand, SEND_PROGRAM_CHANGE_PARAM_ID) + 4), 0);
    assert.equal(cfxConcertGrand.readUInt32LE(paramOffset(cfxConcertGrand, PROGRAM_PARAM_ID) + 4), 1);
    assert.equal(cfxConcertGrand.readUInt32LE(paramOffset(cfxConcertGrand, BANK_LSB_PARAM_ID) + 4), 22);
    assert.equal(cfxConcertGrand.readUInt32LE(paramOffset(cfxConcertGrand, BANK_MSB_PARAM_ID) + 4), 105);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
