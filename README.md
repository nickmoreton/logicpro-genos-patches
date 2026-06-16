# Yamaha Genos Logic Pro Presets

Generate Logic Pro External Instrument plug-in `.pst` presets for Yamaha Genos voices
from the Cubase patch script in `Yamaha Genos.txt`.

The generated `.pst` files are intended to be loaded by Logic Pro's External
Instrument plug-in. Each preset selects a Yamaha Genos voice by storing the
required Bank MSB, Bank LSB, and Program Change values in the plug-in preset.

## Requirements

- Node.js 22 or newer

No npm dependencies are required.

## Generate Presets

```bash
npm run generate-presets -- --clean
```

This reads:

- `Yamaha Genos.txt`
- `template.pst`

and writes:

- `presets/Yamaha Genos`

The generated presets store Bank MSB, Bank LSB, and Program Change values. The MIDI
channel is set to All, and Send Program Change is unchecked.

## Use In Logic Pro

After generating, copy the `presets/Yamaha Genos` folder into Logic Pro's External
Instrument plug-in settings folder:

```text
~/Music/Audio Music Apps/Plug-In Settings/External Instrument/
```

This keeps the generated Genos presets grouped as one instrument folder and leaves
room for other External Instrument preset folders to be added later. The presets
will then be available from the External Instrument plug-in preset menu in Logic Pro.

Example folder structure:

```text
~/Music/Audio Music Apps/Plug-In Settings/External Instrument/
├── Yamaha Genos/
│   ├── Genos Piano/
│   ├── Genos E.Piano/
│   └── ...
├── Another Synth/
└── Another Sound Module/
```

## Options

```bash
npm run generate-presets -- --source "Yamaha Genos.txt" --template template.pst --output "presets/Yamaha Genos" --clean
```

Supported options:

- `--source <path>`: Cubase patch script source. The generator expects a complete
  Yamaha Genos source with 43 groups and 1,711 patches.
- `--template <path>`: Logic `.pst` template file.
- `--output <path>`: output folder.
- `--clean`: remove the output folder before generating.
- `--midi-channel <value>`: `all`, `none`, `preserve`, or `1` through `16`.
  `all` and `none` store Logic's all-channel value. `preserve` leaves the
  template's channel parameter unchanged.

## Tests

```bash
npm test
```
