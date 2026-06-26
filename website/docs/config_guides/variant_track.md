---
title: Variant track configuration
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
    "vcfGzLocation": {
      "uri": "http://yourhost/file.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/file.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  }
}
```

## VcfTabixAdapter configuration options

- `vcfGzLocation` - a 'file location' for the bgzip'd VCF file
- `index` - a sub-configuration schema containing
  - indexType: 'TBI' or 'CSI'. Default: 'TBI'. Use CSI for chromosomes longer
    than 512 Mb (e.g. some plant genomes) since TBI cannot index them
  - location: a 'file location' for the index

Example VcfTabixAdapter adapter config:

```json
{
  "type": "VcfTabixAdapter",
  "vcfGzLocation": {
    "uri": "http://yourhost/file.vcf.gz",
    "locationType": "UriLocation"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.vcf.gz.tbi",
      "locationType": "UriLocation"
    }
  }
}
```

A reduced form is also accepted: when only `uri` is given, the adapter assumes
the index is at `yourfile.vcf.gz.tbi` (the data URI with `.tbi` appended). See
the [VcfTabixAdapter config docs](/docs/config/vcftabixadapter) for all options.

```json
{ "type": "VcfTabixAdapter", "uri": "http://yourhost/file.vcf.gz" }
```

## Coloring variants by type

Use a jexl expression on the display's `color` slot to color variants by their
`SVTYPE` INFO field (or any other VCF field). The expression reads the INFO
field via `get(feature,'INFO').SVTYPE` and maps it to a color:

```json
{
  "type": "VariantTrack",
  "trackId": "my_sv_track",
  "name": "SVs colored by type",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "http://yourhost/svs.vcf.gz"
  },
  "displays": {
    "color": "jexl:({'DEL':'red','INS':'blue','DUP':'green','INV':'orange','BND':'purple','TRA':'purple'})[get(feature,'INFO').SVTYPE[0]] || 'gray'"
  }
}
```

The `displays` object is shorthand — JBrowse applies the `color` to the variant
display for you, so you don't have to know the display's name
(`LinearVariantDisplay`) or write the array. For per-display control use the
array form (see the
[track config guide](/docs/config_guides/tracks/#configuring-displays)).

The `|| 'gray'` fallback colors any SVTYPE not in the map (or variants without
an SVTYPE field) gray. INFO fields are parsed as arrays, so index the first
value (`[0]`) as shown above. You can use the same pattern for SNP/INDEL VCFs by
reading `get(feature,'INFO').CLNSIG[0]` or any other INFO key. See
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
more jexl color examples.

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
    "vcfGzLocation": {
      "uri": "http://yourhost/samples.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/samples.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
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

You can combine multiple settings to customize the default behavior:

```json
{
  "type": "VariantTrack",
  "trackId": "diversity_panel",
  "name": "Diversity Panel",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "http://yourhost/diversity.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/diversity.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
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

#### Step 1: Provide sample metadata via samplesTsvLocation

First, configure your adapter with a `samplesTsvLocation` that points to a TSV
file with sample metadata. The first column must be `name` (the sample names
matching the VCF), and subsequent columns are arbitrary metadata attributes:

```tsv
name	population	region	phenotype
SAMPLE001	EUR	Western	case
SAMPLE002	AFR	Eastern	control
SAMPLE003	EUR	Western	control
SAMPLE004	EAS	Pacific	case
```

#### Step 2: Configure colorBy on the display

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
    "vcfGzLocation": {
      "uri": "http://yourhost/samples.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/samples.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    },
    "samplesTsvLocation": {
      "uri": "http://yourhost/sample_metadata.tsv",
      "locationType": "UriLocation"
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

With this configuration, when the track loads, samples will automatically be
colored based on their `population` value. Each unique value (EUR, AFR, EAS,
etc.) will be assigned a distinct color from the palette.

#### Complete example with all options

Here's a complete example that uses sample metadata coloring along with other
display options:

```json
{
  "type": "VariantTrack",
  "trackId": "diversity_panel_colored",
  "name": "Diversity Panel (Colored by Population)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "http://yourhost/diversity.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/diversity.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    },
    "samplesTsvLocation": {
      "uri": "http://yourhost/sample_populations.tsv",
      "locationType": "UriLocation"
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
- Users can still change these settings at runtime using the track menu. The
  configuration values serve as the initial defaults.
- When a user changes a setting via the track menu, their preference is stored
  in the session and will override the configuration default for that session.
- The `colorBy` attribute must exist in the sample metadata TSV file. If the
  attribute is not found, a warning will be logged to the console and no
  automatic coloring will be applied.
- Users can still use the "Edit colors/arrangement" dialog to manually change
  colors or re-color by a different attribute at any time.

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

The PLINK `--r2` command and the bgzip/tabix steps for the tabix adapter are
documented in the
[GWAS track guide → Preparing the LD file](/docs/config_guides/gwas_track#preparing-the-ld-file)
— the same `.ld` file is used both for coloring GWAS points by LD and for the
standalone LD track here.

### Pre-computed LD track (plain `.ld`)

```json
{
  "type": "LDTrack",
  "trackId": "ld_plink",
  "name": "Linkage disequilibrium",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "PlinkLDAdapter",
    "ldLocation": {
      "uri": "https://yourhost/study.ld",
      "locationType": "UriLocation"
    }
  }
}
```

The adapter also accepts a `uri` shorthand
(`"adapter": { "type": "PlinkLDAdapter", "uri": "study.ld" }`), which expands to
the `ldLocation` slot above.

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
    "ldLocation": {
      "uri": "https://yourhost/study.ld.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/study.ld.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  }
}
```

This adapter accepts a `uri` shorthand too; it assumes a sibling `<uri>.tbi`
index.

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
    "vcfGzLocation": {
      "uri": "https://yourhost/variants.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/variants.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
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
