---
id: allvsallpafadapter
title: AllVsAllPAFAdapter
sidebar_label: Adapter -> AllVsAllPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/AllVsAllPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'AllVsAllPAFAdapter',
    uri: 'all_vs_all.paf.gz',
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
mapping step) where every sequence name is PanSN-prefixed with its assembly
(`sample#haplotype#contig`). Because such a file contains every pairwise
alignment, one file (and one track) backs every synteny band of a multi-way
view: list all the assemblies in `assemblyNames` and the same track can be
reused for each adjacent pair. The synteny view tells the adapter which pair a
given band draws, and the adapter keeps only those records, stripping the PanSN
prefix to recover each assembly's own refName. Listing just two assemblies keeps
the track pinned to that single pair.

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### AllVsAllPAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "AllVsAllPAFAdapter",
  "uri": "file.paf.gz",
  "assemblyNames": ["grape", "peach"]
}
```

<details open>
<summary>AllVsAllPAFAdapter - Slots</summary>

#### slot: assemblyNames

The assemblies this track can draw. List every assembly in the file to let one
track back all bands of a multi-way view (the view picks each band's pair), or
just two to pin the track to a single pair. Every entry must resolve to a PanSN
sample prefix present in the file.

**Type:** `stringArray` · **Default:** `[]`

#### slot: pafLocation

can be optionally gzipped

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.paf', locationType: 'UriLocation' }`

#### slot: assemblyNameToPanSN

Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when
they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need
`{ grape: 'Vitis_vinifera' }`). Defaults to identity: the assembly name is
assumed to be the PanSN sample name.

**Type:** `frozen` · **Default:** `{}`

</details>
