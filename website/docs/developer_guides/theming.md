---
title: Theming
description: Customizing JBrowse colors and theme via config
guide_category: Getting started
---

JBrowse uses [MUI theming](https://mui.com/material-ui/customization/theming/)
with additional custom palette properties. The theme is configured via the
`configuration.theme` field in your JBrowse config. For an end-user walkthrough
of changing colors, dark mode, the logo, and sizing, see the
[Coloring/theming config guide](/docs/config_guides/theme).

## Built-in themes

Set `configuration.theme` to one of these names:

- `default` — uses config-supplied colors merged with stock defaults
- `lightStock` — light mode with stock JBrowse palette
- `lightMinimal` — light mode with greyscale chrome
- `darkStock` — dark mode with stock palette
- `darkMinimal` — dark mode with greyscale chrome

## Custom palette properties

These extend MUI's standard `primary`/`secondary`/`error`/etc:

| Key               | Type           | Default                    | Used for                               |
| ----------------- | -------------- | -------------------------- | -------------------------------------- |
| `tertiary`        | PaletteColor   | forest teal                | Accordion headers, some toolbar chrome |
| `quaternary`      | PaletteColor   | mandarin gold              | FAB secondary background               |
| `highlight`       | PaletteColor   | mandarin gold              | Selection highlights                   |
| `coverage`        | `string`       | grey                       | Coverage track fill                    |
| `insertion`       | `string`       | purple                     | Insertion markers in alignments        |
| `deletion`        | `string`       | grey                       | Deletion markers in alignments         |
| `softclip`        | `string`       | blue                       | Soft-clipped bases                     |
| `hardclip`        | `string`       | red                        | Hard-clipped bases                     |
| `skip`            | `string`       | teal                       | Skipped regions (introns)              |
| `modificationFwd` | `string`       | light grey                 | Base modifications, forward strand     |
| `modificationRev` | `string`       | pale green                 | Base modifications, reverse strand     |
| `mutedSnpBase`    | `string`       | grey                       | Low-frequency SNP bases                |
| `startCodon`      | `string`       | green                      | Start codon in gene/CDS tracks         |
| `stopCodon`       | `string`       | red                        | Stop codon in gene/CDS tracks          |
| `bases.A`         | PaletteColor   | green                      | Adenine                                |
| `bases.C`         | PaletteColor   | blue                       | Cytosine                               |
| `bases.G`         | PaletteColor   | orange                     | Guanine                                |
| `bases.T`         | PaletteColor   | red                        | Thymine                                |
| `frames[1..6]`    | PaletteColor[] | grey shades                | Reading frame coloring (non-CDS)       |
| `framesCDS[1..6]` | PaletteColor[] | red/green/blue alternating | Reading frame coloring (CDS)           |

The exact hex values for the `string`-valued feature colors are shown in the
swatch table below, generated from the `#color`-tagged definitions in `theme.ts`
so they never drift from the code (the `insertion`/`softclip`/`hardclip`
indicators are tagged there too, under a separate `alignments-indicators`
group):

<!-- COLOR_TABLE theme-colors START -->

| Color                                                                                                                                                                       | Name                    | Value     | Description                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------- | ------------------------------------------------------ |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#e22;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#e22"></span>       | Stop codon              | `#e22`    | Stop codon in gene/CDS tracks                          |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#3e3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#3e3"></span>       | Start codon             | `#3e3`    | Start codon in gene/CDS tracks                         |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#808080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#808080"></span> | Deletion                | `#808080` | Deletion markers in alignments                         |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#009a8a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#009a8a"></span> | Skip (intron)           | `#009a8a` | Skipped regions such as introns in RNA-seq reads       |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#c8c8c8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#c8c8c8"></span> | Base modification (fwd) | `#c8c8c8` | Base modifications on the forward strand               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#c8dcc8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#c8dcc8"></span> | Base modification (rev) | `#c8dcc8` | Base modifications on the reverse strand               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#888;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#888"></span>       | Muted SNP base          | `#888`    | SNP bases muted when show-modifications coloring is on |

<!-- COLOR_TABLE theme-colors END -->

## Exported color constants

Some colors are used in RPC workers (no MUI theme context) and are exported as
plain constants from `@jbrowse/core/ui/theme`:

```ts
import {
  methylated5mC,
  unmethylated5mC,
  methylated5hmC,
  unmethylated5hmC,
} from '@jbrowse/core/ui/theme'
```

<!-- COLOR_TABLE theme-methylation START -->

| Color                                                                                                                                                                       | Name             | Value     | Description                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------- | ------------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | methylated5mC    | `#ff0000` | 5-methylcytosine, methylated          |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0000ff;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0000ff"></span> | unmethylated5mC  | `#0000ff` | 5-methylcytosine, unmethylated        |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ffc0cb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ffc0cb"></span> | methylated5hmC   | `#ffc0cb` | 5-hydroxymethylcytosine, methylated   |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#800080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#800080"></span> | unmethylated5hmC | `#800080` | 5-hydroxymethylcytosine, unmethylated |

<!-- COLOR_TABLE theme-methylation END -->

Use these constants directly; do not re-derive them from `theme.palette` in
worker code. The table above is generated from the `#color`-tagged definitions
in `theme.ts`, so it never drifts from the actual values.

## Example config

```json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": { "main": "#311b92" },
        "secondary": { "main": "#0097a7" },
        "tertiary": { "main": "#f57c00" },
        "quaternary": { "main": "#d4ac0d" }
      }
    }
  }
}
```

`primary`/`secondary`/`tertiary`/`quaternary`/`highlight` accept either a full
MUI `PaletteColorOptions` object or just `{ "main": "<hex>" }` — light/dark
variants are derived automatically.

## Adding theme colors in plugins

Colors only used in React components belong in the `Palette` / `PaletteOptions`
module augmentation and `addMissingColors` in `theme.ts`. Follow the existing
`modificationFwd` / `modificationRev` pattern.

Colors shared with worker code must be exported as plain `const` strings from
`theme.ts`; never thread them through `theme.palette` to reach worker code.

## See also

- [Coloring/theming](/docs/config_guides/theme) — the end-user walkthrough for
  changing colors, dark mode, the logo, and sizing via config
- [Writing a plugin](/docs/developer_guides/simple_plugin) — where a plugin
  would register the palette augmentation described above
- [Renderer architecture](/docs/developer_guides/renderer_architecture) and
  [RPC and worker system](/docs/developer_guides/rpc_workers) — why worker code
  has no MUI theme context, motivating the plain-constant color exports
