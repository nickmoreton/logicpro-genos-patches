#!/usr/bin/env node

import {
  DEFAULT_MIDI_CHANNEL,
  DEFAULT_OUTPUT,
  DEFAULT_SOURCE,
  DEFAULT_TEMPLATE,
  generate,
  parseMidiChannel,
} from "./presets.js";

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    template: DEFAULT_TEMPLATE,
    output: DEFAULT_OUTPUT,
    midiChannel: parseMidiChannel(DEFAULT_MIDI_CHANNEL),
    clean: false,
  };

  function readOptionValue(optionName) {
    const value = argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return value;
  }

  let index = 0;
  for (; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "--source") {
      options.source = readOptionValue(arg);
    } else if (arg === "--template") {
      options.template = readOptionValue(arg);
    } else if (arg === "--output") {
      options.output = readOptionValue(arg);
    } else if (arg === "--midi-channel") {
      options.midiChannel = parseMidiChannel(readOptionValue(arg));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const { groups, patches } = await generate(options);
  console.log(`Generated ${patches.length} presets in ${options.output}`);
  console.log(`Parsed ${groups.length} groups from ${options.source}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
