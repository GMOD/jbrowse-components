---
id: readfilter
title: ReadFilter
sidebar_label: Display -> ReadFilter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readFilterConfigSchema.ts).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', filter: { flagExclude: 1540, properPairs: 'exclude', split: 'only' } }
```

```js
{ type: 'LinearAlignmentsDisplay', filter: { tagFilters: [{ tag: 'HP', value: '1' }] } }
```

_See the **Config slots** section below for all available configuration fields._

Every read filter of the alignments display in one object, its `filter`
slot: the SAM flag masks, a read name, the tag filters a read has to pass
every one of, and the four read categories, each `only`, `exclude` or
unset for unfiltered. The default excludes unmapped, QC-failed and duplicate
reads (flag 1540).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-flaginclude">**flagInclude**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>defaultFilterFlags.flagInclude</code> | a read passes only with every one of these SAM flag bits set, samtools -f |
| <span id="slot-flagexclude">**flagExclude**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>defaultFilterFlags.flagExclude</code> | a read passes only with none of these SAM flag bits set, samtools -F; 1540 drops unmapped, QC-failed and duplicate reads |
| <span id="slot-readname">**readName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | the one read name shown; unset shows every read |
| <span id="slot-tagfilters">**tagFilters**</span><br>[TagFilter](../tagfilter) | The tags a read has to carry, every one of them: a `{ tag, value }` each, the value `*` or unset passing any read with the tag. |
| <span id="slot-spliced">**spliced**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads whose CIGAR carries a reference skip. |
| <span id="slot-properpairs">**properPairs**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: pairs the aligner flagged proper, in normal orientation. |
| <span id="slot-singletons">**singletons**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads whose mate and supplementary segments are all outside the window. |
| <span id="slot-split">**split**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: reads with a supplementary segment, a chimeric alignment. |
