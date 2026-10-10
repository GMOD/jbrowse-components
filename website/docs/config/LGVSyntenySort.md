---
id: lgvsyntenysort
title: LGVSyntenySort
description: "The LGVSyntenyDisplay's sort setting: the AlignmentsSort object with type defaulting to length, so big syntenic blocks cluster at the top instead of interleaving with small…"
sidebar_label: Display -> LGVSyntenySort
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenySortConfigSchema.ts).

## Example usage

```js
{ type: 'LGVSyntenyDisplay', sort: 'position' }
```

_See the **Config slots** section below for all available configuration fields._

The LGVSyntenyDisplay's `sort` setting: the
[AlignmentsSort](../alignmentssort) object with `type` defaulting to
`length`, so big syntenic blocks cluster at the top instead of interleaving
with small ones.

## Related links

- **Base config:** [AlignmentsSort](../alignmentssort)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'length'</code> | position, length, spliced or split order the whole window; strand, basePair, tag, insertion, softclip or hardclip rank the reads over the column at pos |
| <span class="slot-group">Inherited from [AlignmentsSort](../alignmentssort)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-pos">**pos**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's 0-based position |
| <span id="slot-refname">**refName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's reference sequence |
| <span id="slot-tag">**tag**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | the SAM tag a tag sort ranks by |
