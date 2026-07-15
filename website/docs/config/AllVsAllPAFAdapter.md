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

_See the **Config slots** section below for all available configuration fields._

Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
mapping step) where every sequence name is PanSN-prefixed with its assembly
(`sample#haplotype#contig`). Because such a file contains every pairwise
alignment, one file (and one track) backs every synteny band of a multi-way
view: the synteny view tells the adapter which pair a given band draws, and the
adapter keeps only those records, stripping the PanSN prefix to recover each
assembly's own refName. In a plain LGV (LGVSyntenyDisplay) there is no band to
isolate, so the track draws its assembly against every OTHER sample in the file
— "one vs all" — including samples not listed in `assemblyNames` (those mates
are labelled by their PanSN prefix). `assemblyNames` therefore only needs to
list the assemblies you actually load into JBrowse and want the track to appear
on.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                             | Type           | Description                                                                                                                                                                                  |
| ------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#slot-assemblynames)             | `stringArray`  | The assemblies this track appears on and can back synteny bands for — list the assemblies you load into JBrowse.                                                                             |
| [pafLocation](#slot-paflocation)                 | `fileLocation` | can be optionally gzipped                                                                                                                                                                    |
| [assemblyNameToPanSN](#slot-assemblynametopansn) | `frozen`       | Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need `{ grape: 'Vitis_vinifera' }`). |

<details>
<summary>AllVsAllPAFAdapter - Slots</summary>

#### slot: assemblyNames

The assemblies this track appears on and can back synteny bands for — list the
assemblies you load into JBrowse. Each entry must resolve to a PanSN sample
prefix present in the file. In a plain LGV the track still draws its assembly
against every other sample in the file, so mates need not be listed here
(unlisted mates are labelled by their PanSN prefix).

**Type:** `stringArray` · **Default:** `[]`

#### slot: pafLocation

can be optionally gzipped

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/file.paf', locationType: 'UriLocation' }`

#### slot: assemblyNameToPanSN

Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when
they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need
`{ grape: 'Vitis_vinifera' }`). Defaults to identity: the assembly name is
assumed to be the PanSN sample name.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

</details>
