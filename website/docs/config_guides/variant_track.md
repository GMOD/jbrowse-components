---
title: Variant track
description:
  VCF variant track config, SVTYPE coloring, and multi-sample displays
guide_category: Track types
---

Example config:

```json
{
  "type": "VariantTrack",
  "trackId": "my_track",
  "name": "My Variants",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/file.vcf.gz"
  }
}
```

## VcfTabixAdapter configuration options

The `uri` shorthand above is the common case: the adapter assumes the tabix
index sits next to the data file at `<uri>.tbi`. Spell out the location slots
only when the index is named differently or is a CSI index:

- `vcfGzLocation` - file location of the bgzip'd VCF
- `index.location` - file location of the index
- `index.indexType` - `TBI` (default) or `CSI`; use CSI for chromosomes longer
  than 512 Mb (e.g. some plant genomes), which TBI cannot index

```json
{
  "type": "VcfTabixAdapter",
  "vcfGzLocation": { "uri": "https://yourhost/file.vcf.gz" },
  "index": {
    "indexType": "CSI",
    "location": { "uri": "https://yourhost/file.vcf.gz.csi" }
  }
}
```

See the [VcfTabixAdapter config docs](/docs/config/vcftabixadapter) for all
options.

## Coloring variants by type

Use a jexl expression on the display's `color` slot to color variants by their
`SVTYPE` INFO field (or any other VCF field). The expression reads the INFO
field via `feature.INFO.SVTYPE` and maps it to a color:

```json
{
  "type": "VariantTrack",
  "trackId": "my_sv_track",
  "name": "SVs colored by type",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/svs.vcf.gz"
  },
  "displayDefaults": {
    "color": "jexl:({'DEL':'red','INS':'blue','DUP':'green','INV':'orange','BND':'purple','TRA':'purple'})[feature.INFO.SVTYPE[0]] || 'gray'"
  }
}
```

The `displayDefaults` object is shorthand — JBrowse applies the `color` to the
variant display for you, so you don't have to know the display's name
(`LinearVariantDisplay`) or write the array. For per-display control use the
array form (see the
[track config guide](/docs/config_guides/tracks/#configuring-displays)).

The `|| 'gray'` fallback colors any SVTYPE not in the map (or variants without
an SVTYPE field) gray. INFO fields are parsed as arrays, so index the first
value (`[0]`) as shown above. You can use the same pattern for SNP/INDEL VCFs by
reading `feature.INFO.CLNSIG[0]` or any other INFO key. See
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
more jexl color examples.

If your config must run on older JBrowse releases, use the equivalent
`get(feature,'INFO').SVTYPE[0]` function form instead of property access — see
the [jexl guide's note on the two forms](/docs/config_guides/jexl).

## MultiVariant display configuration

The MultiVariant displays (`LinearMultiSampleVariantDisplay` and
`LinearMultiSampleVariantMatrixDisplay`) are used for visualizing multi-sample
VCF files. They show genotype information across many samples in a heatmap-like
visualization.

### Configuring default display settings

You can configure default settings for MultiVariant displays so that certain
options are enabled by default without users needing to toggle them manually
each time.

#### Available configuration options

| Option                       | Type                          | Default         | Description                                                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showReferenceAlleles`       | boolean                       | `false`         | When `true`, reference alleles are drawn with color. When `false`, the background is solid grey and only ALT alleles are colored on top. Set to `true` if coloring the background the same as homozygous reference alleles is misleading for your use case. |
| `showSidebarLabels`          | boolean                       | `true`          | Show sample names in the sidebar                                                                                                                                                                                                                            |
| `showTree`                   | boolean                       | `true`          | Show the clustering tree (when clustering has been performed)                                                                                                                                                                                               |
| `renderingMode`              | `'alleleCount'` \| `'phased'` | `'alleleCount'` | The rendering mode. `'alleleCount'` shows dosage (darker color for homozygous), `'phased'` splits samples into haplotype rows                                                                                                                               |
| `minorAlleleFrequencyFilter` | number                        | `0`             | Filter out variants with minor allele frequency below this threshold (0-0.5)                                                                                                                                                                                |
| `colorBy`                    | string                        | `''`            | Automatically color samples by this metadata attribute when the track loads. The attribute must be present in the sample metadata TSV file (configured via `samplesTsvLocation` on the adapter). Leave empty to disable auto-coloring.                      |

These are the most commonly configured options; see the autogenerated
[LinearMultiSampleVariantDisplay](/docs/config/linearmultisamplevariantdisplay)
and [SharedVariantDisplay](/docs/config/sharedvariantdisplay) config docs for
the full authoritative list.

#### Example: Always show reference alleles

If your team investigates diversity panels for potential markers and finds that
coloring the background the same as homozygous alleles is misleading, you can
configure the display to always show reference alleles:

```json
{
  "type": "VariantTrack",
  "trackId": "my_vcf_track",
  "name": "My Multi-sample VCF",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/samples.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "my_vcf_track-LinearMultiSampleVariantDisplay",
      "showReferenceAlleles": true
    },
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "displayId": "my_vcf_track-LinearMultiSampleVariantMatrixDisplay",
      "showReferenceAlleles": true
    }
  ]
}
```

#### Example: Configure multiple default settings

```json
{
  "type": "VariantTrack",
  "trackId": "diversity_panel",
  "name": "Diversity Panel",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/diversity.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "diversity_panel-LinearMultiSampleVariantDisplay",
      "showReferenceAlleles": true,
      "minorAlleleFrequencyFilter": 0.05,
      "showSidebarLabels": true,
      "renderingMode": "alleleCount"
    }
  ]
}
```

### Auto-coloring samples by metadata

If you have sample metadata (e.g., population, cohort, phenotype) stored in a
TSV file, you can configure the display to automatically color samples by a
specific attribute when the track loads.

#### Provide sample metadata via samplesTsvLocation

Configure your adapter with a `samplesTsvLocation` that points to a TSV file
with sample metadata. The first column must be `name` (the sample names matching
the VCF), and subsequent columns are arbitrary metadata attributes:

```tsv
name	population	region	phenotype
SAMPLE001	EUR	Western	case
SAMPLE002	AFR	Eastern	control
SAMPLE003	EUR	Western	control
SAMPLE004	EAS	Pacific	case
```

#### Configure colorBy on the display

Then set the `colorBy` option on the display to the attribute you want to color
by:

```json
{
  "type": "VariantTrack",
  "trackId": "population_vcf",
  "name": "Population VCF",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/samples.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://yourhost/sample_metadata.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "population_vcf-LinearMultiSampleVariantDisplay",
      "colorBy": "population"
    }
  ]
}
```

With this configuration, samples are colored by their `population` value when
the track loads. Each unique value (EUR, AFR, EAS, etc.) gets a distinct color
from the palette.

#### Complete example with all options

```json
{
  "type": "VariantTrack",
  "trackId": "diversity_panel_colored",
  "name": "Diversity Panel (Colored by Population)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/diversity.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://yourhost/sample_populations.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "diversity_panel_colored-LinearMultiSampleVariantDisplay",
      "showReferenceAlleles": true,
      "minorAlleleFrequencyFilter": 0.05,
      "colorBy": "population"
    }
  ]
}
```

### Notes

- The `showReferenceAlleles` option can be set on both
  `LinearMultiSampleVariantDisplay` and `LinearMultiSampleVariantMatrixDisplay`,
  though the visual effect may differ between them due to their different
  rendering approaches.
- The configuration values are just the initial defaults. Users can change these
  settings at runtime via the track menu or the "Edit colors/arrangement"
  dialog, and their preference is stored in the session, overriding the
  configuration default for that session.
- The `colorBy` attribute must exist in the sample metadata TSV file. If the
  attribute is not found, a warning is logged to the console and no automatic
  coloring is applied.

## Linkage disequilibrium (LD) display

JBrowse can render a triangular LD heatmap of pairwise R² (or D') between
variants. There are two ways to supply the data:

- **Computed from a VCF** — add the `LDDisplay` to a regular `VariantTrack`. LD
  is computed on the fly from the genotypes in the visible region, so no extra
  files are needed. Filtering (minor allele frequency, HWE, call rate, jexl) and
  signed-LD values are available because the raw genotypes are present.
- **Pre-computed with PLINK** — use a standalone `LDTrack` pointing at PLINK
  `--r2` output via `PlinkLDAdapter` (plain `.ld`) or `PlinkLDTabixAdapter`
  (bgzipped + tabix-indexed `.ld.gz`). This is the right choice for large
  cohorts where computing LD in the browser would be too slow, or when you want
  to publish a fixed LD matrix.

### Generating the PLINK file

Produce the `.ld` file with PLINK's `--r2` report, from a PLINK binary fileset
(`.bed`/`.bim`/`.fam`) or directly from a VCF:

```bash
plink --vcf study.vcf.gz --r2 dprime with-freqs \
  --ld-window 99999 --ld-window-kb 1000 --ld-window-r2 0 \
  --out study
```

This writes `study.ld` (columns `CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2`, plus
`DP`/`MAF_A`/`MAF_B` from the `dprime`/`with-freqs` flags), which
`PlinkLDAdapter` reads directly. For a chromosome-scale or genome-wide file,
bgzip and tabix it first so it can be used with `PlinkLDTabixAdapter`:

```bash
# preserve the header, sort the rest by CHR_A then BP_A
(head -1 study.ld; tail -n +2 study.ld | sort -k1,1 -k2,2n) > study.sorted.ld
bgzip study.sorted.ld
tabix -s 1 -b 2 -e 2 -c C study.sorted.ld.gz
```

The
[GWAS track guide → Preparing the LD file](/docs/config_guides/gwas_track#preparing-the-ld-file)
explains these flags in full — the same `.ld` file is used both for coloring
GWAS points by LD and for the standalone LD track here.

### Pre-computed LD track (plain `.ld`)

```json
{
  "type": "LDTrack",
  "trackId": "ld_plink",
  "name": "Linkage disequilibrium",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "PlinkLDAdapter",
    "uri": "https://yourhost/study.ld"
  }
}
```

The `uri` expands to the `ldLocation` slot; see the
[PlinkLDAdapter config docs](/docs/config/plinkldadapter) for the longhand form.

### Pre-computed LD track (tabix-indexed `.ld.gz`)

For chromosome-scale or genome-wide files, use the tabix adapter so only pairs
in the visible region are fetched:

```json
{
  "type": "LDTrack",
  "trackId": "ld_plink_tabix",
  "name": "Linkage disequilibrium",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://yourhost/study.ld.gz"
  }
}
```

The `uri` shorthand assumes a sibling `<uri>.tbi` index; spell out `ldLocation`
and `index.location` (see the
[PlinkLDTabixAdapter config docs](/docs/config/plinkldtabixadapter)) if the
index is named differently.

### Computed-from-VCF LD display

Attach an `LDDisplay` to a normal `VcfTabixAdapter` variant track. No LD file is
needed — LD is computed from genotypes in the visible region:

```json
{
  "type": "VariantTrack",
  "trackId": "variants_ld",
  "name": "Variants with LD",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/variants.vcf.gz"
  },
  "displays": [
    {
      "type": "LDDisplay",
      "displayId": "variants_ld-LDDisplay"
    }
  ]
}
```

Both displays expose the same track-menu controls (LD metric, recombination
overlay, legend, fit-to-height), but the filtering and signed-LD options only
appear for the VCF-computed display, since pre-computed PLINK data carries only
the final R²/D' values. See the autogenerated [LDTrack](/docs/config/ldtrack),
[PlinkLDAdapter](/docs/config/plinkldadapter), and
[PlinkLDTabixAdapter](/docs/config/plinkldtabixadapter) docs for the full slot
reference.

## See also

- [Variant track](/docs/user_guides/variant_track) — using variant tracks in the
  app
- [Multi-sample variant display](/docs/user_guides/multivariant_track) —
  population-scale displays and clustering
- [Structural variant visualization](/docs/user_guides/sv_visualization) —
  interpreting SV calls
