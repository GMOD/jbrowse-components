---
title: Tracks
description: Configuration options common to all track types
guide_category: Core configuration
---

**TL;DR:** every track needs a `trackId`, `name`, `assemblyNames`, and an
`adapter`. Put appearance settings (`color`, `height`, etc.) in a
`displayDefaults` object and JBrowse routes each one to the right display.

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
omitted. It is only needed when the type cannot be inferred (e.g. local file
paths on desktop).

A complete `config.json` with one assembly and one BigBed track, showing where a
track config sits:

```json
{
  "assemblies": [
    { "name": "hg19", "uri": "https://jbrowse.org/genomes/hg19/hg19.fa.gz" }
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
        "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
      }
    }
  ]
}
```

That is a complete, working config. Two shorthands keep it short: the assembly
is written as just `{ name, uri }` (see
[assemblies](/docs/config_guides/assemblies)), and the adapter uses the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand), whose
longhand equivalent here is `"bigBedLocation": { "uri": "..." }`. The track's
`assemblyNames` is what ties it to the `hg19` assembly above.

## Configuring displays

Appearance settings (`color`, `height`, `labels`, jexl color callbacks, and so
on) belong to a track's **displays** (the different ways a track can be drawn).
There are two ways to set them: the `displayDefaults` object for the common
case, or the full `displays` array when you need precise control.

### Shorthand object

Put your settings in a `displayDefaults` object and JBrowse applies each one for
you. You don't have to know or write the display's name:

```json addtrack
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
drawn more than one way, each setting lands where it fits, e.g. a `VariantTrack`
colors its linear display with `color` and its circular (chord) display with
`strokeColor`, both in the same object:

```json addtrack
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

For precise control (giving two displays different values for the same setting,
choosing which display is the default, or setting an explicit `displayId`), pass
`displays` as an array. Each entry names a display `type`. `displayId` is
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

The display types available, grouped by the track type they attach to. Most
tracks can be drawn more than one way, and the `displays` array is where you
pick which:

<!-- DISPLAY_TYPES START -->

<!-- prettier-ignore -->
| Track type | Display types |
| --- | --- |
| [](/docs/config/alignmentstrack) | [](/docs/config/linearalignmentsdisplay) |
| [](/docs/config/featuretrack) | [](/docs/config/lineararcdisplay)<br/>[](/docs/config/linearbasicdisplay)<br/>[](/docs/config/linearmultirowfeaturedisplay)<br/>[](/docs/config/linearscoredisplay) |
| [](/docs/config/gccontenttrack) | LinearGCContentTrackDisplay |
| [](/docs/config/gwastrack) | [](/docs/config/linearmanhattandisplay) |
| [](/docs/config/hictrack) | [](/docs/config/linearhicdisplay) |
| [](/docs/config/ldtrack) | LDTrackDisplay |
| [](/docs/config/maftrack) | [](/docs/config/linearmafdisplay) |
| [](/docs/config/multiquantitativetrack) | [](/docs/config/multilinearwiggledisplay) |
| [](/docs/config/quantitativetrack) | [](/docs/config/linearwiggledisplay) |
| [](/docs/config/referencesequencetrack) | LinearGCContentDisplay<br/>[](/docs/config/linearreferencesequencedisplay) |
| [](/docs/config/syntenytrack) | [](/docs/config/dotplotdisplay)<br/>[](/docs/config/lgvsyntenydisplay)<br/>[](/docs/config/linearsyntenydisplay) |
| [](/docs/config/varianttrack) | [](/docs/config/chordvariantdisplay)<br/>LDDisplay<br/>[](/docs/config/linearmultisamplevariantdisplay)<br/>[](/docs/config/linearmultisamplevariantmatrixdisplay)<br/>[](/docs/config/linearpairedarcdisplay)<br/>[](/docs/config/linearvariantdisplay) |

<!-- DISPLAY_TYPES END -->

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

The config guides cover common settings. Every slot for every track, display,
and adapter type is in the auto-generated **config reference**, built from
source so it never drifts. For example:

- [](/docs/config/bamadapter), [](/docs/config/vcftabixadapter),
  [](/docs/config/bigwigadapter)
- [](/docs/config/linearalignmentsdisplay), [](/docs/config/linearwiggledisplay)

The full set of pages is in the **Config reference** section of the docs
sidebar.

## See also

- [](/docs/config_guides/file_types)
- [](/docs/config_guides/track_selector)
- [](/docs/config_guides/deploying#generating-configjson-from-a-script)
- [](/docs/tutorials/display_settings)
