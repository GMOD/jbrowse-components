---
id: plinkldadapter
title: PlinkLDAdapter
sidebar_label: Adapter -> PlinkLDAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'LDTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'PlinkLDAdapter',
    uri: 'https://example.com/study.ld',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Adapter for reading pre-computed LD data from PLINK --r2 output. Loads the
entire file into memory - suitable for small to medium files.

For large files, use PlinkLDTabixAdapter with tabix indexing.

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

Used by the
[variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
(triangular r² heatmap) and by
[GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
(LocusZoom-style r² to an index SNP). See either guide for generating the .ld
file with `plink --r2`.

```bash
plink --bfile study --r2 --out study
```

Writes `study.ld`, whitespace-delimited:

```
CHR_A  BP_A     SNP_A       CHR_B  BP_B     SNP_B       R2
1      729679   rs4970383   1      752566   rs3131972   0.0925926
1      729679   rs4970383   1      754182   rs3131969   0.157316
```

## Related links

- **Track:** [LDTrack](../ldtrack)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "PlinkLDAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ldlocation">**ldLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/plink.ld', locationType: 'UriLocation' }</code> | Location of the PLINK LD file (.ld or .ld.gz) |
