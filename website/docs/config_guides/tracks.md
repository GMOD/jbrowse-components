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

Example `config.json` containing a track config for a BigBed file:

File locations in adapter configs use a `{ "uri": "..." }` object. The
`"locationType": "UriLocation"` field is optional for URI locations and can be
omitted — it is only needed when the type cannot be inferred (e.g. local file
paths on desktop).

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

## The displays array

Tracks can include a `displays` array to configure display-level settings such
as height, color callbacks, or which display type is active by default. Each
entry targets a specific display type via its `displayId`.

Displays are matched by their `type`. The `displayId` is optional — if you omit
it, JBrowse fills in the convention `{trackId}-{displayType}`, for example
`my_bam_track-LinearAlignmentsDisplay`. Settings like `color1`, `height`, and
`labels` go directly on the display entry.

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
      "color1": "jexl:get(feature,'strand')==1?'blue':'red'"
    }
  ]
}
```

Common display types and their `displayId` suffix:

| Track type             | Display type             |
| ---------------------- | ------------------------ |
| FeatureTrack           | LinearBasicDisplay       |
| AlignmentsTrack        | LinearAlignmentsDisplay  |
| VariantTrack           | LinearVariantDisplay     |
| MultiQuantitativeTrack | MultiLinearWiggleDisplay |
| QuantitativeTrack      | LinearWiggleDisplay      |

See the [config_guides](/docs/config_guide) for per-track display options.
