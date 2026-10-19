---
id: basealignmentsfilter
title: BaseAlignmentsFilter
description: "The filter both alignments-shaped displays read, LinearAlignmentsDisplay and LGVSyntenyDisplay."
sidebar_label: Display -> BaseAlignmentsFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/baseAlignmentsFilterConfigSchema.ts).

The `filter` both alignments-shaped displays read, LinearAlignmentsDisplay
and LGVSyntenyDisplay. The read members are the SAM flag masks, a minimum
mapping quality, a read name, the tags a read must have, and the four
read categories, each `only`, `exclude` or unset for unfiltered; the default
excludes unmapped, QC-failed and duplicate reads (flag 1540). `connections`
tests the connections between mates and split segments. Every test must
hold, so two categories both apply: `{ split: 'only', svSignal: 'only' }`
keeps the split reads alone.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', filter: { svSignal: 'only' } }
```

```js
{ type: 'LinearAlignmentsDisplay', filter: { minMapq: 20 } }
```

```js
{ type: 'LinearAlignmentsDisplay', filter: { tags: [{ tag: 'HP', value: '1' }] } }
```

## Related links

- **Extended by:** [AlignmentsFilter](../alignmentsfilter)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-flaginclude">**flagInclude**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | a read passes only with every one of these SAM flag bits set, samtools -f |
| <span id="slot-flagexclude">**flagExclude**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1540</code> | a read passes only with none of these SAM flag bits set, samtools -F; 1540 drops unmapped, QC-failed and duplicate reads |
| <span id="slot-minmapq">**minMapq**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | a read passes only with a mapping quality of at least this; a read whose mapping quality is unavailable (255) fails it. Unset passes every read |
| <span id="slot-readname">**readName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | the one read name shown; unset shows every read |
| <span id="slot-tags">**tags**</span><br>[TagFilter](../tagfilter) | The tags a read must have, every one of them: a `{ tag, value }` each, and an unset value matches any read with the tag. |
| <span id="slot-spliced">**spliced**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads whose CIGAR has a reference skip. |
| <span id="slot-svsignal">**svSignal**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads with SV evidence, and the rest of their pair in the same displayed region. A read is evidence when it is split, has an insertion or deletion of 50 bp or more, or is a paired primary read the aligner did not call concordant (no 0x2, a mate unmapped or on another chromosome, or a pair not facing FR). Both ends must be placed: a read at MAPQ 0 is not evidence, a split read counts only when some other piece in its SA tag has MAPQ above 0, and a discordant read only when its mate does, as the MQ tag records. |
| <span id="slot-alone">**alone**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads with no other alignment of themselves in the window, no mate and no split or supplementary segment there. A mate unmapped, on another chromosome or outside the window counts, as does a single-end read with no SA tag. |
| <span id="slot-split">**split**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads with a supplementary segment, a chimeric alignment. |
| <span id="slot-connections">**connections**</span><br>[ConnectionFilter](../connectionfilter) | The connections drawn: `interchrom`, `offscreenMates` and `minInterchromReads` (default 2). |
