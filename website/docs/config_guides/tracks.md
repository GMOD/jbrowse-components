---
id: tracks
title: Configuring tracks
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

A reduced form is also accepted:

```json
{
  "type": "BigBedAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
}
```

## The displays array

Tracks can include a `displays` array to configure display-level settings such
as height, color callbacks, or which display type is active by default. Each
entry targets a specific display type via its `displayId`.

The `displayId` convention is `{trackId}-{displayType}`, for example
`my_bam_track-LinearAlignmentsDisplay`. JBrowse uses this convention internally
— if you omit the `displays` array the defaults are used, but if you provide a
`displays` entry without the correct `displayId` it will be silently ignored.

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
      "renderer": {
        "type": "SvgFeatureRenderer",
        "color1": "jexl:get(feature,'strand')==1?'blue':'red'"
      }
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
