---
id: maftabixadapter
title: MafTabixAdapter
sidebar_label: Adapter -> MafTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafTabixAdapter/configSchema.ts).

## Overview

### MafTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.bed.gz.tbi:

```json
{
  "type": "MafTabixAdapter",
  "uri": "yourfile.bed.gz",
  "samples": ["sample1", "sample2"]
}
```

## Related links

- **Track:** [MafTrack](../maftrack)
- **Display:** [LinearMafDisplay](../linearmafdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                         | Type                    | Description                                                                                                                                                                                 |
| -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [samples](#slot-samples)                     | `frozen`                | string[] or {id:string,label:string,color?:string}[]                                                                                                                                        |
| [bedGzLocation](#slot-bedgzlocation)         | `fileLocation`          |                                                                                                                                                                                             |
| [refAssemblyName](#slot-refassemblyname)     | `string`                |                                                                                                                                                                                             |
| [index.location](#slot-indexlocation)        | `fileLocation`          |                                                                                                                                                                                             |
| [index.indexType](#slot-indexindextype)      | `stringEnum` (TBI, CSI) |                                                                                                                                                                                             |
| [nhLocation](#slot-nhlocation)               | `fileLocation`          | newick tree                                                                                                                                                                                 |
| [annotationAdapter](#slot-annotationadapter) | `frozen`                | optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it |

<details>
<summary>MafTabixAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

#### slot: bedGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: refAssemblyName

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz.tbi' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: nhLocation

newick tree

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.nh', locationType: 'UriLocation' }`

#### slot: annotationAdapter

optional sub-adapter (typically a BigBedAdapter over a UCSC
multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the
gene-structure overlay and codon view; null disables it

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

</details>
