---
id: allvsallindexedpafadapter
title: AllVsAllIndexedPAFAdapter
sidebar_label: Adapter -> AllVsAllIndexedPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/AllVsAllIndexedPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'AllVsAllIndexedPAFAdapter',
    uri: 'all_vs_all.pif.gz',
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The tabix-indexed (PIF) form of the `AllVsAllPAFAdapter`. Run
`jbrowse make-pif all_vs_all.paf` on an all-vs-all PAF whose sequence names are
PanSN-prefixed (`sample#haplotype#contig`) and point this adapter at the
resulting `.pif.gz`. Because PIF double-emits each record keyed on both of its
PanSN sequence names, a region query resolves to a tabix range lookup on the
anchor's PanSN seqid(s) instead of scanning the whole file — so it scales to
whole-genome pangenome alignments that do not fit in memory. Semantics match
`AllVsAllPAFAdapter`: one-vs-all in a plain LGV, single-pair when the synteny
view supplies a `targetAssemblyName`.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                             | Type                    | Description                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#slot-assemblynames)             | `stringArray`           | The assemblies this track appears on and can back synteny bands for — list the assemblies you load into JBrowse.                                                                             |
| [pifGzLocation](#slot-pifgzlocation)             | `fileLocation`          | location of the all-vs-all tabix indexed PAF (pif)                                                                                                                                           |
| [assemblyNameToPanSN](#slot-assemblynametopansn) | `frozen`                | Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need `{ grape: 'Vitis_vinifera' }`). |
| [index](#slot-index)                             |                         |                                                                                                                                                                                              |
| [index.indexType](#slot-indexindextype)          | `stringEnum` (TBI, CSI) |                                                                                                                                                                                              |
| [index.location](#slot-indexlocation)            | `fileLocation`          |                                                                                                                                                                                              |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                                   | Type     | Description                                                                                                                                                                                     |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [coarseBpPerPxThreshold](#slot-coarsebpperpxthreshold) | `number` | bpPerPx threshold at which the reader switches from the per-row CIGAR tier (lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when make-pif was run with a coarse tier. |

</details>

<details>
<summary>AllVsAllIndexedPAFAdapter - Slots</summary>

#### slot: assemblyNames

The assemblies this track appears on and can back synteny bands for — list the
assemblies you load into JBrowse. Each entry must resolve to a PanSN sample
prefix present in the file. In a plain LGV the track still draws its assembly
against every other sample in the file, so mates need not be listed here
(unlisted mates are labelled by their PanSN prefix).

**Type:** `stringArray` · **Default:** `[]`

#### slot: pifGzLocation

location of the all-vs-all tabix indexed PAF (pif)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: '/path/to/all_vs_all.pif.gz', locationType: 'UriLocation' }`

#### slot: assemblyNameToPanSN

Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when
they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need
`{ grape: 'Vitis_vinifera' }`). Defaults to identity: the assembly name is
assumed to be the PanSN sample name.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: coarseBpPerPxThreshold

bpPerPx threshold at which the reader switches from the per-row CIGAR tier
(lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when
make-pif was run with a coarse tier. No coarse tier present in the file = always
uses fine tier.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`10000` · _advanced_

#### slot: index

```js
ConfigurationSchema('TabixIndex', {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
  },

  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/all_vs_all.pif.gz.tbi',
      locationType: 'UriLocation',
    },
  },
})
```

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: '/path/to/all_vs_all.pif.gz.tbi', locationType: 'UriLocation' }`

</details>
