---
id: linearmafdisplay
title: LinearMafDisplay
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/configSchema.ts).

the display for a `MafTrack`: one row per aligned species, with a conservation
summary above them. The conservation band, per-row identity,
color-by-source-chromosome, and inversion overlays are all derived from the
alignment itself and toggled from the track menu, so the slots here are
show/hide defaults and band sizes.

## Related links

- **Adapter:** [BgzipTaffyAdapter](../bgziptaffyadapter)
- **Adapter:** [BigMafAdapter](../bigmafadapter)
- **Adapter:** [MafTabixAdapter](../maftabixadapter)
- **State model:** [runtime API](../../models/linearmafdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                             | Type          | Description                                                                                                                                                                                  |
| ------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [height](#slot-height)                           | `maybeNumber` | Override the base `height` slot as a `maybeNumber`: unset means fit rows to their content height, an explicit value is a drag-resized track height.                                          |
| [rowHeight](#slot-rowheight)                     | `number`      | Per-row height in px, or `0` for "fit to display height" mode where rows stretch to fill the track height.                                                                                   |
| [rowProportion](#slot-rowproportion)             | `number`      | fraction of the row height each glyph fills                                                                                                                                                  |
| [showAllLetters](#slot-showallletters)           | `boolean`     | draw every base letter instead of only mismatches                                                                                                                                            |
| [mismatchRendering](#slot-mismatchrendering)     | `boolean`     | color bases by mismatch to the reference                                                                                                                                                     |
| [showAsUpperCase](#slot-showasuppercase)         | `boolean`     | uppercase all base letters                                                                                                                                                                   |
| [showTree](#slot-showtree)                       | `boolean`     | show the species tree sidebar                                                                                                                                                                |
| [showBranchLength](#slot-showbranchlength)       | `boolean`     | Position tree nodes by their cluster merge height (dendrogram) rather than evenly by topology (cladogram).                                                                                   |
| [showCoverage](#slot-showcoverage)               | `boolean`     | show the coverage band                                                                                                                                                                       |
| [showAlignments](#slot-showalignments)           | `boolean`     | Show the per-sample alignment rows.                                                                                                                                                          |
| [coverageHeight](#slot-coverageheight)           | `number`      | height of the coverage band in px                                                                                                                                                            |
| [showConservation](#slot-showconservation)       | `boolean`     | Show the conservation band (per-bp percent identity to the reference).                                                                                                                       |
| [conservationHeight](#slot-conservationheight)   | `number`      | height of the conservation band in px                                                                                                                                                        |
| [conservationMode](#slot-conservationmode)       | `stringEnum`  | Conservation band resolution: `base` (per-bp percent identity) or `codon` (per-codon amino-acid identity; needs an `annotationAdapter`).                                                     |
| [rowIdentityMode](#slot-rowidentitymode)         | `stringEnum`  | Per-row identity rendering shown once zoomed out past base level: `heatmap` shades the row band, `xyplot` draws a per-species identity wiggle, `none` keeps the base coloring at every zoom. |
| [rowIdentityAutoZoom](#slot-rowidentityautozoom) | `boolean`     | When true the per-row identity plot follows zoom like UCSC `wigMaf`; when false the selected `rowIdentityMode` is pinned on at every zoom.                                                   |
| [showAnnotations](#slot-showannotations)         | `boolean`     | Show the per-species CDS reading-frame overlay from the configured `annotationAdapter` (UCSC `mafFrames`).                                                                                   |
| [showTranslation](#slot-showtranslation)         | `boolean`     | Translate each species in the reference reading frame and draw the amino acid on each codon in place of nucleotides (UCSC `wigMaf` "show translation").                                      |
| [colorByChromosome](#slot-colorbychromosome)     | `boolean`     | Color each species' blocks by their source chromosome instead of the per-base SNP coloring, surfacing translocations/rearrangements.                                                         |
| [showInversions](#slot-showinversions)           | `boolean`     | Overlay a strand-flip (inversion) indicator: inverted blocks get a diagonal hatch.                                                                                                           |

<details>
<summary>LinearMafDisplay - Slots</summary>

#### slot: height

Override the base `height` slot as a `maybeNumber`: unset means fit rows to
their content height, an explicit value is a drag-resized track height. See the
model's `fitTargetHeight` getter.

**Type:** `maybeNumber` · **Default:** `undefined`

#### slot: rowHeight

Per-row height in px, or `0` for "fit to display height" mode where rows stretch
to fill the track height. The resolved value is the model's `effectiveRowHeight`
getter. Defaults to fit-to-height so large alignments stay bounded by the track
height.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0`

#### slot: rowProportion

fraction of the row height each glyph fills

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`DEFAULTS.rowProportion`

#### slot: showAllLetters

draw every base letter instead of only mismatches

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showAllLetters`

#### slot: mismatchRendering

color bases by mismatch to the reference

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.mismatchRendering`

#### slot: showAsUpperCase

uppercase all base letters

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showAsUpperCase`

#### slot: showTree

show the species tree sidebar

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showTree`

#### slot: showBranchLength

Position tree nodes by their cluster merge height (dendrogram) rather than
evenly by topology (cladogram).

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showBranchLength`

#### slot: showCoverage

show the coverage band

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showCoverage`

#### slot: showAlignments

Show the per-sample alignment rows. When off, only the coverage band renders
(independent of `showCoverage`).

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showAlignments`

#### slot: coverageHeight

height of the coverage band in px

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`DEFAULTS.coverageHeight`

#### slot: showConservation

Show the conservation band (per-bp percent identity to the reference).
Independent of `showCoverage`/`showAlignments`.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showConservation`

#### slot: conservationHeight

height of the conservation band in px

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`DEFAULTS.conservationHeight`

#### slot: conservationMode

Conservation band resolution: `base` (per-bp percent identity) or `codon`
(per-codon amino-acid identity; needs an `annotationAdapter`).

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `DEFAULTS.conservationMode`

```js
{
  type: 'stringEnum',
  model: types.enumeration(
    'MafConservationMode',
    CONSERVATION_MODE_VALUES,
  ),
  defaultValue: DEFAULTS.conservationMode,
}
```

#### slot: rowIdentityMode

Per-row identity rendering shown once zoomed out past base level: `heatmap`
shades the row band, `xyplot` draws a per-species identity wiggle, `none` keeps
the base coloring at every zoom.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `DEFAULTS.rowIdentityMode`

```js
{
  type: 'stringEnum',
  model: types.enumeration('RowIdentityMode', ROW_IDENTITY_MODE_VALUES),
  defaultValue: DEFAULTS.rowIdentityMode,
}
```

#### slot: rowIdentityAutoZoom

When true the per-row identity plot follows zoom like UCSC `wigMaf`; when false
the selected `rowIdentityMode` is pinned on at every zoom.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.rowIdentityAutoZoom`

#### slot: showAnnotations

Show the per-species CDS reading-frame overlay from the configured
`annotationAdapter` (UCSC `mafFrames`). No effect without one.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showAnnotations`

#### slot: showTranslation

Translate each species in the reference reading frame and draw the amino acid on
each codon in place of nucleotides (UCSC `wigMaf` "show translation"). Needs an
`annotationAdapter`.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showTranslation`

#### slot: colorByChromosome

Color each species' blocks by their source chromosome instead of the per-base
SNP coloring, surfacing translocations/rearrangements.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.colorByChromosome`

#### slot: showInversions

Overlay a strand-flip (inversion) indicator: inverted blocks get a diagonal
hatch.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`DEFAULTS.showInversions`

</details>
