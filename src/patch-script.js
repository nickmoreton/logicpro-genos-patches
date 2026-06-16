import { readFile } from "node:fs/promises";

const GROUP_RE = /^\[g1\]\s*(.+?)\s*$/;
const PATCH_RE = /^\[p2,(\d+),(\d+),(\d+)\](.+?)\s*$/;

export async function parsePatchScript(path) {
  const text = await readFile(path, "utf8");
  const groups = [];
  const patches = [];
  let currentGroup = null;

  text.split(/\r\n|\n|\r/).forEach((line, index) => {
    const groupMatch = GROUP_RE.exec(line);
    if (groupMatch) {
      currentGroup = groupMatch[1];
      groups.push(currentGroup);
      return;
    }

    const patchMatch = PATCH_RE.exec(line);
    if (!patchMatch) {
      return;
    }

    if (currentGroup === null) {
      throw new Error(`Patch before first group at line ${index + 1}: ${JSON.stringify(line)}`);
    }

    const program = Number(patchMatch[1]);
    const bankMsb = Number(patchMatch[2]);
    const bankLsb = Number(patchMatch[3]);
    if (![program, bankMsb, bankLsb].every((value) => value >= 0 && value <= 127)) {
      throw new Error(`Out-of-range MIDI value at line ${index + 1}: ${JSON.stringify(line)}`);
    }

    patches.push({
      group: currentGroup,
      program,
      bankMsb,
      bankLsb,
      name: patchMatch[4],
    });
  });

  return { groups, patches };
}
