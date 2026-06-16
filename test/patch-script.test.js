import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parsePatchScript } from "../src/patch-script.js";

test("parses groups and patches with carriage-return line endings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "genos-parse-test-"));
  try {
    const source = path.join(directory, "patches.txt");
    await writeFile(
      source,
      "[g1] Group One\r[p2,0,1,2]Patch One\r[g1] Group Two\r[p2,3,4,5]Patch Two\r",
      "utf8",
    );

    const { groups, patches } = await parsePatchScript(source);

    assert.deepEqual(groups, ["Group One", "Group Two"]);
    assert.equal(patches[0].name, "Patch One");
    assert.equal(patches[0].program, 0);
    assert.equal(patches[0].bankMsb, 1);
    assert.equal(patches[0].bankLsb, 2);
    assert.equal(patches[1].group, "Group Two");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects patches before the first group", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "genos-parse-test-"));
  try {
    const source = path.join(directory, "patches.txt");
    await writeFile(source, "[p2,0,1,2]Patch One\r", "utf8");

    await assert.rejects(parsePatchScript(source), /Patch before first group/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects out-of-range MIDI values", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "genos-parse-test-"));
  try {
    const source = path.join(directory, "patches.txt");
    await writeFile(source, "[g1] Group\r[p2,128,1,2]Patch One\r", "utf8");

    await assert.rejects(parsePatchScript(source), /Out-of-range MIDI value/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
