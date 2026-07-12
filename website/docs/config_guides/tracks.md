---
title: Tracks
description: Configuration options common to all track types
guide_category: Core configuration
---

All tracks can contain:

- `trackId` - internal track ID, must be unique
- `name` - displayed track name
- `assemblyNames` - an array of assembly names a track is associated with, often
  just a single assemblyName
- `category` - (optional) array of categories to display in a
  [hierarchical track selector](/docs/config_guides/track_selector)

See the [BaseTrack config docs](/docs/config/basetrack) for every slot common to
all track types.

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

Most adapters also accept a reduced `uri` shorthand that auto-resolves the
companion index. See [Supported file types](/docs/config_guides/file_types) for
the per-format adapters and the `uri` shorthand:

```json
{
  "type": "BigBedAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
}
```

## Configuring displays

Appearance settings — `color`, `height`, `labels`, jexl color callbacks, and so
on — belong to a track's **displays** (the different ways a track can be drawn).
There are two ways to set them: the `displayDefaults` object for the common
case, or the full `displays` array when you need precise control.

### Shorthand object

Put your settings in a `displayDefaults` object and JBrowse applies each one for
you — you don't have to know or write the display's name:

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
  "displayDefaults": { "color": "green", "height": 200 }
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
  "displayDefaults": { "color": "green", "strokeColor": "red" }
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
      "color": "jexl:feature.strand==1?'blue':'red'"
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

See the [config guides](/docs/config_guide) for per-track display options.

## Copying a track's config out of the app

If you have configured a track the way you like it in the app and want the raw
JSON to reuse elsewhere, you don't have to reconstruct it by hand:

- **Copy track**: in the track menu (the dropdown on the track label), choose
  "Copy track" to copy the track's full config JSON. "Copy and open track" does
  the same and immediately opens the copy in the current view.
- **Settings**: also in the track menu, "Settings" opens the configuration
  editor for that track, where you can review and copy every slot's current
  value. Any user can do this, not just admins. A non-admin's edits become a
  per-session override rather than changes to the shared `config.json`, and
  "Reset track settings" clears it.

This is the easiest way to turn a tweaked-in-the-UI track into a JSON snippet
you can paste into `config.json` or into a
[generation script](/docs/config_guides/deploying/#generating-configjson-from-a-script).

## Finding every option for a track or adapter type

The config guides cover common settings. The complete list of every slot for
every track, display, and adapter type is the auto-generated **config
reference**, built from the source so it never drifts. For example:

- [BamAdapter](/docs/config/bamadapter),
  [VcfTabixAdapter](/docs/config/vcftabixadapter),
  [BigWigAdapter](/docs/config/bigwigadapter)
- [LinearAlignmentsDisplay](/docs/config/linearalignmentsdisplay),
  [LinearWiggleDisplay](/docs/config/linearwiggledisplay)

The full set of pages is in the **Config reference** section of the docs
sidebar.

## See also

- [Supported file types](/docs/config_guides/file_types) — per-format adapter
  reference
- [Hierarchical track selector](/docs/config_guides/track_selector) — where the
  `category` field described above is consumed
- [Deploying JBrowse Web](/docs/config_guides/deploying#generating-configjson-from-a-script)
  — generating track configs from a script
- [Display settings](/docs/tutorials/display_settings) — opening a track in a
  particular display state via URL instead of editing the config default
