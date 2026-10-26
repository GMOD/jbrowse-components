---
id: lgvsyntenysort
title: LGVSyntenySort
description: "The LGVSyntenyDisplay's sort setting: the AlignmentsSort object with field defaulting to length, so big syntenic blocks cluster at the top instead of interleaving with small ones."
sidebar_label: Display setting -> LGVSyntenySort
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenySortConfigSchema.ts).

The LGVSyntenyDisplay's `sort` setting: the
[AlignmentsSort](../alignmentssort) object with `field` defaulting to
`length`, so big syntenic blocks cluster at the top instead of interleaving
with small ones.

## Example usage

```js
{ type: 'LGVSyntenyDisplay', sort: 'position' }
```

## Related links

- **Base config:** [AlignmentsSort](../alignmentssort)

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'length'</code> | position, length, spliced, split or svSignal order the whole window; strand, base, mapq, pairOrientation, a tags.XX tag, insertion, softclip or hardclip rank the reads over the column at pos |
| <span class="slot-group">Inherited from [AlignmentsSort](../alignmentssort)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-pos">**pos**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's 0-based position |
| <span id="slot-refname">**refName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's reference sequence |
| <span id="slot-within">**within**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | how many bases either side of pos an insertion, softclip or hardclip sort still ranks a mark |
