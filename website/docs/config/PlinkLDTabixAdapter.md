---
id: plinkldtabixadapter
title: PlinkLDTabixAdapter
sidebar_label: Adapter -> PlinkLDTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchemaTabix.ts).

## Example usage

```js
{
  type: 'LDTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'PlinkLDTabixAdapter',
    uri: 'https://example.com/study.sorted.ld.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Adapter for reading pre-computed LD data from PLINK --r2 output (tabix-indexed).

The input file should be bgzipped and tabix-indexed:

```bash
plink --bfile study --r2 --out study
# plink pads its columns with spaces and tabix indexes on tabs, so retab as
# well as commenting the header; sort-bed is `sort -k1,1 -k2,2n` under
# LC_ALL=C with the `#` line kept on top
awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t' study.ld |
  jbrowse sort-bed | bgzip > study.sorted.ld.gz
tabix -s 1 -b 2 -e 2 study.sorted.ld.gz
```

Comment the header with `#` rather than counting it with `tabix -S 1`. Both keep
it out of the data, but only the commented form is what `tabix -H` prints and
what readers ask for first, so a `-S 1` header is easy to miss — and missing it
means missing the `DP` column, which is what makes D' available instead of only
r². (Not `-c C`: that makes `C` the meta character, so every `chr1`-style data
row would read as a comment.) A file already indexed with `-S 1` still loads.

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

`study.ld` before bgzipping, whitespace-delimited:

```
CHR_A  BP_A     SNP_A       CHR_B  BP_B     SNP_B       R2
1      729679   rs4970383   1      752566   rs3131972   0.0925926
1      729679   rs4970383   1      754182   rs3131969   0.157316
```

Used by the
[variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
(triangular r² heatmap) and by
[GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
(LocusZoom-style r² to an index SNP). See either guide for generating the .ld
file with `plink --r2`.

## Related links

- **Track:** [LDTrack](../ldtrack)
- **Display:** [LDTrackDisplay](../ldtrackdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "PlinkLDTabixAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `csi` in place of writing a location slot out. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ldlocation">**ldLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/plink.ld.gz', locationType: 'UriLocation' }</code> | Location of the bgzipped PLINK LD file (.ld.gz) |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes. |
