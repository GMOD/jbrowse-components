---
id: mcscanblocksadapter
title: MCScanBlocksAdapter
sidebar_label: Adapter -> MCScanBlocksAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanBlocksAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    mcscanBlocksLocation: { uri: 'grape.blocks' },
    blockAssemblies: ['grape', 'peach', 'cacao'],
    bedLocations: [
      { uri: 'grape.bed' },
      { uri: 'peach.bed' },
      { uri: 'cacao.bed' },
    ],
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Loads a multi-genome MCScan (jcvi) `.blocks` file: a reference-anchored,
tab-delimited table where column 0 is a reference gene and each further column
is that gene's ortholog in another genome (`.` = no ortholog), produced by
`jcvi.compara.synteny mcscan` + `jcvi.formats.base join`.

A `.blocks` file describes N genomes at once, so one track backs every band of a
multi-way view: list all the genomes in `assemblyNames` and the synteny view
tells the adapter which pair each band draws, deriving that pair's gene links
from the two matching columns. When neither column is the reference the link is
transitive (both orthologous to the same reference gene) rather than a direct
alignment. Listing just two assemblies pins the track to that pair.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                               | Type           | Description                                                                                                                                                                                       |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [mcscanBlocksLocation](#slot-mcscanblockslocation) | `fileLocation` |                                                                                                                                                                                                   |
| [blockAssemblies](#slot-blockassemblies)           | `stringArray`  | one assembly name per column of the blocks file, in column order (column 0 is the reference)                                                                                                      |
| [bedLocations](#slot-bedlocations)                 | `frozen`       | one BED fileLocation per column of the blocks file, parallel to blockAssemblies, resolving that column's gene ids to coordinates                                                                  |
| [assemblyNames](#slot-assemblynames)               | `stringArray`  | the assemblies this track can render; list all of blockAssemblies to let one track back every band of a multi-way view (the view picks each band's pair), or just two to pin it to a single pair. |

<details>
<summary>MCScanBlocksAdapter - Slots</summary>

#### slot: mcscanBlocksLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/mcscan.blocks', locationType: 'UriLocation' }`

#### slot: blockAssemblies

one assembly name per column of the blocks file, in column order (column 0 is
the reference)

**Type:** `stringArray` · **Default:** `[]`

#### slot: bedLocations

one BED fileLocation per column of the blocks file, parallel to blockAssemblies,
resolving that column's gene ids to coordinates

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

#### slot: assemblyNames

the assemblies this track can render; list all of blockAssemblies to let one
track back every band of a multi-way view (the view picks each band's pair), or
just two to pin it to a single pair. Every entry must appear in blockAssemblies

**Type:** `stringArray` · **Default:** `[]`

</details>
