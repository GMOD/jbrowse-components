---
title: Theming
description: Customizing JBrowse colors and theme via config
guide_category: Getting started
---

JBrowse uses [MUI theming](https://mui.com/material-ui/customization/theming/)
with additional custom palette properties. The theme is configured via the
`configuration.theme` field in your JBrowse config.

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
| `tertiary`        | PaletteColor   | `#135560` (forest)         | Accordion headers, some toolbar chrome |
| `quaternary`      | PaletteColor   | `#FFB11D` (mandarin)       | FAB secondary background               |
| `highlight`       | PaletteColor   | `#FFB11D` (mandarin)       | Selection highlights                   |
| `coverage`        | `string`       | `grey[400]`                | Coverage track fill                    |
| `insertion`       | `string`       | `#800080`                  | Insertion markers in alignments        |
| `deletion`        | `string`       | `#808080`                  | Deletion markers in alignments         |
| `softclip`        | `string`       | `#00f`                     | Soft-clipped bases                     |
| `hardclip`        | `string`       | `#f00`                     | Hard-clipped bases                     |
| `skip`            | `string`       | `#009a8a`                  | Skipped regions (introns)              |
| `modificationFwd` | `string`       | `#c8c8c8`                  | Base modifications, forward strand     |
| `modificationRev` | `string`       | `#c8dcc8`                  | Base modifications, reverse strand     |
| `mutedSnpBase`    | `string`       | `#888`                     | Low-frequency SNP bases                |
| `startCodon`      | `string`       | `#3e3`                     | Start codon in gene/CDS tracks         |
| `stopCodon`       | `string`       | `#e22`                     | Stop codon in gene/CDS tracks          |
| `bases.A`         | PaletteColor   | green                      | Adenine                                |
| `bases.C`         | PaletteColor   | blue                       | Cytosine                               |
| `bases.G`         | PaletteColor   | orange                     | Guanine                                |
| `bases.T`         | PaletteColor   | red                        | Thymine                                |
| `frames[1..6]`    | PaletteColor[] | grey shades                | Reading frame coloring (non-CDS)       |
| `framesCDS[1..6]` | PaletteColor[] | red/green/blue alternating | Reading frame coloring (CDS)           |

## Exported color constants

Some colors are used in RPC workers (no MUI theme context) and are exported as
plain constants from `@jbrowse/core/ui/theme`:

```ts
import {
  methylated5mC, // '#ff0000'
  unmethylated5mC, // '#0000ff'
  methylated5hmC, // '#ffc0cb'
  unmethylated5hmC, // '#800080'
} from '@jbrowse/core/ui/theme'
```

Use these constants directly; do not re-derive them from `theme.palette` in
worker code.

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
