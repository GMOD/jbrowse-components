---
title: Cookbook
sidebar_label: Cookbook (config recipes)
description:
  'Copy-paste recipes for the most common JBrowse 2 configuration tasks: colors,
  labels, tooltips, tracks, themes, and more'
---

Short, copy-paste recipes for the settings people reach for most. Each one is a
whole track config, so it lands the same way in `config.json`, through the CLI,
or pasted into a running JBrowse. Most run against the `volvox` sample data
JBrowse ships
([`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox));
the synteny recipes and every figure use real datasets. For the full reference,
see the [config guide](/docs/config_guide).

## The smallest config

A `config.json` needs two things: an assembly to supply the reference sequence,
and a track to draw on it.

```json
{
  "assemblies": [{ "name": "volvox", "uri": "volvox.2bit" }],
  "tracks": [{ "trackId": "genes", "uri": "volvox.sort.gff3.gz" }]
}
```

That is a complete, working file. JBrowse reads the adapter and the track type
off the file's extension, finds the index sibling (`.bam.bai`, `.tbi`, `.fai`),
takes `name` from the file name, and puts the track on the one assembly the
config declares.
[The shortest track](/docs/config_guides/tracks#the-shortest-track) covers
overriding each of those. The same track written out, which is where every
recipe below starts:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" }
}
```

Two conventions carry the rest of the page:

- **`displayDefaults`** routes each setting to the display that defines it, so
  you never name a display or write a `displays` array. A key no display defines
  warns in the console. Write `displays` only to pick a non-default display type
  (like the [arc display](#feature-tracks)).
- **A `jexl:` prefix** turns any slot into a per-feature callback. See
  [using jexl callbacks](/docs/config_guides/jexl).

The app writes these objects back out too: **About → Copy config** on a track,
or **File → Export session** for the whole view.

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
        "color": "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'",
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
        "loc": "ctgA:1-50000",
        "assembly": "volvox",
        "tracks": ["genes", "reads", "coverage", "variants"]
      }
    ]
  },
  "configuration": {
    "theme": { "palette": { "primary": { "main": "#311b92" } } }
  }
}
```

### Jump to a recipe

| To change                           | Setting                                  | Section                                           |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| Feature color                       | `color`, `colorBy`                       | [colors](#colors)                                 |
| Labels, tooltips, click details     | `labels`, `mouseover`, `formatDetails`   | [labels & tooltips](#labels-tooltips-details)     |
| Track height, arcs, filtering       | `heightMode`, `displays`, `jexlFilters`  | [feature tracks](#feature-tracks)                 |
| A track with no data file           | `MotifListAdapter`, `CrisprGuideAdapter` | [computed from the reference](#reference-scan)    |
| Read coloring, grouping, SAM flags  | `colorBy`, `groupBy`, `filterBy`         | [alignments tracks](#alignments-tracks)           |
| Plot style, scale, multiple signals | `defaultRendering`, `subadapters`        | [wiggle tracks](#quantitative-wiggle-tracks)      |
| Variants by type, genotype matrix   | `color`, `displays`                      | [variant tracks](#variant-tracks)                 |
| Assembly-to-assembly alignment      | `queryAssembly`, `targetAssembly`        | [synteny](#synteny-and-dotplot-tracks)            |
| Folders, aliases, theme, plugins    | `category`, `refNameAliases`, `theme`    | [instance-wide settings](#instance-wide-settings) |
| Opening view                        | `defaultSession`, URL params             | [config to a URL](#from-config-to-a-url)          |

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
direction if you pick your own colors.

<Figure caption="NCBI RefSeq genes on hg38 with this recipe applied: forward-strand genes red, reverse-strand blue." src="/img/cookbook_color_by_strand.png"/>

The expression sees the feature as `feature`, and every attribute is a plain
property on it: `feature.type`, `feature.strand` (`1`/`-1`/`0`),
`feature.score`, `feature.name`, `feature.start`/`end`, and `feature.parent`.
VCF `INFO` fields parse as arrays, so index them (`feature.INFO.SVTYPE[0]`). On
a gene track the expression resolves once per exon, CDS and UTR, so a
transcript's own attribute is `feature.parent.myattr`. A `color` that comes out
undefined paints magenta, so end the ternary on a real color, and wrap a
callback in `log(...)` to print what it returns to the browser console.

Drop any of these into the same `displayDefaults`:

| Recipe                            | `displayDefaults`                                                                             | Notes                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Solid color                       | `{ "color": "#6a3d9a" }`                                                                      | any CSS color: hex, `rgb()`/`hsl()`, or a name   |
| By feature type (lookup table)    | `{ "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] \|\| 'gray'" }` | `\|\| 'gray'` catches anything not listed        |
| By a numeric threshold            | `{ "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }`                                 | a hard cutoff, not a gradient                    |
| Continuous gradient from a number | ``{ "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }``                                     | maps `feature.score` onto an HSL hue             |
| Auto color per category           | `{ "color": "jexl:randomColor(feature.type)" }`                                               | same string always gets the same color           |
| BED file's own colors             | leave `color` unset                                                                           | painted from the file's color column             |
| BAM/CRAM tag (`AlignmentsTrack`)  | `{ "colorBy": { "type": "tag", "tag": "HP" } }`                                               | built-in, reads the tag and picks colors         |
| SNPs vs indels (`VariantTrack`)   | `{ "color": "jexl:feature.type=='SNV'?'green':'purple'" }`                                    | branch on `feature.type` or any VCF `INFO` field |

`randomColor`, `alpha`, `hsl`, `colorString`, and `interpolate` are the built-in
[color helpers](/docs/config_guides/jexl).
[](/docs/config_guides/customizing_feature_colors) covers BED column naming and
moving an outgrown callback into a plugin.

### Color by category, with a legend

The lookup table can key on any field the track exposes. UCSC RepeatMasker
carries a `repClass` column, and the `legend` slot names what each color stands
for beside the expression that paints it. The display draws it as a dismissable
key over the track and into an SVG export.

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
itself before writing the table. The `/^##FASTA/{exit}` stops before any inline
sequence, which a plain `grep -v '^#'` would count as feature types:

```bash
awk -F'\t' '/^##FASTA/{exit} !/^#/{print $3}' annotations.gff |
  sort | uniq -c | sort -rn
```

Any type missing from the table falls through to `|| 'gray'`, so gray is the
signal to go back and check that list.

### One row per category

[`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
takes the same attribute the lookup table keys on, and the display gives each
value a lane of its own, which shows how much of the window each class takes and
whether it clusters.
[`sampleColorMap`](/docs/config/linearmultirowfeaturedisplay/#slot-samplecolormap)
is the row-keyed form of the same table.

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

Labels and hover text go in `displayDefaults` the same way `color` does.
[`showLabels`](/docs/config/linearcanvasbasedisplay/#slot-showlabels) chooses
which text is drawn: `auto` drops descriptions and then names as the view gets
denser, while `nameAndDescription`, `name`, `description`, and `none` pin one
choice at every zoom. `mouseover` is rendered as HTML, so `<b>`, `<br/>`, and
links all work.

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
    "showLabels": "nameAndDescription",
    "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`"
  }
}
```

The click-details panel is `formatDetails`, at the top level of the track. Its
`feature` callback returns an object that merges into what is shown: name an
existing field to rewrite it, add a new one for an extra row, or set a field to
`undefined` to hide it. A value that is just a URL becomes a link.

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

[Customizing feature details](/docs/config_guides/customizing_feature_details)
covers the rest of the same slot: a plain object for fields that are the same on
every feature, `subfeatures` with `depth` and `maxDepth` for the nested rows,
the session-wide form under `configuration.formatDetails`, and `formatAbout` for
the About track dialog.

## Feature tracks

Genes from GFF3, BED, or bigBed are all the same `FeatureTrack`, and the adapter
follows the extension ([](/docs/config_guides/file_types)). `height` sets the
box the track lives in, and
[`heightMode`](/docs/config/linearcanvasbasedisplay/#slot-heightmode) decides
what happens when more features arrive than fit: `fixed` scrolls the overflow,
`grow` expands the track, and `fit` shrinks the features so the whole stack
fits, which is what gets a full pileup into a screenshot without a scrollbar.

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

[`displayMode`](/docs/config/linearcanvasbasedisplay/#slot-displaymode) sets the
vertical room each feature gets instead: `compact` and `superCompact` pack the
rows, and `collapsed` puts everything on one row with no labels, which suits a
density stripe and little else.

`jexlFilters` draws only the features that pass every expression in the list.
Every entry is an expression already, so the `jexl:` prefix is optional here.
The same slot works on variant and alignments tracks.

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

Arcs suit interactions, breakpoints, and paired features. The arc display is not
a `FeatureTrack`'s default, so you select it with a `displays` array. `color`,
`arcHeight`, `thickness`, and `label` all accept `jexl:`, so arc height can
encode span or score. See [`LinearArcDisplay`](/docs/config/lineararcdisplay).

```json addtrack
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

## Tracks computed from the reference {#reference-scan}

Three adapters take no data file at all: they scan the sequence of whatever
assembly the track is displayed against and emit the hits as features, so the
same track config works on any assembly. The
[sequence search guide](/docs/user_guides/sequence_search) drives all three from
the view's menu for a one-off question; a configured track puts them there for
everyone. `searchForward` and `searchReverse` are on by default on all three;
set either to `false` to scan one strand.

`MotifListAdapter` takes a REBASE-style list, one motif per line: an optional
name, the site, and an optional cut marker. `^` marks a cut inside the site;
`(n/m)` is for the type IIS enzymes that cut downstream. Sites may use IUPAC
ambiguity codes, and because the list is just text, the same adapter serves
primers or any named motif set.

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

`CrisprGuideAdapter` scans for PAM sites and emits each candidate protospacer,
annotated with its GC% and a poly-T flag. A PAM occurs roughly every 8bp, so the
GC window and `excludePolyT` below keep the track drawable. The defaults are
SpCas9; SaCas9 is `NNGRRT` with `guideLength` 21, and Cas12a is `"pam": "TTTV"`,
`"pamLocation": "5prime"`, `"guideLength": 23`, `"cutOffset": 18`,
`"cutOffsetBottom": 23`, the last because it cuts the two strands at different
offsets.

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

`SequenceSearchAdapter` takes a single regex. Regex syntax has no reverse
complement and no IUPAC codes (`N` matches a literal N), so an ambiguous site
belongs in a motif list rather than here.

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

## Alignments tracks

`colorBy`, `groupBy`, `showSoftClipping`, and `filterBy` are all display
settings, and CRAM uses `CramAdapter` in place of `BamAdapter`:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam",
  "name": "Haplotype 1 reads",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "height": 400,
    "colorBy": { "type": "mappingQuality" },
    "showSoftClipping": true,
    "groupBy": { "type": "tag", "tag": "HP" },
    "filterBy": {
      "flagExclude": 1540,
      "flagInclude": 0,
      "tagFilters": [{ "tag": "HP", "value": "1" }]
    }
  }
}
```

- `colorBy` also takes `strand`, `pairOrientation`, `insertSize`, `tag`, and
  `modifications` (methylation)
- `groupBy` also takes `strand`, `firstOfPairStrand`, `pairOrientation`,
  `supplementary`, and `mapq`
- `flagExclude` hides reads with any of its bits set: 1540 hides unmapped,
  vendor-failed, and duplicate reads, and 3844 also hides secondary and
  supplementary. `flagInclude` keeps only reads with all of its bits set, and
  `tagFilters` restricts by tag value. A read has to pass every filter to be
  drawn.
  [Broad's flag explainer](https://broadinstitute.github.io/picard/explain-flags.html)
  adds up a number for you.

See [alignments tracks](/docs/config_guides/alignments_track).

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
both.
[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks the plot: `xyplot`, `line`, `scatter`, or `density`.
[`LinearWiggleDisplay`](/docs/config/linearwiggledisplay) covers the scale
slots.

### Multiple signals on one track, each its own color

```json addtrack
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
overlay them in one plot. If the quantity has an absolute meaning, set
`minScore`/`maxScore` on the display: autoscale runs per row, so a sample whose
signal never leaves the baseline draws at the same full height as one with a
real amplification. `subadapters` is just a list, so past a handful of samples
generate it from your samplesheet
([multi-quantitative tracks](/docs/config_guides/multiquantitative_track)), and
past a few hundred,
[population copy number](/docs/tutorials/population_cnv#scaling-past-one-population)
serves the same display from a single Zarr store.

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

A multi-sample VCF opens in the standard variant display. For genotypes as a
grid, switch from the track menu or name `LinearMultiSampleVariantMatrixDisplay`
in a `displays` array;
[variant tracks](/docs/config_guides/variant_track#multivariant-display-configuration)
has the config with the slots people preset on it.

## Synteny and dotplot tracks

A `SyntenyTrack` lines up two assemblies and feeds both the dotplot and
linear-synteny views. `PAFAdapter` reads minimap2 and wfmash output,
`DeltaAdapter` MUMmer, and `ChainAdapter` liftOver and lastz. Getting the two
assemblies backwards is the most common mistake here. minimap2 takes its inputs
target first (`minimap2 grape.fa peach.fa` makes grape the target), so name them
explicitly:

```json addtrack
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

The query draws on the dotplot's horizontal axis and the top row in linear
synteny; the target draws on the vertical axis and the bottom row. Both
assemblies must already exist in `assemblies`. If the track loads blank, flip
`queryAssembly` and `targetAssembly`.

### Large alignments {#synteny-large-alignments}

Every synteny adapter reads the whole file into memory, except the indexed (PIF)
ones, which do a tabix range lookup instead. Index a big PAF once, then use the
same track with `"type": "PairwiseIndexedPAFAdapter"` and the `.pif.gz` as its
`uri`:

```bash
jbrowse make-pif alignments.paf   # -> alignments.pif.gz (+ .tbi)
```

- [Synteny track guide](/docs/config_guides/synteny_track) for every adapter,
  including the MCScan ortholog-table ones
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny) to stack more than two
  genomes from one PanSN-named PAF
- [Ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao) for
  gene-level synteny from a jcvi `.anchors` or `.blocks` file
- [](/docs/user_guides/dotplot_view) and
  [linear synteny view](/docs/user_guides/linear_synteny_view) for what each
  view does with the track

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

**Refname aliases** line up tracks that name the same chromosome differently
(chr1 vs 1 vs NC_000001). Point the assembly at a two-column chromAliases file;
[assemblies](/docs/config_guides/assemblies) has the inline form.

```json addassembly
{
  "name": "volvox",
  "uri": "volvox.2bit",
  "refNameAliases": { "uri": "volvox.chromAliases.txt" }
}
```

**Text searching.** `jbrowse text-index` builds the index and writes the
matching `aggregateTextSearchAdapters` entry into your config. After that, the
search box jumps to genes by name. See
[text searching](/docs/config_guides/text_searching).

**Theming** is `configuration.theme`, as in
[the config above](#a-complete-config): `primary` and `secondary` drive the
toolbars and highlights, `tertiary` and `quaternary` the accents. See
[coloring/theming](/docs/config_guides/theme) for logos, fonts, and dark mode.

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
links the "Share" button produces.

## Where to go next

- [](/docs/config_and_session_json) - what this document is, and every surface
  that opens one
- [](/docs/config_guide) - structure of `config.json` and links to every
  per-track guide
- [](/docs/cli) - `add-track --displayDefaults '<json>'` applies any recipe
  above, and `--force` changes a track you already added
- [](/docs/config_guides/jexl) - full catalog of callback functions
- [](/docs/config_guides/file_types) - every format and its adapter
- [Config reference](/docs/config) - the complete, auto-generated slot list for
  every track, display, and adapter
