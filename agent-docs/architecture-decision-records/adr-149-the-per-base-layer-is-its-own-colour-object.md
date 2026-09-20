---
status: Accepted
summary: "The alignments displays hold two colour objects: `color` fills the reads and `baseColor: \"modifications\" | { field, scale: 'none' }` names the per-base variable drawn over them (`modifications`, `bisulfite`, `baseQuality`, `base`), so a read coloured by `tags.HP` carries its methylation marks. The worker takes both and extracts a tag and the modification calls in one fetch. Under the plain fill a modification layer keeps its pale strand tint (`bodyColorScheme`), and mismatches stay grey under one whatever fills the reads. The Color by menu keeps its rows and paths, with the per-base rows a radio group of their own under a sub-header and a None row. Supersedes ADR-148's \"a per-base variable is a field\" and its rejected row on splitting the layers"
---

# ADR-149: The per-base layer is its own colour object

## Status

Accepted (2026-09-20). Supersedes one decision of
[ADR-148](adr-148-the-alignments-read-fill-is-the-colour-object.md) ("A
per-base variable is a field too") and its rejected alternative "Splitting the
per-base layers from the read fill". Everything else in ADR-148 stands.

## Context

ADR-148 kept `baseQuality`, `base`, `modifications` and `bisulfite` as fields of
the one `color` object, on the ground that the display picks the mark from the
variable's grain. One object holds one field, so the read fill and the per-base
layer excluded each other: colouring reads by `tags.HP` switched the methylation
marks off, and the way to see methylation by haplotype was to facet by `HP`
instead. In the grammar these are two layers, each a mark with a colour channel
of its own, and the display already drew them as two marks (`read`, and
`modification`, `perBaseQuality` or `perBaseLetter` in `PILEUP_MARKS`) gated off
one scheme name.

A modification scheme also reached into two other marks. It painted the read
body a pale strand tint (`modFwd`, `modRev`) for the marks to read against, and
it collapsed the mismatch mark's base colours to grey (`colorMutedSnpBase`), so
hue at base grain belonged to the modifications alone.

## Decision

**Two colour objects, one per mark.** `color` is the read fill (ADR-148).
`baseColor` (`AlignmentsBaseColor`) names the per-base variable: `field` and a
`scale` of `none` alone, a string lifting into `field`. It declares no `domain`,
`palette` or `ramp`, since each of its fields paints a vocabulary or ramp of its
own and nothing reads a declared one. The multi-sample variant displays hold
`color` and `rowColor` on the same ground
([ADR-131](adr-131-a-categorical-channel-is-one-config-object.md)).

**The runtime form splits the same way.** `colorBy` is a `ReadColorBy`, whose
type excludes the four per-base schemes, and `baseLayer` a `BaseLayer` or
undefined (`baseLayerOf`). A comparison of the read scheme against a per-base
name is a type error. `setColorBy` writes `color`, `setBaseLayer` writes
`baseColor` with the modification settings, and neither touches the other.

**The worker takes both.** The request carries `colorBy` through `workerColorBy`
as before and `baseLayer` whole, and `extractFeatureArrays` reads the tag or
attribute off the first and the per-base arrays and modification calls off the
second, in one pass over the reads.

**The modification layer's reach into the other marks follows the layer.**
`bodyColorScheme` answers what the read body paints as: the read scheme, or
under the plain fill the modification layer's strand tint, so every existing
figure paints as it did and a read field replaces the tint. The shader index,
the per-read classifier and the arc key read it. The mismatch mute stays keyed
on `showModifications`, which is the layer, so hue at base grain keeps one
meaning whatever fills the reads. The chain-strand framing holds off while any
per-base layer draws, as it did under each of those schemes.

**The menu keeps its rows and its paths.** "Color by..." lists the read fills,
then under a "Per-base coloring" sub-header a radio group of None, Per-base
quality, Per-base lettering and the Modifications and Bisulfite submenus. A read
pick leaves the layer on, and None is the layer's way off. A figure recipe's
`Color by... → Modifications → …` path is unchanged.

**The key lists the layer first**, then the read fill, then the buckets that
occurred, so a modification key reads as it did and gains the read fill's rows
when one is set.

## Consequences

- `color: { field: 'modifications' | 'bisulfite' | 'baseQuality' | 'base' }`,
  ADR-148's spelling, is `baseColor` now. A v4 per-base `colorBy` migrates there
  (`V4_BASE_COLOR_FIELDS`).
- Group by tag with "also color by tag" ticked no longer costs a
  modification-coloured pileup its marks.
- The default tag palette leads with a blue and a pink, and the two-colour
  modification view paints blue and red. A figure combining them reads better
  with a declared `color.palette` of two quiet tones.
- `jb2export` gains a `baseColor:` modifier beside `color:`, and `domain:` and
  `palette:` for the colour object's two lists, so
  `color:tag:HP domain:1,2 palette:#d9c9a3,#b7c4b1 baseColor:methylation` is one
  command. A per-base name on `color:` is refused with the modifier that draws
  it.

## Rejected alternatives

- **A `layers` list of marks with an `encoding` apiece**, the mark display's
  form. The pileup's marks are fixed by the format and gated by settings of
  their own (`showMismatches`, `showSoftClipping`), and ADR-095 holds that the
  reader never picks a mark here. Two named colour objects say what varies.
- **Letting two per-base layers draw at once.** The quality and letter walls
  cover every aligned base, so a second layer under one is invisible.
- **Colouring mismatches under a modification layer.** Two hue vocabularies at
  base grain is the collision the mute exists to prevent.
