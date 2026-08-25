---
title: Cookbook
sidebar_label: Cookbook (config recipes)
description:
  'Copy-paste recipes for the most common JBrowse 2 configuration tasks: colors,
  labels, tooltips, tracks, themes, and more'
---

Short, copy-paste recipes for the `config.json` settings people reach for most.
Most run against the `volvox` sample data JBrowse ships
([`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox));
the synteny recipes and every figure use real datasets. For the full reference,
see the [config guide](/docs/config_guide).

## The smallest config

A `config.json` needs two things: an assembly to supply the reference sequence,
and a track to draw on it. Both are a name and a file.

```json
{
  "assemblies": [{ "name": "volvox", "uri": "volvox.2bit" }],
  "tracks": [{ "trackId": "genes", "uri": "volvox.sort.gff3.gz" }]
}
```

That is a complete, working file. Everything else on this page is optional.

JBrowse reads the track type and the adapter off the file's extension, takes
`name` from the file name, and puts the track on the one assembly the config
declares. The same track written out, which is what every recipe below starts
from — each key beside `uri` overrides what the extension implied:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" }
}
```

See [the shortest track](/docs/config_guides/tracks#the-shortest-track) for what
the extension decides and how to override each piece of it.

## A complete config

Here is the same file with the settings people usually reach for: a track of
each common type, display settings on each, a view to open on load, and a theme.
Two more top-level keys join `assemblies` and `tracks`: `defaultSession` says
what to open on load, and `configuration` holds instance-wide settings like the
theme. Every recipe below changes one piece of it.

```json
{
  "assemblies": [{ "name": "volvox", "uri": "volvox.2bit" }],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "genes",
      "name": "Genes",
      "category": ["Annotation"],
      "assemblyNames": ["volvox"],
      "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
      "displayDefaults": {
        "color": "jexl:feature.strand==1?'#1f77b4':'#d62728'",
        "height": 200,
        "mouseover": "jexl:feature.name"
      }
    },
    {
      "type": "AlignmentsTrack",
      "trackId": "reads",
      "name": "Reads",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
      "displayDefaults": {
        "heightMode": "fit",
        "colorBy": { "type": "mappingQuality" },
        "filterBy": { "flagExclude": 1540, "flagInclude": 0 }
      }
    },
    {
      "type": "QuantitativeTrack",
      "trackId": "coverage",
      "name": "Coverage",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
      "displayDefaults": {
        "color": "#C8B414",
        "scaleType": "log",
        "minScore": 0
      }
    },
    {
      "type": "VariantTrack",
      "trackId": "variants",
      "name": "Variants",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "VcfTabixAdapter", "uri": "volvox.filtered.vcf.gz" },
      "displayDefaults": {
        "color": "jexl:feature.type=='SNV'?'green':'purple'",
        "jexlFilters": ["feature.INFO.AF[0] > 0.05"]
      }
    }
  ],
  "defaultSession": {
    "name": "My session",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "loc": "ctgA:1-50000",
          "assembly": "volvox",
          "tracks": ["genes", "reads", "coverage", "variants"]
        }
      }
    ]
  },
  "configuration": {
    "theme": { "palette": { "primary": { "main": "#311b92" } } }
  }
}
```

### Jump to a recipe

| To change                                 | Setting                                    | Section                                                                                           |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Data file and index                       | `adapter`, `uri`                           | [shorthand](#config-shorthand), [assemblies](#assemblies)                                         |
| Feature color                             | `color`, `colorBy`                         | [colors](#colors)                                                                                 |
| Feature labels and tooltips               | `labels`, `mouseover`                      | [labels & tooltips](#labels-tooltips-details)                                                     |
| Click-details panel                       | `formatDetails`                            | [feature details](#customizing-the-feature-details-panel)                                         |
| Track height and packing                  | `height`, `heightMode`, `displayMode`      | [feature tracks](#feature-tracks)                                                                 |
| Feature and read filtering                | `jexlFilters`, `filterBy`                  | [filtering](#showing-only-some-features-filtering), [SAM flags](#filter-reads-by-sam-flag-or-tag) |
| Read grouping and clipping                | `groupBy`, `showSoftClipping`              | [alignments tracks](#alignments-tracks)                                                           |
| A track with no data file                 | `MotifListAdapter`, `CrisprGuideAdapter`   | [computed from the reference](#reference-scan)                                                    |
| Plot style and scale                      | `defaultRendering`, `scaleType`            | [wiggle tracks](#quantitative-wiggle-tracks)                                                      |
| Multiple signals per track                | `subadapters`                              | [multi-signal wiggle](#multiple-signals-on-one-track-each-its-own-color)                          |
| Genotype matrix                           | `displays`                                 | [variant tracks](#variant-tracks)                                                                 |
| Assembly-to-assembly alignment            | `queryAssembly`, `targetAssembly`          | [synteny](#synteny-and-dotplot-tracks), [stacking N genomes](#synteny-stacking)                   |
| Folders, metadata, theme, search, plugins | `category`, `metadata`, `theme`, `plugins` | [instance-wide settings](#instance-wide-settings)                                                 |
| Opening view                              | `defaultSession`, URL params               | [config to a URL](#from-config-to-a-url)                                                          |

## Config shorthand

JBrowse expands these at load time, so you write only what matters:

- **`uri` on an adapter** fills in the location slot and the companion index
  (`.bam` → `.bam.bai`, `.cram` → `.cram.crai`, bgzip+tabix → `.tbi`). For a
  `.csi` or non-sibling index, write the
  [full form](/docs/config_guides/file_types#the-uri-shorthand).
- **`{ name, uri }` is a whole assembly.** JBrowse picks the adapter from the
  extension, finds the index siblings, and adds the `ReferenceSequenceTrack`.
  See [`BaseAssembly`](/docs/config/baseassembly).
- **`displayDefaults`** routes each setting to the display that defines it, so
  you never name a display or write a `displays` array. If you use a key that no
  display defines, JBrowse warns in the console. Write `displays` only to pick a
  non-default display type (like the [arc display](#draw-features-as-arcs)).
- **A `jexl:` prefix** turns any slot into a per-feature callback. See
  [using jexl callbacks](/docs/config_guides/jexl).

The same objects work in `config.json`, in a `session=spec-…` URL, and in an
embedded `createViewState`. The app writes them back out too: **About → Copy
config** on a track, or **File → Export session** for the whole view.

## Applying a recipe from the CLI

`config.json` is plain JSON, so once you have more than a handful of similar
tracks, generating the `tracks` array from your samplesheet is easier than one
CLI call per file.

The [web quickstart](/docs/quickstart_web) covers `create`, `add-assembly`, and
`add-track`. Four `add-track` flags cover every recipe on this page:

| To set                                                        | Flag                         |
| ------------------------------------------------------------- | ---------------------------- |
| Color or height                                               | `--color`, `--height`        |
| Any other display setting: `labels`, `jexlFilters`, `groupBy` | `--displayDefaults '<json>'` |
| A non-default display, or a top-level field like `metadata`   | `--config '<json>'`          |
| Track folders                                                 | `--category "RNA-seq,Brain"` |

```bash
jbrowse add-track genes.gff3.gz --load copy --name Genes \
  --color 'jexl:feature.strand==1?"blue":"red"' --height 200
```

Wrap the value in single quotes and use double quotes _inside_ the jexl. Re-run
the command with `--force` to change a track you already added. See the
[CLI reference](/docs/cli).

## Assemblies

`{ name, uri }` picks the adapter off the extension, so you rarely have to name
one yourself. Here is what each extension resolves to, and the index files it
expects alongside:

| `uri`          | Adapter               | Expects                    |
| -------------- | --------------------- | -------------------------- |
| `genome.2bit`  | `TwoBitAdapter`       | nothing                    |
| `genome.fa.gz` | `BgzipFastaAdapter`   | `.fa.gz.fai`, `.fa.gz.gzi` |
| `genome.fa`    | `IndexedFastaAdapter` | `.fa.fai`                  |

`BgzipFastaAdapter` (`bgzip genome.fa` + `samtools faidx genome.fa.gz`) is
recommended for large genomes.

**Refname aliases** line up tracks that name the same chromosome differently
(chr1 vs 1 vs NC_000001). Point at a two-column chromAliases file:

```json addassembly
{
  "name": "volvox",
  "uri": "volvox.2bit",
  "refNameAliases": { "uri": "volvox.chromAliases.txt" }
}
```

See [assemblies](/docs/config_guides/assemblies) for the inline
`FromConfigAdapter` form.

## Colors

A track's color is the `color` key in `displayDefaults`. Give it a plain CSS
color, or a `jexl:` expression that runs once per feature.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_by_strand",
  "name": "Genes (colored by strand)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "color": "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'"
  }
}
```

Those are the colors **Color by... → Strand** writes, so a config that ships
this recipe and a reader who picks it from the track menu get the same picture,
and forward stays red everywhere in the app, synteny ribbons included. Keep the
direction if you pick your own colors, or a red block will mean "forward" in one
track and "inverted" in the one under it.

<Figure caption="NCBI RefSeq genes on hg38 with this recipe applied: forward-strand genes red, reverse-strand blue." src="/img/cookbook_color_by_strand.png"/>

### What you can color by

The expression sees the feature as `feature`, and every attribute is a plain
property on it: `feature.type`, `feature.strand` (`1`/`-1`/`0`),
`feature.score`, `feature.name`, `feature.start`/`end`, `feature.refName`, and
`feature.parent`. VCF `INFO` fields parse as arrays, so index them
(`feature.INFO.SVTYPE[0]`), and BAM/CRAM tags come from `getTag(feature, 'HP')`.

On a gene track the expression resolves once per exon, CDS and UTR, so a
transcript's own attribute is read with `feature.parent.myattr`. That reads
`undefined` at the top of the chain rather than raising, and a `color` that
comes out undefined paints magenta, so end the ternary on a real color. The full
list is in [using jexl callbacks](/docs/config_guides/jexl). Wrap a callback in
`log(...)` to print what it returns for each feature to the browser console.

### More ways to set `color`

Drop any of these into the same `displayDefaults`:

| Recipe                            | `displayDefaults`                                                                             | Notes                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Solid color                       | `{ "color": "#6a3d9a" }`                                                                      | any CSS color: hex, `rgb()`/`hsl()`, or a name   |
| By feature type (lookup table)    | `{ "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] \|\| 'gray'" }` | `\|\| 'gray'` catches anything not listed        |
| By a numeric threshold            | `{ "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }`                                 | a hard cutoff, not a gradient                    |
| Continuous gradient from a number | ``{ "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }``                                     | maps `feature.score` onto an HSL hue             |
| Auto color per category           | `{ "color": "jexl:randomColor(feature.type)" }`                                               | same string always gets the same color           |
| BED file's own colors             | leave `color` unset                                                                           | automatic, see below                             |
| BAM/CRAM tag (`AlignmentsTrack`)  | `{ "colorBy": { "type": "tag", "tag": "HP" } }`                                               | built-in, reads the tag and picks colors         |
| SNPs vs indels (`VariantTrack`)   | `{ "color": "jexl:feature.type=='SNV'?'green':'purple'" }`                                    | branch on `feature.type` or any VCF `INFO` field |

`randomColor`, `alpha`, `hsl`, `colorString`, and `interpolate` are the built-in
[color helpers](/docs/config_guides/jexl).

A BED or bigBed that carries its own colors needs no callback. Leave `color`
unset and each feature is painted from its color column, whatever that column
ends up being called (`itemRgb` on a BED12, `reserved` on a bigBed, `field8` on
a BED9). Write a callback only when you want to override those.
[](/docs/config_guides/customizing_feature_colors) covers BED column naming and
moving an outgrown callback into a plugin.

The lookup table can key on any field the track exposes — UCSC RepeatMasker, for
instance, carries a `repClass` column. The `legend` slot names what each color
stands for, beside the expression that paints it, and the display draws it as a
dismissable key over the track (and into an SVG export).

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rmsk_hg38",
  "name": "RepeatMasker",
  "assemblyNames": ["hg38"],
  "adapter": { "type": "BedTabixAdapter", "uri": "rmsk.bed.gz" },
  "displayDefaults": {
    "color": "jexl:{SINE:'#e41a1c',LINE:'#377eb8',LTR:'#4daf4a',DNA:'#984ea3',Simple_repeat:'#ff7f00',Low_complexity:'#a65628'}[feature.repClass] || 'gray'",
    "legend": [
      { "label": "SINE", "color": "#e41a1c" },
      { "label": "LINE", "color": "#377eb8" },
      { "label": "LTR", "color": "#4daf4a" },
      { "label": "DNA", "color": "#984ea3" },
      { "label": "Simple repeat", "color": "#ff7f00" },
      { "label": "Low complexity", "color": "#a65628" },
      { "label": "other", "color": "gray" }
    ]
  }
}
```

<Figure caption="UCSC RepeatMasker over a 17q21 window with the lookup table above: every repeat takes the color of its repClass, and classes not in the table fall through to gray. The key over the track is the legend slot, spelling out what each color stands for." src="/img/cookbook_color_by_type.png"/>

A pipeline can rename a type between releases, so read the types out of the file
itself before writing the table:

```bash
awk -F'\t' '/^##FASTA/{exit} !/^#/{print $3}' annotations.gff |
  sort | uniq -c | sort -rn
```

The `/^##FASTA/{exit}` matters: a GFF3 may carry its sequence inline after that
marker, and those lines have no `#` to skip, so a plain `grep -v '^#' | cut -f3`
counts DNA as feature types and buries the real ones under thousands of rows.

Any type missing from the table falls through to `|| 'gray'`, so gray is the
signal to go back and check that list.
[Reading the type list off the file](/docs/config_guides/customizing_feature_colors#reading-the-type-list-off-the-file)
works one of these through end to end.

### One row per category

[`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
takes the same attribute the lookup table keys on, and the display assigns each
feature to the row named by that value, one lane per category, which shows how
much of the window each class takes and whether it clusters.
[`sampleColorMap`](/docs/config/linearmultirowfeaturedisplay/#slot-samplecolormap)
is the row-keyed form of the same table, so the colors carry over without the
jexl.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rmsk_hg38_rows",
  "name": "RepeatMasker by class",
  "assemblyNames": ["hg38"],
  "adapter": { "type": "BedTabixAdapter", "uri": "rmsk.bed.gz" },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "rmsk_hg38_rows-LinearMultiRowFeatureDisplay",
      "partitionField": "repClass",
      "sampleColorMap": {
        "SINE": "#e41a1c",
        "LINE": "#377eb8",
        "LTR": "#4daf4a",
        "DNA": "#984ea3",
        "Simple_repeat": "#ff7f00",
        "Low_complexity": "#a65628"
      },
      "showRowSeparators": true
    }
  ]
}
```

<Figure caption="The same RepeatMasker track and window as above, now partitioned on repClass. SINE fills the window, LINE comes in clusters, and each sparse class gets a lane of its own. The LTR? and Unknown lanes are values in the file that the lookup table does not name, the same list the awk above prints." src="/img/cookbook_color_by_type_rows.png"/>

## Labels, tooltips & details {#labels-tooltips-details}

Labels go in `displayDefaults` the same way `color` does.
[`showLabels`](/docs/config/linearcanvasbasedisplay/#slot-showlabels) chooses
which text is drawn: `auto` drops descriptions and then names as the view gets
denser, while `nameAndDescription`, `name`, `description`, and `none` pin one
choice at every zoom.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_labeled",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.name || feature.id",
      "description": "jexl:feature.note || feature.description || ''"
    },
    "showLabels": "nameAndDescription"
  }
}
```

`mouseover` returns the hover text. It is rendered as HTML, so `<b>`, `<br/>`,
and links all work:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_mouseover",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`"
  }
}
```

### Customizing the feature details panel

`formatDetails` sits at the top level of the track, not in `displayDefaults`.
Its `feature` callback returns an object that gets merged into what's shown.
Name an existing field to rewrite it, add a new one for an extra row, or set a
field to `undefined` to hide it. A value that is just a URL is turned into a
link, so linking out needs no `<a>` markup:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_linked_details",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "formatDetails": {
    "feature": "jexl:{NCBI:'https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name, type:undefined}"
  }
}
```

Fields that are the same on every feature need no callback at all. The slot
holds any JSON, and only a string starting with `jexl:` is evaluated:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_static_details",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "formatDetails": {
    "feature": { "Source": "GENCODE v44", "phase": null }
  }
}
```

`subfeatures` reshapes the nested rows. `depth` bounds how far down it runs and
`maxDepth` bounds how many levels of subfeature card the panel draws at all, so
this track relabels the transcripts of a gene and hides their exon and CDS
cards:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_transcript_details",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "formatDetails": {
    "subfeatures": "jexl:{Transcript:feature.name, phase:undefined}",
    "depth": 1,
    "maxDepth": 1
  }
}
```

The same four slots exist session-wide under `configuration.formatDetails` and
apply to every track. `feature` and `subfeatures` merge with the track's object
on top, so a track can rewrite one key the global callback added; `depth` and
`maxDepth` are overridden outright by a track that sets its own.

```json
{
  "configuration": {
    "formatDetails": {
      "feature": "jexl:{Assembly:'volvox', score:undefined}",
      "maxDepth": 2
    }
  }
}
```

`formatAbout` is the same mechanism for the About track dialog, which shows the
track's config rather than a feature, so its callback variable is `config`.
`hideUris` drops the file locations from the dialog:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_about",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "formatAbout": {
    "hideUris": true,
    "config": "jexl:{Source:'GENCODE v44', Contact:'helpdesk@example.org'}"
  }
}
```

See
[customizing feature details](/docs/config_guides/customizing_feature_details).

## Feature tracks

Genes from GFF3, BED, or bigBed are all the same track type. Only the adapter
changes:

| `uri`                 | Adapter            |
| --------------------- | ------------------ |
| `volvox.sort.gff3.gz` | `Gff3TabixAdapter` |
| `volvox-bed12.bed.gz` | `BedTabixAdapter`  |
| `volvox.bb`           | `BigBedAdapter`    |

For a small, unindexed file, use the plaintext adapter (`Gff3Adapter`,
`BedAdapter`, `VcfAdapter`), which reads the whole file into memory.
[](/docs/config_guides/file_types) has the full extension-to-adapter table.

### Track height

`height` sets the box the track lives in.
[`heightMode`](/docs/config/linearcanvasbasedisplay/#slot-heightmode) decides
what happens when more features arrive than fit in that box:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_fit",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "height": 200, "heightMode": "fit" }
}
```

- `fixed` keeps the height you set and scrolls the overflow
- `grow` expands the track downward until every feature shows, no scrollbar
- `fit` shrinks the features so the whole stack fits the current height

Use `fit` to get a full pileup or a dense annotation into a screenshot without a
scrollbar cutting it off. All three are on the "Track sizing" menu of any track.

### Pack features onto fewer rows

[`displayMode`](/docs/config/linearcanvasbasedisplay/#slot-displaymode) sets the
vertical room each feature gets, independent of height. `collapsed` puts
everything on one row and turns labels off, which suits a repeat or mappability
stripe:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "repeats_collapsed",
  "name": "Repeats",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BedTabixAdapter", "uri": "volvox-bed12.bed.gz" },
  "displayDefaults": { "displayMode": "collapsed" }
}
```

`normal`, `compact`, and `superCompact` are the other values.

### Draw features as arcs

Arcs suit interactions, breakpoints, and paired features. The arc display isn't
a `FeatureTrack`'s default, so you select it with a `displays` array:

```json
{
  "type": "FeatureTrack",
  "trackId": "interactions_arcs",
  "name": "Interactions",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BedpeAdapter", "uri": "volvox.bedpe" },
  "displays": [
    {
      "type": "LinearArcDisplay",
      "displayId": "interactions_arcs-LinearArcDisplay",
      "arcHeight": "jexl:log10(feature.end-feature.start)*20"
    }
  ]
}
```

`color`, `arcHeight`, `thickness`, and `label` all accept `jexl:`, so arc height
can encode span or score. See
[`LinearArcDisplay`](/docs/config/lineararcdisplay).

### Showing only some features (filtering)

`jexlFilters` draws only the features that pass every expression in the list.
Every entry is an expression already, so the `jexl:` prefix is optional here:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_filtered",
  "name": "Long genes only",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "jexlFilters": [
      "feature.end - feature.start > 1000",
      "feature.type == 'gene'"
    ]
  }
}
```

The same slot works on variant and alignments tracks.

## Tracks computed from the reference {#reference-scan}

Three adapters take no data file at all: they scan the assembly's own sequence
and emit the hits as features. The adapter is handed the sequence of whatever
assembly the track is displayed against, so the same track config works on any
assembly.

The [sequence search guide](/docs/user_guides/sequence_search) drives all three
from the view's menu, which is the right tool for a one-off question. Write them
into config.json when the track should be there for everyone.

### Restriction enzyme sites

`MotifListAdapter` takes a REBASE-style list, one motif per line: an optional
name, the site, and an optional cut marker. `^` marks a cut inside the site;
`(n/m)` is for the type IIS enzymes that cut downstream of theirs.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "restriction_enzymes",
  "name": "Restriction enzymes",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "MotifListAdapter",
    "motifs": "EcoRI\tG^AATTC\nBamHI\tG^GATCC\nBsaI\tGGTCTC(1/5)"
  }
}
```

Sites may use IUPAC ambiguity codes, blank lines and `#` comments are ignored,
and a palindromic site is reported once rather than twice. Because the list is
just text, the same adapter serves primers, adapters, or any named motif set.

### CRISPR guide RNAs

`CrisprGuideAdapter` scans for PAM sites and emits each candidate protospacer,
annotated with its GC% and a poly-T flag. The defaults are SpCas9:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "crispr_guides",
  "name": "CRISPR guides SpCas9 (NGG)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CrisprGuideAdapter",
    "pam": "NGG",
    "guideLength": 20,
    "pamLocation": "3prime",
    "cutOffset": 3,
    "minGcPercent": 40,
    "maxGcPercent": 60,
    "excludePolyT": true
  }
}
```

A PAM occurs roughly every 8bp, so an unfiltered scan is far denser than a
display can draw. The adapter keeps everything by default, which is why the GC
window and `excludePolyT` (which drops guides containing `TTTT`, a terminator
for the pol III promoters guides are usually expressed from) are set above.

Other enzymes are the same track with different numbers:

- **SaCas9** is `NNGRRT` with `guideLength` 21
- **Cas12a** is `"pam": "TTTV"`, `"pamLocation": "5prime"`, `"guideLength": 23`,
  `"cutOffset": 18`, `"cutOffsetBottom": 23`

Cas12a needs that last slot because it is a staggered cutter: the two strands
are cut at different offsets, leaving an overhang. For a blunt cutter the two
are equal.

### A regex motif across the reference

`SequenceSearchAdapter` takes a single regex, so `TATA[AT]A[AT]` finds either
TATA-box variant:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "tata_boxes",
  "name": "TATA boxes",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "SequenceSearchAdapter",
    "search": "TATA[AT]A[AT]",
    "caseInsensitive": true
  }
}
```

`searchForward` and `searchReverse` are on by default on all three adapters; set
either to `false` to scan one strand. Regex syntax has no reverse complement and
no IUPAC codes (`N` matches a literal N), so an ambiguous site belongs in a
motif list rather than here.

## Alignments tracks

`colorBy`, `height`, `showSoftClipping`, and `groupBy` are display settings:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam",
  "name": "My alignments",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "height": 400,
    "colorBy": { "type": "mappingQuality" },
    "showSoftClipping": true,
    "groupBy": { "type": "tag", "tag": "HP" }
  }
}
```

- `colorBy` also takes `strand`, `pairOrientation`, `insertSize`, and
  `modifications` (methylation)
- `groupBy` also takes `strand`, `firstOfPairStrand`, `pairOrientation`,
  `supplementary`, and `mapq`

CRAM uses `CramAdapter` in place of `BamAdapter`.

### Filter reads by SAM flag or tag

- `flagExclude` hides reads with any of its bits set. The 1540 below hides
  unmapped, vendor-failed, and duplicate reads; 3844 also hides secondary and
  supplementary
- `flagInclude` keeps only reads with all of its bits set
- `tagFilters` restricts by tag value

A read has to pass every filter to be drawn:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam_filtered",
  "name": "Haplotype 1 reads",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "filterBy": {
      "flagExclude": 1540,
      "flagInclude": 0,
      "tagFilters": [{ "tag": "HP", "value": "1" }]
    }
  }
}
```

[Broad's flag explainer](https://broadinstitute.github.io/picard/explain-flags.html)
adds up a number for you. `fetchSizeLimit` on the adapter caps how much data is
fetched. See [alignments tracks](/docs/config_guides/alignments_track).

## Quantitative (wiggle) tracks

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "coverage",
  "name": "Coverage",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
  "displayDefaults": { "color": "#C8B414", "scaleType": "log", "minScore": 0 }
}
```

Setting `color` puts the track in single-color mode. Left alone, a wiggle is
bicolor: scores above `bicolorPivot` draw upward in `posColor`, and scores below
it draw downward in `negColor`. Set `color` or `posColor`/`negColor`, never
both. A wiggle colors per signal, so the per-feature callbacks above don't apply
here.

[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks the plot: `xyplot`, `line`, `scatter` (good for BAF or CN points), or
`density`. Its page lists every value, and
[`LinearWiggleDisplay`](/docs/config/linearwiggledisplay) covers the scale
slots.

### Multiple signals on one track, each its own color

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "multiwig",
  "name": "Grains",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "Grain1",
        "uri": "v1.bw",
        "color": "#f00"
      },
      {
        "type": "BigWigAdapter",
        "name": "Grain2",
        "uri": "v2.bw",
        "color": "#f60"
      }
    ]
  },
  "displayDefaults": { "defaultRendering": "multiline" }
}
```

[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
takes a `multirow*` name to stack one row per signal or a `multi*` name to
overlay them in one plot; its page lists all nine.

```bash
jbrowse add-track --multiwig v1.bw,v2.bw --load copy --name Grains
```

`--multiwig` also takes a `.json` sources file holding the `name`/`color` rows
above. `subadapters` is just a list, so once you have more than a handful of
samples, generate it from your samplesheet. Beyond a few hundred, one file per
sample stops being the right shape at all, and
[population copy number](/docs/tutorials/population_cnv#scaling-past-one-population)
serves the same display from a single Zarr store instead.

If the quantity has an absolute meaning, set `minScore`/`maxScore` on the
display. Autoscale runs per row, so a sample whose signal never leaves the
baseline is drawn at the same full height as one with a real amplification, and
the rows stop being comparable.

<Figure caption="An eight-sample MultiQuantitativeTrack across 1.5 Mb of chr1 (multirowline), each 1000 Genomes individual its own color on a shared 0 to 5 copy-number scale. Every row sits at two copies through the flanks; only the amylase cluster in the middle separates them, from one copy to four." src="/img/cookbook_multiwig.png"/>

## Variant tracks

`color` and `jexlFilters` work just as they do on a feature track. VCF `INFO`
fields are the usual thing to branch on, and they parse as arrays, so index
them:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "svs_by_type",
  "name": "SVs by type",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "VcfTabixAdapter", "uri": "volvox.dup.vcf.gz" },
  "displayDefaults": {
    "color": "jexl:{DEL:'red',INS:'blue',DUP:'green',INV:'orange'}[feature.INFO.SVTYPE[0]] || 'gray'",
    "jexlFilters": ["feature.INFO.AF[0] > 0.05"]
  }
}
```

Multi-sample VCFs open in the standard variant display. For genotypes as a grid,
switch from the track menu or name the display in the config:

```json
{
  "type": "VariantTrack",
  "trackId": "cohort_matrix",
  "name": "Cohort genotypes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "VcfTabixAdapter", "uri": "volvox.dup.vcf.gz" },
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "displayId": "cohort_matrix-LinearMultiSampleVariantMatrixDisplay"
    }
  ]
}
```

See [variant tracks](/docs/config_guides/variant_track).

## Synteny and dotplot tracks

A `SyntenyTrack` lines up two assemblies and feeds both the dotplot and
linear-synteny views. Pick the adapter matching your aligner:

- `PAFAdapter` for minimap2 and wfmash
- `DeltaAdapter` for MUMmer
- `ChainAdapter` for liftOver and lastz

Getting the two assemblies backwards is the most common mistake here. minimap2
takes its inputs target first (`minimap2 grape.fa peach.fa` makes grape the
target), so name them explicitly:

```json
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_synteny",
  "name": "Grape vs Peach",
  "assemblyNames": ["peach", "grape"],
  "adapter": {
    "type": "PAFAdapter",
    "uri": "out.paf",
    "queryAssembly": "peach",
    "targetAssembly": "grape"
  }
}
```

The query draws on the dotplot's horizontal axis, and on the top row in linear
synteny. The target draws on the vertical axis and the bottom row. Both
assemblies must already exist in `assemblies`. If the track loads blank, it is
almost always because the two are swapped: flip `queryAssembly` and
`targetAssembly`. See the
[synteny track guide](/docs/config_guides/synteny_track) and the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

### Large alignments {#synteny-large-alignments}

Every synteny adapter reads the whole file into memory, except the two indexed
(PIF) ones, which do a tabix range lookup instead. Index a big PAF once and
reuse it:

```bash
jbrowse make-pif alignments.paf   # -> alignments.pif.gz (+ .tbi)
```

```json
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_synteny_pif",
  "name": "Grape vs Peach (indexed)",
  "assemblyNames": ["peach", "grape"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "alignments.pif.gz",
    "queryAssembly": "peach",
    "targetAssembly": "grape"
  }
}
```

`AllVsAllIndexedPAFAdapter` is the same thing for an all-vs-all PAF, taking
`assemblyNames` in place of query/target ([below](#synteny-stacking)).

### Gene-level synteny from ortholog tables {#synteny-mcscan}

`MCScanAnchorsAdapter` links orthologous genes rather than sequence alignments,
and needs the MCScan workflow's per-assembly BED files. MCScan adapters take
only `assemblyNames`, with the query first:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors",
  "name": "Grape vs Peach (MCScan anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanAnchorsAdapter",
    "uri": "grape.peach.anchors.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
```

See the
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao),
which also covers `MCScanBlocksAdapter` for a `.blocks` table.

### Stacking more than two genomes {#synteny-stacking}

A single all-vs-all PAF backs every band, so you only need one track. Its
sequence names must be PanSN-prefixed (`sample#haplotype#contig`), and
`assemblyNames` lists every assembly the file covers:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli all-vs-all",
  "assemblyNames": ["K12", "Sakai", "CFT073"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "uri": "all_vs_all.paf",
    "assemblyNames": ["K12", "Sakai", "CFT073"]
  }
}
```

A `LinearSyntenyView` then takes one assembly row per genome and one track entry
per band, so three rows means two bands:

```json
"defaultSession": {
  "views": [
    {
      "type": "LinearSyntenyView",
      "init": {
        "views": [{ "assembly": "K12" }, { "assembly": "Sakai" }, { "assembly": "CFT073" }],
        "tracks": [["ecoli_ava"], ["ecoli_ava"]],
        "minAlignmentLength": 10000
      }
    }
  ]
}
```

`minAlignmentLength` hides the short alignments that would otherwise bury the
shared backbone. For full walkthroughs, see
[all-vs-all synteny](/docs/tutorials/allvsall_synteny) from one PAF and
[ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao) from a
jcvi `.blocks` file.

### Related views {#synteny-related}

- [](/docs/user_guides/dotplot_view) and
  [linear synteny view](/docs/user_guides/linear_synteny_view) for what each
  view does with the track
- [](/docs/tutorials/genomes_synteny) to launch a synteny view from a liftOver
  track in a linear genome view
- [Pangenome graphs](/docs/tutorials/pangenome_ecoli) for graph-derived
  alignments

## Instance-wide settings

**Track folders** and **metadata** are both set on the track itself. A nested
`category` array makes nested folders in the
[hierarchical track selector](/docs/config_guides/track_selector), and
`metadata` shows up in the track details:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "brain_rnaseq",
  "name": "Brain RNA-seq",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "category": ["RNA-seq", "Brain"],
  "metadata": {
    "description": "150bp paired-end reads",
    "source": "See <a href='https://example.com'>the paper</a>"
  }
}
```

**Text searching.** `jbrowse text-index` builds the index and writes the
matching `aggregateTextSearchAdapters` entry into your config. After that, the
search box jumps to genes by name. See
[text searching](/docs/config_guides/text_searching) to hand-write or relocate
one.

**Theming.** `primary` and `secondary` drive the toolbars and highlights, while
`tertiary` and `quaternary` drive the accents. See
[coloring/theming](/docs/config_guides/theme) for logos, fonts, and dark mode:

```json
"configuration": {
  "theme": {
    "palette": {
      "primary": { "main": "#311b92" },
      "secondary": { "main": "#0097a7" }
    }
  }
}
```

**Plugins.** Use `esmLoc` for a file sitting next to your config, or `esmUrl`
for one hosted elsewhere. See [plugins](/docs/config_guides/plugins):

```json
"plugins": [{ "name": "MyPlugin", "esmLoc": { "uri": "myplugin.js" } }]
```

**Opening to a specific view** is what the `defaultSession` in
[the config above](#a-complete-config) does. See
[default session](/docs/config_guides/default_session).

## From config to a URL

A URL can name things `config.json` already defines:

```
https://host/jbrowse2/?config=config.json&assembly=volvox&loc=ctgA:1-50000&tracks=genes,coverage
```

- `config` is which config file to load
- `assembly` is the `name` of an entry in `assemblies` (not a track, a common
  mix-up)
- `loc` is a region, or a gene name if you've run `jbrowse text-index`
- `tracks` is a comma-separated list of `trackId`s to turn on

A link like this starts a fresh view and ignores any `defaultSession`. Add
`&extendSession=true` to keep the existing session and change only the location.

To set how a track _looks_, give it a `displaySnapshot`, which takes the same
settings as `displayDefaults`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-50000","tracks":[{"trackId":"genes","displaySnapshot":{"color":"green"}}]}]}
```

`&sessionTracks=` adds a track the config has never heard of, using the same
objects as its `tracks` array. A `FromConfigAdapter` carries its features
inline, so a region of interest can travel in the link itself:

```
&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"1","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

See [](/docs/urlparams) for the full list, multi-view layouts, and the encoded
links the "Share" button produces. [](/docs/config_guides/from_config) covers
inline features in a config.

## Where to go next

- [](/docs/config_and_session_json) - what this document is, and every surface
  that opens one
- [](/docs/config_guide) - structure of `config.json` and links to every
  per-track guide
- [](/docs/config_guides/jexl) - full catalog of callback functions
- [](/docs/config_guides/file_types) - every format and its adapter
- [Config reference](/docs/config) - the complete, auto-generated slot list for
  every track, display, and adapter
- [](/docs/automating) - the shared `init` launch model across config, URL, and
  embedded components
