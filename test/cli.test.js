import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("CLI rejects missing option values", async () => {
  await assert.rejects(
    execFileAsync("node", ["src/generate-presets.js", "--source"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Missing value for --source/);
      return true;
    },
  );
});

test("CLI rejects option values that are another option", async () => {
  await assert.rejects(
    execFileAsync("node", ["src/generate-presets.js", "--source", "--clean"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Missing value for --source/);
      return true;
    },
  );
});
