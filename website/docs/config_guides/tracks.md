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

The same config, with the track written short:

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

The track type and adapter come from the extension, the same guess the "Add
track" dialog makes (see [file types](/docs/config_guides/file_types)). The
index location is derived, and `name` defaults to the file name. With one
assembly in the config the track is on it; with several, write `assemblyNames`.
Any other key beside `uri` wins over the guess: `name`, `category`,
`displayDefaults`, `index` for an index elsewhere, or `type` to pick a track
type the extension would not.

The same entry works in `createViewState`'s `tracks`, where the component
supplies the assembly. In a session's `sessionTracks` nothing implies one, so
write `assemblyNames` there.

## Configuring displays

Appearance settings (`color`, `height`, `labels`, jexl color callbacks) belong
to a track's **displays**, the different ways a track can be drawn. Set them in
a `displayDefaults` object for the common case, or the full `displays` array for
precise control.

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

A setting goes to every display with a slot by that name. Displays drawn
differently usually name their slots differently, so each setting lands where it
belongs: a `VariantTrack` colors its linear display with `color` and its chord
display with `strokeColor`, both in the same object.

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

To give two displays different values for one setting, choose the default
display, or set an explicit `displayId`, pass `displays` as an array. Each entry
names a display `type`; `displayId` defaults to `{trackId}-{displayType}`. The
two forms combine, and an explicit entry wins over `displayDefaults`.

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

From the track menu on the track label:

- **Copy track** copies the track's full config JSON. **Copy and open track**
  also opens the copy in the current view
- **Settings** opens the configuration editor, where every slot's current value
  can be reviewed and copied. A non-admin's edits become a per-session override,
  and "Reset track settings" clears it

Either way the result pastes into `config.json` or into a
[generation script](/docs/config_guides/deploying/#generating-configjson-from-a-script).

## The "Zoom in to see more features" limits

Two limits guard the region, and either shows the message: the bytes the fetch
would download, and the features that would land on screen. The banner reads
"Zoom in to see features or force load (may be slow)", usually with the
estimated size, and **Force load** downloads the region anyway.

On alignments and MAF tracks the message can appear at any zoom, because their
cost scales with read depth or the number of aligned species, which zooming does
not reduce. Other tracks are not guarded below about 20 kb.

### Raising the feature limit

[`maxFeatureScreenDensity`](/docs/config/baselineardisplay/#slot-maxfeaturescreendensity)
is **features per pixel of track width**, so the budget grows with the window.
At the default of `1`, a track draws roughly as many features as the window is
pixels wide; `2` allows twice that.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dense_genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "maxFeatureScreenDensity": 5 }
}
```

For a one-off, **Force load** needs no config change. Where nobody can press the
button (an embedded view, a notebook, a screenshot), set
[`forceLoad`](/docs/config/baselineardisplay/#slot-forceload) on the display.

### Raising the byte limit

[`fetchSizeLimit`](/docs/config/baselineardisplay/#slot-fetchsizelimit) is a
plain byte count. Regions under 20kb are never held back, and adapters that
summarize at screen resolution (bigWig, Hi-C, MultiWiggle, sequence) are never
too large, so neither limit applies to them.

The BAM, CRAM and VCF adapters have their own `fetchSizeLimit`, and an adapter's
limit takes priority over the display's, so for those formats set it on the
adapter:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_cram",
  "name": "volvox CRAM (small fetch size limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "volvox-sorted.cram",
    "fetchSizeLimit": 1000
  }
}
```

## Finding every option for a track or adapter type

Every slot for every track, display and adapter type is in the generated
**config reference**, in the docs sidebar. For example:

- [](/docs/config/bamadapter), [](/docs/config/vcftabixadapter),
  [](/docs/config/bigwigadapter)
- [](/docs/config/linearalignmentsdisplay), [](/docs/config/linearwiggledisplay)

## See also

- [](/docs/config_guides/file_types)
- [](/docs/config_guides/track_selector)
- [](/docs/config_guides/deploying#generating-configjson-from-a-script)
- [](/docs/tutorials/display_settings)
