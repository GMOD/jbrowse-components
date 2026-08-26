---
id: motiflistadapter
title: MotifListAdapter
sidebar_label: Adapter -> MotifListAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/MotifListAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'restriction_enzymes',
  name: 'Restriction enzymes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MotifListAdapter',
    motifs: 'EcoRI\tG^AATTC\nBamHI\tG^GATCC',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Scans the reference for a list of named motifs, e.g. restriction enzyme
recognition sites.

Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
track is displayed against. Setting it by hand pins the scan to one sequence
source and silently desyncs the track if the assembly's sequence changes.

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MotifListAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-motifs">**motifs**</span><br>[`text`](/docs/config_guides/slot_types#text) = <code>''</code> | Newline-separated list of named motifs in REBASE notation, e.g. `EcoRI G^AATTC` or, for a type IIS enzyme that cuts downstream of its site, `BsaI GGTCTC(1/5)`. The name is optional, `^` marks the top-strand cut, and `(n/m)` gives the top and bottom cuts counted from the site's 3' end. Blank lines and `#` comments are ignored. |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | discouraged: leave unset. JBrowse supplies the assembly's sequence adapter automatically; this override exists only for the rare case of scanning a sequence other than the one the track is displayed against. |
| <span id="slot-searchforward">**searchForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | ignored for palindromic motifs, which match both strands at once |
| <span id="slot-searchreverse">**searchReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | ignored for palindromic motifs, which match both strands at once |
