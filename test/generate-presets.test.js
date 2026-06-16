import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  BANK_LSB_PARAM_ID,
  BANK_MSB_PARAM_ID,
  DEFAULT_OUTPUT,
  DEFAULT_TEMPLATE,
  EXPECTED_TEMPLATE_SIZE,
  MIDI_CHANNEL_PARAM_ID,
  PARAM_COUNT_OFFSET,
  PARAM_PAIR_SIZE,
  PARAM_TABLE_OFFSET,
  PROGRAM_PARAM_ID,
  SEND_PROGRAM_CHANGE_PARAM_ID,
  generate,
  paramCount,
  paramOffset,
} from "../src/presets.js";

function templateBytes() {
  const data = Buffer.alloc(EXPECTED_TEMPLATE_SIZE);
  data.writeUInt32LE(data.length, 0);
  const params = [
    [MIDI_CHANNEL_PARAM_ID, 1],
    [SEND_PROGRAM_CHANGE_PARAM_ID, 1],
    [PROGRAM_PARAM_ID, 1],
    [BANK_LSB_PARAM_ID, 1],
    [BANK_MSB_PARAM_ID, 1],
  ];
  data.writeUInt32LE(params.length, PARAM_COUNT_OFFSET);
  params.forEach(([paramId, value], index) => {
    const offset = PARAM_TABLE_OFFSET + index * PARAM_PAIR_SIZE;
    data.writeUInt32LE(paramId, offset);
    data.writeUInt32LE(value, offset + 4);
  });
  return data;
}

function templateWithoutChannelBytes() {
  const source = templateBytes();
  const output = Buffer.concat([
    source.subarray(0, PARAM_TABLE_OFFSET),
    source.subarray(PARAM_TABLE_OFFSET + PARAM_PAIR_SIZE),
  ]);
  output.writeUInt32LE(output.length, 0);
  output.writeUInt32LE(4, PARAM_COUNT_OFFSET);
  return output;
}

async function withTempDir(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "genos-node-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("defaults use project-local template and short output path", () => {
  assert.equal(DEFAULT_TEMPLATE, "template.pst");
  assert.equal(DEFAULT_OUTPUT, path.join("presets", "Yamaha Genos"));
});

test("clean removes stale presets before generating", async () => {
  await withTempDir(async (directory) => {
    const source = path.join(directory, "patches.txt");
    const template = path.join(directory, "template.pst");
    const output = path.join(directory, "out");
    const stale = path.join(output, "Old Group", "Old Patch.pst");

    await writeFile(source, "[g1] Group\n[p2,0,1,2]Patch\n", "utf8");
    await writeFile(template, templateBytes());
    await mkdir(path.dirname(stale), { recursive: true });
    await writeFile(stale, "stale");

    await generate({
      source,
      template,
      output,
      midiChannel: null,
      clean: true,
      expectedGroupCount: 1,
      expectedPatchCount: 1,
    });

    await assert.rejects(readFile(stale), { code: "ENOENT" });
    assert.ok(await readFile(path.join(output, "Group", "Patch.pst")));
  });
});

test("midi channel is reinserted when template omits it", async () => {
  await withTempDir(async (directory) => {
    const source = path.join(directory, "patches.txt");
    const template = path.join(directory, "template.pst");
    const output = path.join(directory, "out");

    await writeFile(source, "[g1] Group\n[p2,0,1,2]Patch\n", "utf8");
    await writeFile(template, templateWithoutChannelBytes());

    await generate({
      source,
      template,
      output,
      midiChannel: 0,
      expectedGroupCount: 1,
      expectedPatchCount: 1,
    });

    const data = await readFile(path.join(output, "Group", "Patch.pst"));
    assert.equal(data.length, EXPECTED_TEMPLATE_SIZE);
    assert.equal(paramCount(data), 5);
    assert.equal(paramOffset(data, MIDI_CHANNEL_PARAM_ID), PARAM_TABLE_OFFSET);
  });
});

test("preserve leaves the template midi channel setting unchanged", async () => {
  await withTempDir(async (directory) => {
    const source = path.join(directory, "patches.txt");
    const template = path.join(directory, "template.pst");
    const output = path.join(directory, "out");

    await writeFile(source, "[g1] Group\n[p2,0,1,2]Patch\n", "utf8");
    const templateData = templateBytes();
    templateData.writeUInt32LE(7, PARAM_TABLE_OFFSET + 4);
    await writeFile(template, templateData);

    await generate({
      source,
      template,
      output,
      midiChannel: "preserve",
      expectedGroupCount: 1,
      expectedPatchCount: 1,
    });

    const data = await readFile(path.join(output, "Group", "Patch.pst"));
    assert.equal(data.length, EXPECTED_TEMPLATE_SIZE);
    assert.equal(data.readUInt32LE(paramOffset(data, MIDI_CHANNEL_PARAM_ID) + 4), 7);
  });
});

test("send program change is unchecked while patch values are set", async () => {
  await withTempDir(async (directory) => {
    const source = path.join(directory, "patches.txt");
    const template = path.join(directory, "template.pst");
    const output = path.join(directory, "out");

    await writeFile(source, "[g1] Group\n[p2,0,1,2]Patch\n", "utf8");
    await writeFile(template, templateBytes());

    await generate({
      source,
      template,
      output,
      midiChannel: 0,
      expectedGroupCount: 1,
      expectedPatchCount: 1,
    });

    const data = await readFile(path.join(output, "Group", "Patch.pst"));
    assert.equal(data.readUInt32LE(paramOffset(data, SEND_PROGRAM_CHANGE_PARAM_ID) + 4), 0);
    assert.equal(data.readUInt32LE(paramOffset(data, PROGRAM_PARAM_ID) + 4), 1);
    assert.equal(data.readUInt32LE(paramOffset(data, BANK_LSB_PARAM_ID) + 4), 3);
    assert.equal(data.readUInt32LE(paramOffset(data, BANK_MSB_PARAM_ID) + 4), 2);
  });
});
