import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parsePatchScript } from "./patch-script.js";

export const DEFAULT_SOURCE = "Yamaha Genos.txt";
export const DEFAULT_TEMPLATE = "template.pst";
export const DEFAULT_OUTPUT = path.join("presets", "Yamaha Genos");
export const DEFAULT_MIDI_CHANNEL = "all";

export const EXPECTED_TEMPLATE_SIZE = 376;
export const EXPECTED_GROUP_COUNT = 43;
export const EXPECTED_PATCH_COUNT = 1711;

export const FILE_SIZE_OFFSET = 0x0000;
export const PARAM_COUNT_OFFSET = 0x0008;
export const PARAM_TABLE_OFFSET = 0x00a0;
export const PARAM_PAIR_SIZE = 8;
export const CHANNELLESS_TEMPLATE_SIZE = EXPECTED_TEMPLATE_SIZE - PARAM_PAIR_SIZE;
export const MIDI_CHANNEL_PARAM_ID = 2;
export const PROGRAM_PARAM_ID = 12;
export const BANK_LSB_PARAM_ID = 13;
export const BANK_MSB_PARAM_ID = 14;
export const SEND_PROGRAM_CHANGE_PARAM_ID = 11;

const UNSAFE_FILENAME_CHARS = /[\\:*?"<>|\x00-\x1f]/g;

export function sanitizePathComponent(value) {
  const sanitized = value.replace(UNSAFE_FILENAME_CHARS, "_").trim().replaceAll("/", "_");
  return sanitized.replace(/[. ]+$/g, "") || "Untitled";
}

export function parseMidiChannel(value) {
  const normalized = String(value).toLowerCase();
  if (normalized === "preserve") {
    return "preserve";
  }
  if (normalized === "all" || normalized === "none") {
    return 0;
  }

  const channel = Number(value);
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
    throw new Error("MIDI channel must be 'preserve', 'all', 'none', or a number from 1 to 16");
  }
  return channel;
}

export function paramCount(data) {
  return data.readUInt32LE(PARAM_COUNT_OFFSET);
}

export function paramOffset(data, paramId) {
  for (let index = 0; index < paramCount(data); index += 1) {
    const offset = PARAM_TABLE_OFFSET + index * PARAM_PAIR_SIZE;
    if (data.readUInt32LE(offset) === paramId) {
      return offset;
    }
  }
  throw new Error(`Parameter ${paramId} not found in template`);
}

export function hasParam(data, paramId) {
  try {
    paramOffset(data, paramId);
  } catch {
    return false;
  }
  return true;
}

export function setParam(data, paramId, value) {
  data.writeUInt32LE(value, paramOffset(data, paramId) + 4);
}

export function insertParamAfter(data, afterParamId, paramId, value) {
  const offset = hasParam(data, afterParamId)
    ? paramOffset(data, afterParamId) + PARAM_PAIR_SIZE
    : PARAM_TABLE_OFFSET;
  const inserted = Buffer.alloc(PARAM_PAIR_SIZE);
  inserted.writeUInt32LE(paramId, 0);
  inserted.writeUInt32LE(value, 4);
  const output = Buffer.concat([data.subarray(0, offset), inserted, data.subarray(offset)]);
  output.writeUInt32LE(paramCount(data) + 1, PARAM_COUNT_OFFSET);
  output.writeUInt32LE(output.length, FILE_SIZE_OFFSET);
  return output;
}

export function removeParam(data, paramId) {
  const offset = paramOffset(data, paramId);
  const output = Buffer.concat([
    data.subarray(0, offset),
    data.subarray(offset + PARAM_PAIR_SIZE),
  ]);
  output.writeUInt32LE(paramCount(data) - 1, PARAM_COUNT_OFFSET);
  output.writeUInt32LE(output.length, FILE_SIZE_OFFSET);
  return output;
}

export function presetPath(outputDirectory, patch, usedPaths) {
  const groupParts = patch.group.split("/").map(sanitizePathComponent);
  const baseDirectory = path.join(outputDirectory, ...groupParts);
  const filenameStem = sanitizePathComponent(patch.name);
  let candidate = path.join(baseDirectory, `${filenameStem}.pst`);
  let suffix = 2;

  while (usedPaths.has(candidate)) {
    candidate = path.join(baseDirectory, `${filenameStem} (${suffix}).pst`);
    suffix += 1;
  }

  usedPaths.add(candidate);
  return candidate;
}

export function buildPreset(template, patch, midiChannel) {
  let data = Buffer.from(template);
  if (midiChannel === "preserve") {
    // Keep the template channel setting exactly as-is.
  } else if (hasParam(data, MIDI_CHANNEL_PARAM_ID)) {
    setParam(data, MIDI_CHANNEL_PARAM_ID, midiChannel);
  } else {
    data = insertParamAfter(data, 1, MIDI_CHANNEL_PARAM_ID, midiChannel);
  }

  setParam(data, PROGRAM_PARAM_ID, patch.program + 1);
  setParam(data, BANK_LSB_PARAM_ID, patch.bankLsb + 1);
  setParam(data, BANK_MSB_PARAM_ID, patch.bankMsb + 1);
  if (hasParam(data, SEND_PROGRAM_CHANGE_PARAM_ID)) {
    setParam(data, SEND_PROGRAM_CHANGE_PARAM_ID, 0);
  }
  return data;
}

export async function generate({
  source = DEFAULT_SOURCE,
  template = DEFAULT_TEMPLATE,
  output = DEFAULT_OUTPUT,
  midiChannel = parseMidiChannel(DEFAULT_MIDI_CHANNEL),
  clean = false,
  expectedGroupCount = EXPECTED_GROUP_COUNT,
  expectedPatchCount = EXPECTED_PATCH_COUNT,
} = {}) {
  const { groups, patches } = await parsePatchScript(source);
  if (groups.length !== expectedGroupCount) {
    throw new Error(`Expected ${expectedGroupCount} groups, found ${groups.length}`);
  }
  if (patches.length !== expectedPatchCount) {
    throw new Error(`Expected ${expectedPatchCount} patches, found ${patches.length}`);
  }

  const templateData = await readFile(template);
  if (![EXPECTED_TEMPLATE_SIZE, CHANNELLESS_TEMPLATE_SIZE].includes(templateData.length)) {
    throw new Error(
      `Expected ${EXPECTED_TEMPLATE_SIZE}- or ${CHANNELLESS_TEMPLATE_SIZE}-byte template, found ${templateData.length} bytes`,
    );
  }
  if (clean) {
    await rm(output, { recursive: true, force: true });
  }

  const usedPaths = new Set();
  for (const patch of patches) {
    const outputPath = presetPath(output, patch, usedPaths);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buildPreset(templateData, patch, midiChannel));
  }

  return { groups, patches };
}
