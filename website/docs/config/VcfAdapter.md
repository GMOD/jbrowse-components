---
id: vcfadapter
title: VcfAdapter
description: "Reads plain-text (non-bgzipped) VCF files. The adapter loads the whole file into memory, so use VcfTabixAdapter for large files."
sidebar_label: Adapter -> VcfAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfAdapter/configSchema.ts).

Reads plain-text (non-bgzipped) VCF files. The adapter loads the whole file
into memory, so use `VcfTabixAdapter` for large files.

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfAdapter',
    uri: 'https://example.com/variants.vcf',
  },
}
```

JBrowse infers `VcfAdapter` and `VariantTrack` from `variants.vcf`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/variants.vcf',
  assemblyNames: ['hg38'],
}
```

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "VcfAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcflocation">**vcfLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.vcf', locationType: 'UriLocation' }</code> | location of the VCF file. May be gzipped; it is read and parsed in full on first use, so the whole call set has to fit in memory. |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional tab-separated table of per-sample metadata. It needs a header row, whose first cell is not read, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a bedGraph value column's header name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the variant and wiggle displays, and a mark display over a MultiWiggle, group, sort, color and tooltip rows by, and a blank cell is no value; `label` and `color` name and color the row. A VCF's table ignores a `sampleName`, `HP` or `sole` column, with a warning, since the variant display writes those fields on its haplotype rows. A MAF adapter reads only the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, with a warning naming the rest, and a table naming none of them is an error. An adapter that names no samples (a MAF track discovering its species from the file) takes the table's rows as its samples |
| <span id="slot-pedigreelocation">**pedigreeLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional pedigree of the VCF's samples, whitespace-separated, or tab-separated where a line holds a tab, so an empty cell keeps its column: a PLINK `.fam` or `.ped` with no header (FID, IID, PAT, MAT, SEX, PHENO; a `.ped`'s genotypes after them are not read), or a table whose header row names its columns `SampleID` or `IID`, `FatherID` or `PAT`, `MotherID` or `MAT`, `FamilyID` or `FID`, `Sex` and `Phenotype` or `PHENO`, in any case and order, as 1000 Genomes' `20130606_g1k_3202_samples_ped_population.txt` does. Each sample gains the attributes `family`, `father`, `mother`, `sex` (`male`, `female` or `other`) and `phenotype` (`affected` or `unaffected`), which the variant display groups, sorts, colors and tooltips rows by. A parent, sex or phenotype of `0`, `-9`, `NA`, `unknown` or an empty cell is no value. An IID naming no VCF sample is tried as `FID_IID`, the sample name PLINK's `--recode vcf` writes. A `samplesTsvLocation` column of the same name wins over the pedigree's, unless it holds one of those missing codes. The pedigree never narrows the samples: its rows naming no VCF sample are skipped, and a pedigree matching none of them adds nothing, with a warning |
