---
id: sequencesearchadapter
title: SequenceSearchAdapter
sidebar_label: Adapter -> SequenceSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts).

## Example usage

`search` is a regular expression matched against the assembly's own sequence, so
a track needs no file of its own. This one finds canonical polyadenylation
signals on both strands:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'SequenceSearchAdapter',
    search: 'AATAAA',
  },
}
```

### Example: one strand only

Both strands are scanned by default. Turn one off where the motif is
strand-specific, so the track does not report the reverse-complement hit as a
second site:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'SequenceSearchAdapter',
    search: 'GGTAAG',
    searchReverse: false,
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
track is displayed against. Setting it by hand pins the scan to one sequence
source and silently desyncs the track if the assembly's sequence changes.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "SequenceSearchAdapter", ... }`. This adapter has no `uri`
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the
location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-search">**search**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Search string or regex to search for |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | discouraged: leave unset. JBrowse supplies the assembly's sequence adapter automatically; this override exists only for the rare case of scanning a sequence other than the one the track is displayed against. |
| <span id="slot-searchforward">**searchForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | report matches on the reference as written (the plus strand) |
| <span id="slot-searchreverse">**searchReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | also search the reverse complement, reporting those hits on the minus strand. Turn it off for a motif that is only meaningful in one orientation, or to halve the work on a palindromic pattern |
| <span id="slot-caseinsensitive">**caseInsensitive**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | match regardless of case, so soft-masked (lowercase) repeat regions are searched too. Turn it off to search only unmasked sequence |
