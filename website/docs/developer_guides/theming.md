---
title: Theming
description: Customizing JBrowse colors and theme via config
guide_category: Advanced topics
---

**TL;DR:** JBrowse extends
[MUI theming](https://mui.com/material-ui/customization/theming/) with custom
palette properties, set via the `configuration.theme` field. For an end-user
walkthrough of colors, dark mode, the logo, and sizing, see the
[Coloring/theming config guide](/docs/config_guides/theme).

## Built-in themes

Set `configuration.theme` to one of these names:

- `default` - uses config-supplied colors merged with stock defaults
- `lightStock` - light mode with stock JBrowse palette
- `lightMinimal` - light mode with greyscale chrome
- `darkStock` - dark mode with stock palette
- `darkMinimal` - dark mode with greyscale chrome

## Custom palette properties

These extend MUI's standard `primary`/`secondary`/`error`/etc. Every key below
is optional in a config theme; anything you don't set keeps its preset value.

<!-- PALETTE_KEYS START -->

<!-- prettier-ignore -->
| Key | Type | Used for |
| --- | --- | --- |
| `stopCodon` | `string` | Stop codon in gene/CDS tracks |
| `startCodon` | `string` | Start codon in gene/CDS tracks |
| `codonNonsynonymous` | `string` | MAF codon view: the species' amino acid differs from the reference |
| `codonSynonymous` | `string` | MAF codon view: the codon differs but the amino acid does not |
| `codonStop` | `string` | MAF codon view: a stop codon |
| `coverage` | `string` | Coverage histogram fill |
| `insertion` | `string` | Insertion markers in alignments |
| `softclip` | `string` | Soft-clipped bases (clipped bases retained in the read) |
| `skip` | `string` | Skipped regions, such as introns in RNA-seq reads |
| `hardclip` | `string` | Hard-clipped bases (clipped bases removed from the read) |
| `deletion` | `string` | Deletion markers in alignments |
| `readOverlap` | `string` | Span where two segments of one molecule both align (view-as-pairs / chains) |
| `modificationFwd` | `string` | Base modifications on the forward strand |
| `modificationRev` | `string` | Base modifications on the reverse strand |
| `mutedSnpBase` | `string` | SNP bases muted when show-modifications coloring is on |
| `missingData` | `string` | MAF bridged-row fill where a species has no alignment |
| `gridlineMinor` | `string` | Minor vertical gridlines behind the genome |
| `gridlineMajor` | `string` | Major vertical gridlines behind the genome |
| `plotGridlineMinor` | `string` | Minor coordinate gridlines inside a plot area, e.g. the dotplot's. Lighter than the genome gridlines above: a 2D grid crosses itself, so it lays down far more ink at the same alpha than one running behind a linear genome |
| `plotGridlineMajor` | `string` | Major coordinate gridlines inside a plot area. See plotGridlineMinor |
| `regionBoundary` | `string` | Line marking a chromosome or region boundary, well above both plot gridline weights: it is the landmark the coordinates hang off, so it has to stay readable as a boundary on a plot that also draws a full grid |
| `featureHover` | `string` | Hover shading over a single feature |
| `featureHoverStrong` | `string` | Hover shading over a feature group, e.g. a linked-read chain |
| `featureSelected` | `string` | Border accent around the click-selected feature |
| `featureDescription` | `string` | Feature description labels, e.g. gene descriptions |
| `tertiary` | `PaletteColor` | Accordion headers and some toolbar chrome |
| `quaternary` | `PaletteColor` | Secondary floating-action-button background |
| `highlight` | `PaletteColor` | Selection highlights |
| `textHighlight` | `PaletteColor` | Text-match highlight behind search hits |
| `bases` | `object` | Per-base colors for sequence and SNP rendering |
| `bases.A` | `PaletteColor` | Adenine |
| `bases.C` | `PaletteColor` | Cytosine |
| `bases.G` | `PaletteColor` | Guanine |
| `bases.T` | `PaletteColor` | Thymine |
| `bases.N` | `PaletteColor` | N / ambiguous base |
| `frames` | `Frames` | Reading-frame coloring outside CDS, indexed 1..3 and -1..-3 |
| `framesCDS` | `Frames` | Reading-frame coloring within CDS, indexed 1..3 and -1..-3 |
| `alignmentFill` | `AlignmentFill` | Read fill by pair orientation, when coloring alignments by pair |

<!-- PALETTE_KEYS END -->

The `frames` / `framesCDS` tuples are indexed by reading frame — `1`/`2`/`3`
forward and `-1`/`-2`/`-3` reverse, which is why slot 0 is unused.

Defaults for the `string`-valued feature colors, generated from the
`#color`-tagged definitions in `packages/core/src/ui/palette.ts` (the
`insertion`/`softclip`/`hardclip` indicators are tagged under a separate
`alignments-indicators` group):

<!-- COLOR_TABLE theme-colors START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:goldenrod;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="goldenrod"></span> | Feature (default) | `goldenrod` | A feature with no color of its own — no `color` slot, no BED itemRgb |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#e22;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#e22"></span> | Stop codon | `#e22` | Stop codon in gene/CDS tracks |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#3e3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#3e3"></span> | Start codon | `#3e3` | Start codon in gene/CDS tracks |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#808080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#808080"></span> | Deletion | `#808080` | Deletion markers in alignments |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#009a8a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#009a8a"></span> | Skip (intron) | `#009a8a` | Skipped regions such as introns in RNA-seq reads |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#c8c8c8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#c8c8c8"></span> | Base modification (fwd) | `#c8c8c8` | Base modifications on the forward strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#c8dcc8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#c8dcc8"></span> | Base modification (rev) | `#c8dcc8` | Base modifications on the reverse strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#888;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#888"></span> | Muted SNP base | `#888` | SNP bases muted when show-modifications coloring is on |

<!-- COLOR_TABLE theme-colors END -->

## Exported color constants

A few colors are plain `const` strings rather than palette members. The
methylation colors are the worked case: the RPC worker packs them to ABGR per
modified base and returns them inside its vertex data, and the legend on the
main thread labels those same pixels.

The line between the two mechanisms is where the color is applied, not what it
means. `modificationFwd` and `modificationRev` sit right beside these and are
palette members, because the renderer sets them as shader uniforms, so a theme
switch recomputes a getter and redraws. A color the worker has already baked
into vertex data cannot follow a theme without a theme switch invalidating the
alignments fetch, so it is fixed instead.

Import them from `@jbrowse/core/ui/palette`, which has no toolkit in its module
graph, or from `@jbrowse/core/ui/theme`, which re-exports the same values
alongside Material UI.

<!-- COLOR_TABLE theme-methylation START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | methylated5mC | `#ff0000` | 5-methylcytosine, methylated |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0000ff;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0000ff"></span> | unmethylated5mC | `#0000ff` | 5-methylcytosine, unmethylated |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ffc0cb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ffc0cb"></span> | methylated5hmC | `#ffc0cb` | 5-hydroxymethylcytosine, methylated |

<!-- COLOR_TABLE theme-methylation END -->

The palette carries no such key, so there is nothing on `theme.palette` to
re-derive one from and no way for the worker, the legend and an SVG export to
disagree about what a methylated base looks like.

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
MUI `PaletteColorOptions` object or just `{ "main": "<hex>" }`. Light/dark
variants are derived automatically.

## Reading colors from a display: `session.palette`, not `session.theme`

Both are on the session and both resolve from the same `resolvePalette` call, so
they can't disagree — but they are for different consumers, and only one of them
is a rendering input:

- **`session.palette`** (`JBrowsePalette`) is what rendering reads. Plain color
  strings, no toolkit, serializable — so it crosses the RPC boundary as itself
  and works with no browser at all.
- **`session.theme`** is the resolved MUI `Theme`, for components that are MUI.

Derive a display's colors in a **model getter** over `session.palette`, and read
that getter from `renderState` or whatever you hand the renderer. MAF's is the
worked case:

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#colorPalette -->

```ts
get colorPalette(): MafColorPalette {
  return getMafColorPalette(getSession(self).palette)
},
```

Do **not** stage them in a volatile that a React `useEffect` pushes in with a
`setColorPalette` action. The effect only runs on mount, and two consumers have
no component at all — SVG export and the RPC worker — so both would see a null
palette and render blank. As a getter the value is always present, and MobX
recomputes it only when the theme changes, so you get the same re-render
invalidation with no mount dependency.

SVG export deliberately overrides the palette with the _export_ theme, which is
why the export path resolves its own rather than reading the session's.

## Adding theme colors in plugins

Colors the main thread applies, whether in a React component or as a shader
uniform the renderer sets, belong in the `Palette` / `PaletteOptions` module
augmentation. Follow the existing `modificationFwd` / `modificationRev` pattern:
declare the field on `StringColors` in `palette.ts`, tag it with
`#color <group> | <label> | <description>` so it surfaces as a swatch row in
these guides, and give it a value in `lightStringColors` — plus
`darkStringColors` if dark mode needs a different one, which is a
`Partial<StringColors>` overlay on the light set rather than a second full
table.

A color a worker bakes into its output goes the other way: declare it as a plain
`const` in `palette.ts` and leave it off `StringColors`, for the reason in
[Exported color constants](#exported-color-constants). Worker code imports those
from `@jbrowse/core/ui/palette`, which keeps Material UI out of its bundle.

## See also

- [Config guide: coloring/theming](/docs/config_guides/theme)
- [](/docs/developer_guides/simple_plugin)
