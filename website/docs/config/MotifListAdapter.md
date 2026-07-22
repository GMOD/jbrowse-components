---
id: motiflistadapter
title: MotifListAdapter
sidebar_label: Adapter -> MotifListAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/MotifListAdapter/configSchema.ts).

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

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type      | Description                                                                      |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| [motifs](#slot-motifs)                   | `text`    | Newline-separated list of named motifs in REBASE notation, e.g. `EcoRI G^AATTC`. |
| [sequenceAdapter](#slot-sequenceadapter) | `frozen`  | discouraged: leave unset.                                                        |
| [searchForward](#slot-searchforward)     | `boolean` | ignored for palindromic motifs, which match both strands at once                 |
| [searchReverse](#slot-searchreverse)     | `boolean` | ignored for palindromic motifs, which match both strands at once                 |

<details>
<summary>MotifListAdapter - Slots</summary>

#### slot: motifs

Newline-separated list of named motifs in REBASE notation, e.g.
`EcoRI  G^AATTC`. The name is optional and `^` optionally marks the top-strand
cut. Blank lines and `#` comments are ignored.

**Type:** [`text`](/docs/config_guides/slot_types#text) · **Default:** `''`

#### slot: sequenceAdapter

discouraged: leave unset. JBrowse supplies the assembly's sequence adapter
automatically; this override exists only for the rare case of scanning a
sequence other than the one the track is displayed against.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

#### slot: searchForward

ignored for palindromic motifs, which match both strands at once

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: searchReverse

ignored for palindromic motifs, which match both strands at once

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>
