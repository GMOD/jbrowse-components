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

A complete `config.json` with one assembly and one BigBed track, showing where a
track sits:

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

- `trackId` is the unique id every session and link names the track by;
  `assemblyNames` ties it to the assembly above; `category` nests it in the
  [track selector](/docs/config_guides/track_selector). Every slot common to all
  track types is on the [BaseTrack config docs](/docs/config/basetrack).
- The adapter uses the
  [`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) (longhand
  here: `"bigBedLocation": { "uri": "..." }`). A `{ "uri": "..." }` location
  needs `"locationType"` only where the type cannot be inferred, such as a local
  file path on desktop.

## The shortest track

The same track written short:

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

The type, adapter and index location come from the extension, the same guess the
"Add track" dialog makes, `name` defaults to the file name, and a config with
one assembly supplies `assemblyNames`. Any key written beside `uri` wins over
the guess
([the whole-track shorthand](/docs/config_guides/file_types#the-whole-track-shorthand)
lists the extensions). Two places imply no assembly: a session's
`sessionTracks`, where a track without `assemblyNames` belongs to nothing, and a
config with several assemblies. Name it there.

## Configuring displays

Appearance settings belong to a track's **displays**, the ways a track can be
drawn. A `displayDefaults` object routes each setting to every display whose
schema has a slot by that name:

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
  "displayDefaults": { "color": "green", "strokeColor": "red", "height": 200 }
}
```

- **Differently named slots land on different displays.** `color` reaches the
  linear display and `strokeColor` the circular (chord) one.
- **A shared name reaches every display.** `height` sets all of them.
- **A name no display defines is ignored**, with a console warning so typos show
  up.

A `displays` array gives precise control: two displays with different values for
one setting, a non-default display type, or an explicit `displayId` (default
`{trackId}-{displayType}`). An entry wins over `displayDefaults` for any setting
it names itself.

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

The display types, grouped by the track type they attach to:

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

## Copying a track's config out of the app

- **Copy track** in the track menu copies the track's full config JSON; "Copy
  and open track" also opens the copy in the current view.
- **Settings** in the same menu opens the configuration editor, where every
  slot's current value can be read off. A non-admin's edits become a per-session
  override of the shared `config.json`, and "Reset track settings" clears it.

## The "Zoom in to see more features" limits

Two limits guard a region, and either one shows "Zoom in to see features or
force load (may be slow)" with a **Force load** button: the bytes the fetch
would download, and the features that would land on screen. Regions under about
20 kb are never held back, and adapters that summarize at screen resolution
(bigWig, Hi-C, MultiWiggle, sequence) are never too large.

Alignments and MAF tracks are the exception: their cost per reference base
scales with read depth or with the number of aligned species, which zooming does
not reduce, so the message can appear at any zoom and offers only **Force
load**.

### Raising the feature limit

[`maxFeatureScreenDensity`](/docs/config/baselineardisplay/#slot-maxfeaturescreendensity)
is features per pixel of track width, so the budget grows with the window:

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

Where nobody can press the button (an embedded view, a notebook, a screenshot),
[`forceLoad`](/docs/config/baselineardisplay/#slot-forceload) on the display
loads the region regardless.

### Raising the byte limit

[`fetchSizeLimit`](/docs/config/baselineardisplay/#slot-fetchsizelimit) is a
byte count. The BAM, CRAM and VCF adapters carry their own `fetchSizeLimit`,
which takes priority over the display's, so for those formats set it on the
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

## See also

- [](/docs/config_guides/file_types)
- [](/docs/config_guides/track_selector)
- [](/docs/config_guides/deploying#generating-configjson-from-a-script)
- [](/docs/tutorials/display_settings)
- [Config reference](/docs/config), every slot of every track, display and
  adapter type
