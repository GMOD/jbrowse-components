---
title: Tracks
description: Configuration options common to all track types
guide_category: Core configuration
---

**TL;DR:** a track is a `trackId`, a `uri` and the `assemblyNames` it sits on;
JBrowse reads the track type and adapter off the file's extension. Write `type`
and `adapter` out when the extension does not say enough, and put appearance
settings (`color`, `height`, etc.) in a `displayDefaults` object, which JBrowse
routes to the right display.

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
`"locationType": "UriLocation"` field is optional for URI locations, and needed
only where the type cannot be inferred (e.g. local file paths on desktop).

A complete `config.json` with one assembly and one BigBed track, showing where a
track config sits:

```json
{
  "assemblies": [
    {
      "name": "hg19",
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
    }
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

Two shorthands keep it short: the assembly is written as just `{ name, uri }`
(see [assemblies](/docs/config_guides/assemblies)), and the adapter uses the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand), whose
longhand equivalent here is `"bigBedLocation": { "uri": "..." }`. The track's
`assemblyNames` is what ties it to the `hg19` assembly above.

## The shortest track

A track is its id, its file and the assembly it sits on — and the config below
declares one assembly, so the track need not name it. The same config, with the
track written that way:

```json
{
  "assemblies": [
    {
      "name": "hg19",
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
    }
  ],
  "tracks": [
    {
      "trackId": "repeats_hg19",
      "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
    }
  ]
}
```

The track type and adapter come from the file's extension, the same guess the
"Add track" dialog makes (see [file types](/docs/config_guides/file_types) for
which extension gives which adapter), the index location is derived as the
adapter shorthand derives it, and `name` defaults to the file name. With one
assembly in the config the track is on it; with several, write `assemblyNames`.
Any other key sits beside `uri` and wins over the guess — `name`, `category`,
`displayDefaults`, `index` for an index that is not at the derived location, or
`type` to pick a track type the extension would not. `jbrowse validate` accepts
the form.

The same entry works in `createViewState`'s `tracks`, where the component stamps
on the assembly it was given, and in a session's `sessionTracks`, where nothing
implies one: a session track written without `assemblyNames` gets an empty list
and belongs to no assembly, so name it there.

## Configuring displays

Appearance settings (`color`, `height`, `labels`, jexl color callbacks, and so
on) belong to a track's **displays** (the different ways a track can be drawn).
There are two ways to set them: the `displayDefaults` object for the common
case, or the full `displays` array when you need precise control.

### Shorthand object

Put your settings in a `displayDefaults` object and JBrowse applies each one to
the display that defines it:

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

A setting goes to every display whose config schema has a slot by that name.
Displays drawn differently usually name their slots differently, so each setting
lands on the display it belongs to: a `VariantTrack` colors its linear display
with `color` and its circular (chord) display with `strokeColor`, both in the
same object.

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

Where a name is shared, the setting reaches all of them: `height` in
`displayDefaults` sets the height of every display the track has. A setting no
display defines is ignored, with a console warning so typos show up.

### Full array

For precise control (giving two displays different values for the same setting,
choosing which display is the default, or setting an explicit `displayId`), pass
`displays` as an array. Each entry names a display `type`; `displayId` is
optional and defaults to `{trackId}-{displayType}`. The two forms combine, and
an explicit entry wins over `displayDefaults` for any setting it names itself.

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
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "height": 200,
      "color": "jexl:feature.strand==1?'blue':'red'"
    }
  ]
}
```

The display types available, grouped by the track type they attach to. Most
tracks can be drawn more than one way, and the `displays` array picks which:

<!-- DISPLAY_TYPES START -->

<!-- prettier-ignore -->
| Track type | Display types |
| --- | --- |
| [](/docs/config/alignmentstrack) | [](/docs/config/linearalignmentsdisplay) |
| [](/docs/config/featuretrack) | [](/docs/config/lineararcdisplay)<br/>[](/docs/config/linearbasicdisplay)<br/>[](/docs/config/linearmultirowfeaturedisplay)<br/>[](/docs/config/linearscoredisplay) |
| [](/docs/config/gccontenttrack) | [](/docs/config/lineargccontenttrackdisplay) |
| [](/docs/config/gwastrack) | [](/docs/config/linearmanhattandisplay) |
| [](/docs/config/hictrack) | [](/docs/config/linearhicdisplay) |
| [](/docs/config/ldtrack) | [](/docs/config/ldtrackdisplay) |
| [](/docs/config/maftrack) | [](/docs/config/linearmafdisplay) |
| [](/docs/config/multiquantitativetrack) | [](/docs/config/multilinearwiggledisplay) |
| [](/docs/config/quantitativetrack) | [](/docs/config/linearwiggledisplay) |
| [](/docs/config/referencesequencetrack) | [](/docs/config/lineargccontentdisplay)<br/>[](/docs/config/linearreferencesequencedisplay) |
| [](/docs/config/syntenytrack) | [](/docs/config/dotplotdisplay)<br/>[](/docs/config/lgvsyntenydisplay)<br/>[](/docs/config/linearsyntenydisplay)<br/>[](/docs/config/multiwaysyntenydisplay) |
| [](/docs/config/varianttrack) | [](/docs/config/chordvariantdisplay)<br/>[](/docs/config/lddisplay)<br/>[](/docs/config/linearmultisamplevariantdisplay)<br/>[](/docs/config/linearmultisamplevariantmatrixdisplay)<br/>[](/docs/config/linearpairedarcdisplay)<br/>[](/docs/config/linearvariantdisplay) |

<!-- DISPLAY_TYPES END -->

See the [config guides](/docs/config_guide) for per-track display options.

## Copying a track's config out of the app

To get the raw JSON of a track you configured in the app:

- **Copy track**: in the track menu (the dropdown on the track label), choose
  "Copy track" to copy the track's full config JSON. "Copy and open track" does
  the same and immediately opens the copy in the current view.
- **Settings**: also in the track menu, "Settings" opens the configuration
  editor for that track, where you can review and copy every slot's current
  value. Any user can do this: a non-admin's edits become a per-session override
  rather than changes to the shared `config.json`, and "Reset track settings"
  clears it.

Either way the result pastes into `config.json` or into a
[generation script](/docs/config_guides/deploying/#generating-configjson-from-a-script).

## Finding every option for a track or adapter type

The config guides cover common settings. Every slot for every track, display,
and adapter type is in the auto-generated **config reference**, built from
source. For example:

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
