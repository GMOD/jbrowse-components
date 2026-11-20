---
id: vcftabixadapter
title: VcfTabixAdapter
description: "Reads bgzip-compressed, tabix-indexed VCF files."
sidebar_label: Adapter -> VcfTabixAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfTabixAdapter/configSchema.ts).

Reads bgzip-compressed, tabix-indexed VCF files.

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index (pass `csi: true` for a
`.csi` index):

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
}
```

JBrowse infers `VcfTabixAdapter` and `VariantTrack` from `variants.vcf.gz`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/variants.vcf.gz',
  assemblyNames: ['hg38'],
}
```

:::caution Gotcha

TBI cannot index a chromosome longer than 512 Mb, which some plant and animal genomes exceed. Index those with CSI instead: pass `csi: true` alongside the `uri` shorthand, or set both `index.location` and `index.indexType: 'CSI'` explicitly.

:::

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "VcfTabixAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcfgzlocation">**vcfGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed VCF, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-index">**index**</span><br>[TabixIndex](../tabixindex) | The tabix index location and its kind. The `uri` shorthand derives both, so a config using it states neither. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | Matches the feature-track default (5 Mb): the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a tighter gate trips on routine variant views. VCF text downloads fast; the feature-density gate remains the backstop for genuinely over-dense views.<br>_advanced_ |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional tab-separated table of per-sample metadata. It needs a header row, whose first cell is not read, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the variant and wiggle displays, and a mark display over a MultiWiggle, group, sort, color and tooltip rows by, and a blank cell is no value; `label` and `color` name and color the row. A VCF's table ignores a `sampleName`, `HP` or `sole` column, with a warning, since the variant display writes those fields on its haplotype rows. A MAF adapter reads only the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, with a warning naming the rest, and a table naming none of them is an error. An adapter that names no samples (a MAF track discovering its species from the file) takes the table's rows as its samples |
| <span id="slot-pedigreelocation">**pedigreeLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional pedigree of the VCF's samples, whitespace-separated: a PLINK `.fam` or `.ped` with no header (FID, IID, PAT, MAT, SEX, PHENO; a `.ped`'s genotypes after them are not read), or a table whose header row names its columns `SampleID` or `IID`, `FatherID` or `PAT`, `MotherID` or `MAT`, `FamilyID` or `FID`, `Sex` and `Phenotype` or `PHENO`, in any case and order, as 1000 Genomes' `20130606_g1k_3202_samples_ped_population.txt` does. Each sample gains the attributes `family`, `father`, `mother`, `sex` (`male`, `female` or `other`) and `phenotype` (`affected` or `unaffected`), which the variant display groups, sorts, colors and tooltips rows by. A parent of `0`, a sex of `0`, `-9` or `unknown` and a phenotype of `0` or `-9` are no value, and the Mendelian check reads a samples table's `sex` column by the same codes. An IID naming no VCF sample is tried as `FID_IID`, the sample name PLINK's `--recode vcf` writes. A `samplesTsvLocation` column of the same name wins over the pedigree's. The pedigree never narrows the samples: its rows naming no VCF sample are skipped, and a pedigree matching none of them adds nothing, with a warning |
