---
title: Configuring tracks
description: Configuration options common to all track types
guide_category: Core configuration
---

All tracks can contain:

- `trackId` - internal track ID, must be unique
- `name` - displayed track name
- `assemblyNames` - an array of assembly names a track is associated with, often
  just a single assemblyName
- `category` - (optional) array of categories to display in a hierarchical track
  selector

File locations in adapter configs use a `{ "uri": "..." }` object. The
`"locationType": "UriLocation"` field is optional for URI locations and can be
omitted — it is only needed when the type cannot be inferred (e.g. local file
paths on desktop).

Example `config.json` containing a track config for a BigBed file:

```json
{
  "assemblies": [
    ...the hg19 assembly...
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "repeats_hg19",
      "name": "Repeats",
      "assemblyNames": ["hg19"],
      "category": ["Annotation"],
      "adapter": {
        "type": "BigBedAdapter",
        "bigBedLocation": {
          "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
        }
      }
    }
  ]
}
```

A reduced form is also accepted (see the
[BigBedAdapter config docs](/docs/config/bigbedadapter) for all options):

```json
{
  "type": "BigBedAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
}
```

#### Gff3TabixAdapter

The most common adapter for GFF3 feature tracks. Requires a bgzip-compressed,
tabix-indexed GFF3 file:

```json
{
  "type": "Gff3TabixAdapter",
  "gffGzLocation": {
    "uri": "http://yourhost/file.gff3.gz"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.gff3.gz.tbi"
    }
  }
}
```

- `gffGzLocation` - a 'file location' for the bgzip'd GFF3
- `index` - a sub-configuration schema containing
  - `indexType`: 'TBI' or 'CSI'. Default: 'TBI'. Use CSI for chromosomes longer
    than 512 Mb
  - `location`: a 'file location' for the index
- `dontRedispatch` - array of feature types to skip re-fetching when a feature
  extends outside the requested region. Default:
  `["chromosome", "region", "contig"]`

A reduced form is also accepted: when only `uri` is given, the adapter assumes
the index is at `yourfile.gff3.gz.tbi` (the data URI with `.tbi` appended). See
the [Gff3TabixAdapter config docs](/docs/config/gff3tabixadapter) for all
options.

```json
{ "type": "Gff3TabixAdapter", "uri": "http://yourhost/file.gff3.gz" }
```

## Configuring displays

Appearance settings — `color`, `height`, `labels`, jexl color callbacks, and so
on — belong to a track's **displays** (the different ways a track can be drawn).
The `displays` field accepts two shapes: a simple object for the common case, or
the full array when you need precise control.

### Shorthand object

Put your settings in a `displays` object and JBrowse applies each one for you —
you don't have to know or write the display's name:

```json
{
  "type": "FeatureTrack",
  "trackId": "repeats_hg19",
  "name": "Repeats",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
  },
  "displays": { "color": "green", "height": 200 }
}
```

JBrowse applies each setting to the display that uses it. If a track can be
drawn more than one way, each setting lands where it fits — e.g. a
`VariantTrack` colors its linear display with `color` and its circular (chord)
display with `strokeColor`, both in the same object:

```json
{
  "type": "VariantTrack",
  "trackId": "variants_hg19",
  "name": "Variants",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/file.vcf.gz"
  },
  "displays": { "color": "green", "strokeColor": "red" }
}
```

A setting that nothing on the track uses is ignored, with a console warning so
typos show up.

### Full array

For precise control — giving two displays different values for the same setting,
choosing which display is the default, or setting an explicit `displayId` — pass
`displays` as an array. Each entry names a display `type`; `displayId` is
optional and defaults to `{trackId}-{displayType}`.

```json
{
  "type": "FeatureTrack",
  "trackId": "repeats_hg19",
  "name": "Repeats",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigBedAdapter",
    "bigBedLocation": { "uri": "https://jbrowse.org/genomes/hg19/repeats.bb" }
  },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "displayId": "repeats_hg19-LinearBasicDisplay",
      "height": 200,
      "color": "jexl:get(feature,'strand')==1?'blue':'red'"
    }
  ]
}
```

Common display types, for the array form:

| Track type             | Display type             |
| ---------------------- | ------------------------ |
| FeatureTrack           | LinearBasicDisplay       |
| AlignmentsTrack        | LinearAlignmentsDisplay  |
| VariantTrack           | LinearVariantDisplay     |
| MultiQuantitativeTrack | MultiLinearWiggleDisplay |
| QuantitativeTrack      | LinearWiggleDisplay      |

See the [config_guides](/docs/config_guide) for per-track display options.
