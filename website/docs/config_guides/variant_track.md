---
id: variant_track
title: Variant track configuration
---

Example config:

```json
{
  "type": "VariantTrack",
  "trackId": "my track",
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

#### VcfTabixAdapter configuration options

- `vcfGzLocation` - a 'file location' for the bgzip'd VCF file
- `index` - a sub-configuration schema containing
  - indexType: 'TBI' or 'CSI'. Default: 'TBI'
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

## MultiVariant display configuration

The MultiVariant displays (`MultiLinearVariantDisplay` and
`LinearVariantMatrixDisplay`) are used for visualizing multi-sample VCF files.
They show genotype information across many samples in a heatmap-like
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
      "type": "MultiLinearVariantDisplay",
      "displayId": "my_vcf_track-MultiLinearVariantDisplay",
      "showReferenceAlleles": true
    },
    {
      "type": "LinearVariantMatrixDisplay",
      "displayId": "my_vcf_track-LinearVariantMatrixDisplay",
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
      "type": "MultiLinearVariantDisplay",
      "displayId": "diversity_panel-MultiLinearVariantDisplay",
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
      "type": "MultiLinearVariantDisplay",
      "displayId": "population_vcf-MultiLinearVariantDisplay",
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
      "type": "MultiLinearVariantDisplay",
      "displayId": "diversity_panel_colored-MultiLinearVariantDisplay",
      "showReferenceAlleles": true,
      "minorAlleleFrequencyFilter": 0.05,
      "colorBy": "population"
    }
  ]
}
```

### Notes

- The `showReferenceAlleles` option only affects the
  `MultiLinearVariantDisplay`. The `LinearVariantMatrixDisplay` uses a different
  visualization that doesn't draw reference alleles in the same way.
- Users can still change these settings at runtime using the track menu. The
  configuration values serve as the initial defaults.
- When a user changes a setting via the track menu, their preference is stored
  in the session and will override the configuration default for that session.
- The `colorBy` attribute must exist in the sample metadata TSV file. If the
  attribute is not found, a warning will be logged to the console and no
  automatic coloring will be applied.
- Users can still use the "Edit colors/arrangement" dialog to manually change
  colors or re-color by a different attribute at any time.
