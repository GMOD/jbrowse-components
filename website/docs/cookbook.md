---
title: Cookbook
description:
  'Copy-paste recipes for the most common JBrowse 2 configuration tasks: colors,
  labels, tooltips, tracks, themes, and more'
---

Short, copy-paste recipes for the `config.json` settings people reach for most.
Examples use the `volvox` sample data
([`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox)).
For the full reference, see the [config guide](/docs/config_guide).

---

## A complete config {#tldr-a-complete-config-on-one-screen}

One assembly, one track of each common type, an opening view, and a theme, in
the shortest form JBrowse accepts. Every recipe below varies one of these
tracks. One assembly plus one track is already a valid config.

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

| To change                      | Setting                               | Section                                                                                           |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Data file and index            | `adapter`, `uri`                      | [shorthand](#how-config-shorthand-works), [assemblies](#assemblies)                               |
| Feature color                  | `color`, `colorBy`                    | [colors](#colors)                                                                                 |
| Feature labels and tooltips    | `labels`, `mouseover`                 | [labels & tooltips](#labels-tooltips-details)                                                     |
| Click-details panel            | `formatDetails`                       | [feature details](#customizing-the-feature-details-panel)                                         |
| Track height and packing       | `height`, `heightMode`, `displayMode` | [feature tracks](#feature-tracks)                                                                 |
| Feature and read filtering     | `jexlFilters`, `filterBy`             | [filtering](#showing-only-some-features-filtering), [SAM flags](#filter-reads-by-sam-flag-or-tag) |
| Read grouping and clipping     | `groupBy`, `showSoftClipping`         | [alignments tracks](#alignments-tracks)                                                           |
| Plot style and scale           | `defaultRendering`, `scaleType`       | [wiggle tracks](#quantitative-wiggle-tracks)                                                      |
| Multiple signals per track     | `subadapters`                         | [multi-signal wiggle](#multiple-signals-on-one-track-each-its-own-color)                          |
| Genotype matrix                | `displays`                            | [variant tracks](#variant-tracks)                                                                 |
| Assembly-to-assembly alignment | `queryAssembly`, `targetAssembly`     | [synteny](#synteny-and-dotplot-tracks), [stacking N genomes](#synteny-stacking)                   |
| Track folders and metadata     | `category`, `metadata`                | [instance-wide settings](#instance-wide-settings)                                                 |
| Theme, search, and plugins     | `theme`, `plugins`                    | [instance-wide settings](#instance-wide-settings)                                                 |
| Opening view                   | `defaultSession`, URL params          | [config to a URL](#from-config-to-a-url)                                                          |

---

## Config shorthand {#how-config-shorthand-works}

JBrowse expands these at load time, so you write only what matters:

- **`uri` on an adapter** fills in the location slot and the companion index
  (`.bam` → `.bam.bai`, `.cram` → `.cram.crai`, bgzip+tabix → `.tbi`). For a
  `.csi` or non-sibling index, write the
  [full form](/docs/config_guides/file_types#the-uri-shorthand).
- **`{ name, uri }` is a whole assembly**: adapter from the extension, index
  siblings, and the `ReferenceSequenceTrack`, see
  [`BaseAssembly`](/docs/config/baseassembly).
- **`displayDefaults`** routes each setting to the display that defines it, so
  you never name a display or write a `displays` array. A key nothing defines
  warns in the console. Write `displays` only to pick a non-default display type
  (like the [arc display](#draw-features-as-arcs-with-a-jexl-computed-height)).
- **A `jexl:` prefix** makes any slot a per-feature callback, see
  [using jexl callbacks](/docs/config_guides/jexl).

The same objects work in `config.json`, in a `session=spec-…` URL, and in an
embedded `createViewState`. The app writes them back out too: **About ▸ Copy
config** on a track, or **File ▸ Export session** for the whole view.

---

## Applying a recipe from the CLI

`config.json` is plain JSON, so hand-editing it or generating it from a script
is a first-class way to work: past a handful of similar tracks, emitting the
`tracks` array from your samplesheet usually beats one CLI call per file. The
CLI is a convenience, not a requirement.

Going the CLI route, the [web quickstart](/docs/quickstart_web) covers `create`,
`add-assembly`, and `add-track`, and four `add-track` flags reach every recipe
on this page:

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

---

## Assemblies {#assemblies}

Pick the adapter matching your sequence file:

```json
{ "type": "TwoBitAdapter", "uri": "genome.2bit" }
{ "type": "BgzipFastaAdapter", "uri": "genome.fa.gz" }
{ "type": "IndexedFastaAdapter", "uri": "genome.fa" }
```

`BgzipFastaAdapter` (`bgzip genome.fa` + `samtools faidx genome.fa.gz`) is
recommended for large genomes.

**Refname aliases** (chr1 vs 1 vs NC_000001) line up tracks that name
chromosomes differently. Point at a two-column chromAliases file:

```json
{
  "name": "volvox",
  "uri": "volvox.2bit",
  "refNameAliases": { "uri": "volvox.chromAliases.txt" }
}
```

See [assemblies](/docs/config_guides/assemblies) for the inline
`FromConfigAdapter` form.

---

## Colors {#colors}

A track's color is `color` in `displayDefaults`: a plain CSS color, or a `jexl:`
expression run per feature.

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_by_strand",
  "name": "Genes (colored by strand)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "jexl:feature.strand==1?'#1f77b4':'#d62728'" }
}
```

<Figure caption="NCBI RefSeq genes on hg38 with this recipe applied: + strand genes blue, - strand genes red." src="/img/cookbook_color_by_strand.png"/>

### What you can color by

The expression sees the feature as `feature`, any attribute a plain property:
`feature.type`, `feature.strand` (`1`/`-1`/`0`), `feature.score`,
`feature.name`, `feature.start`/`end`, `feature.refName`, `feature.parent`,
`feature.INFO.SVTYPE[0]` (VCF `INFO` fields parse as arrays, so index them), and
`getTag(feature, 'HP')` for BAM/CRAM tags. Full list in
[using jexl callbacks](/docs/config_guides/jexl).

### More ways to set `color`

Drop any of these into the same `displayDefaults`:

| Recipe                            | `displayDefaults`                                                                             | Notes                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Solid color                       | `{ "color": "#6a3d9a" }`                                                                      | any CSS color: hex, `rgb()`/`hsl()`, or a name   |
| By feature type (lookup table)    | `{ "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] \|\| 'gray'" }` | `\|\| 'gray'` catches anything not listed        |
| By a numeric threshold            | `{ "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }`                                 | a hard cutoff, not a gradient                    |
| Continuous gradient from a number | ``{ "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }``                                     | maps `feature.score` onto an HSL hue             |
| Auto color per category           | `{ "color": "jexl:randomColor(feature.type)" }`                                               | same string always gets the same color           |
| BED file's own colors (`itemRgb`) | `{ "color": "jexl:feature.itemRgb \|\| 'gray'" }`                                             | only guaranteed for BED12/bigBed                 |
| BAM/CRAM tag (`AlignmentsTrack`)  | `{ "colorBy": { "type": "tag", "tag": "HP" } }`                                               | built-in, reads the tag and picks colors         |
| SNPs vs indels (`VariantTrack`)   | `{ "color": "jexl:feature.type=='SNV'?'green':'purple'" }`                                    | branch on `feature.type` or any VCF `INFO` field |

`randomColor`, `alpha`, `hsl`, `colorString`, and `interpolate` are the built-in
[color helpers](/docs/config_guides/jexl).
[Customizing feature colors](/docs/config_guides/customizing_feature_colors)
covers BED column naming and moving an outgrown callback into a plugin.

The lookup table keys on any field the track exposes. UCSC RepeatMasker carries
a `repClass` column:

```json
{
  "color": "jexl:{SINE:'#e41a1c',LINE:'#377eb8',LTR:'#4daf4a',DNA:'#984ea3',Simple_repeat:'#ff7f00',Low_complexity:'#a65628'}[get(feature,'repClass')] || 'gray'"
}
```

<Figure caption="UCSC RepeatMasker over a 17q21 window with the lookup table above: every repeat takes the color of its repClass, and classes not in the table fall through to gray." src="/img/cookbook_color_by_type.png"/>

Wrap a callback in `log(...)` to print what it returns per feature to the
browser console.

---

## Labels, tooltips & details {#labels-tooltips-details}

Labels route through `displayDefaults` like `color`.
[`showLabels`](/docs/config/linearcanvasbasedisplay/#slot-showlabels) is
`auto`/`on`/`off`, not a boolean:

```json
"displayDefaults": {
  "labels": {
    "name": "jexl:feature.name || feature.id",
    "description": "jexl:feature.note || feature.description || ''"
  },
  "showLabels": "on",
  "showDescriptions": true
}
```

`mouseover` returns the hover text, rendered as HTML so `<b>`, `<br/>`, and
links work:

```json
"displayDefaults": {
  "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`"
}
```

### Customizing the feature details panel {#customizing-the-feature-details-panel}

`formatDetails` sits at the top level of the track, not in `displayDefaults`.
Its `feature` callback returns an object merged into what's shown: name a field
to rewrite it, add one for an extra row, or set it to `undefined` to hide it.

```json
"formatDetails": {
  "feature": "jexl:{name:'<a href=https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name+'>'+feature.name+'</a>', type:undefined}"
}
```

`subfeatures` (with `depth`) reshapes subfeature rows the same way. See
[customizing feature details](/docs/config_guides/customizing_feature_details).

---

## Feature tracks {#feature-tracks}

Genes from GFF3, BED, or bigBed are the same track with a different adapter:

```json
{ "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" }
{ "type": "BedTabixAdapter", "uri": "volvox-bed12.bed.gz" }
{ "type": "BigBedAdapter", "uri": "volvox.bb" }
```

For a **small, unindexed** file use the plaintext adapter (`Gff3Adapter`,
`BedAdapter`, `VcfAdapter`), which reads the whole file into memory.

### Track height

`height` sets the box the track lives in,
[`heightMode`](/docs/config/linearcanvasbasedisplay/#slot-heightmode) what
happens when more features than fit are present:

```json
"displayDefaults": { "height": 200, "heightMode": "fit" }
```

- `fixed` (the default) keeps the height you set and scrolls the overflow
- `grow` expands the track downward until every feature shows, no scrollbar
- `fit` shrinks the features so the whole stack fits the current height

`fit` gets a full pileup or a dense annotation into a screenshot without a
scrollbar cutting it off. It's the "Track sizing" menu on any track.

### Pack features onto fewer rows

[`displayMode`](/docs/config/linearcanvasbasedisplay/#slot-displaymode) sets the
vertical room each feature gets, independent of height. `collapsed` drops
everything onto one row with labels off, for a repeat or mappability stripe:

```json
"displayDefaults": { "displayMode": "collapsed" }
```

`normal`, `compact`, and `superCompact` are the other values.

### Draw features as arcs {#draw-features-as-arcs-with-a-jexl-computed-height}

For interactions, breakpoints, or paired features. The arc display isn't a
`FeatureTrack`'s default, so select it with a `displays` array:

```json
"displays": [
  {
    "type": "LinearArcDisplay",
    "arcHeight": "jexl:log10(feature.end-feature.start)*20"
  }
]
```

`color`, `arcHeight`, `thickness`, and `label` all accept `jexl:`, so arc height
can encode span or score. See
[`LinearArcDisplay`](/docs/config/lineararcdisplay).

### Showing only some features (filtering) {#showing-only-some-features-filtering}

`jexlFilters` draws only features passing every expression. Unlike `color`,
filter expressions **leave off the `jexl:` prefix**:

```json
"displayDefaults": {
  "jexlFilters": ["feature.end - feature.start > 1000", "feature.type == 'gene'"]
}
```

The same slot works on variant and alignments tracks.

---

## Alignments tracks {#alignments-tracks}

`colorBy`, `height`, `showSoftClipping`, and `groupBy` are display settings:

```json
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

`colorBy` also takes `strand`, `pairOrientation`, `insertSize`, and
`modifications` (methylation), `groupBy` also `{ "type": "strand" }`. CRAM uses
`CramAdapter` in place of `BamAdapter`.

### Filter reads by SAM flag or tag {#filter-reads-by-sam-flag-or-tag}

`flagExclude` hides reads with any of those bits set, `flagInclude` keeps only
reads with all of them (default 1540 = unmapped, vendor-failed, duplicate; 3844
also hides secondary and supplementary). `tagFilters` restricts by tag value.
Every filter has to pass:

```json
"displayDefaults": {
  "filterBy": { "flagExclude": 1540, "flagInclude": 0, "tagFilters": [{ "tag": "HP", "value": "1" }] }
}
```

[Broad's flag explainer](https://broadinstitute.github.io/picard/explain-flags.html)
adds up a number for you. `fetchSizeLimit` on the adapter caps how much data is
fetched. See [alignments tracks](/docs/config_guides/alignments_track).

---

## Quantitative (wiggle) tracks {#quantitative-wiggle-tracks}

```json
{
  "type": "QuantitativeTrack",
  "trackId": "coverage",
  "name": "Coverage",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
  "displayDefaults": { "color": "#C8B414", "scaleType": "log", "minScore": 0 }
}
```

A bare `color` is single-color mode. Left alone a wiggle is **bicolor**: scores
above `bicolorPivot` draw in `posColor` growing upward, below it in `negColor`
growing downward. Write `color` or `posColor`/`negColor`, never both. A wiggle
colors per signal, not per feature, so the color expressions above don't apply.

[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks the plot: bars, lines, scatter (good for BAF or CN points), or a density
stripe. Its page lists every value, as does
[`LinearWiggleDisplay`](/docs/config/linearwiggledisplay) for the scale slots.

### Multiple signals on one track, each its own color {#multiple-signals-on-one-track-each-its-own-color}

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

`--multiwig` also takes a `.json` sources file of the `name`/`color` rows above.
`subadapters` is just a list, so past a handful of samples, generate it from
your samplesheet.

<Figure caption="A three-sample MultiQuantitativeTrack over the AMY1 cluster (multirowxy): each 1000 Genomes sample's copy number draws in its own color and varies across the locus." src="/img/cookbook_multiwig.png"/>

---

## Variant tracks {#variant-tracks}

```json
"displayDefaults": {
  "jexlFilters": ["feature.start<8000"],
  "color": "jexl:feature.start>5000?'darkgreen':'red'"
}
```

Multi-sample VCFs open in the standard variant display. For genotypes as a grid,
switch from the track menu or name the display in the config:

```json
"displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay" }]
```

See [variant tracks](/docs/config_guides/variant_track).

---

## Synteny and dotplot tracks {#synteny-and-dotplot-tracks}

A `SyntenyTrack` lines up two assemblies and feeds both the dotplot and
linear-synteny views. Pick the adapter matching your aligner: `PAFAdapter` for
minimap2/wfmash, `DeltaAdapter` for MUMmer, `ChainAdapter` for liftOver/lastz.

Everyone trips on which assembly is which. minimap2 takes its inputs **target
first** (`minimap2 grape.fa peach.fa` makes grape the target), so name them
outright rather than tracking the order yourself:

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

The query draws on the dotplot's horizontal axis (top row in linear synteny),
the target on the vertical (bottom row). Both must already exist in
`assemblies`. **Track loads blank?** Almost always swapped assemblies: flip
`queryAssembly` and `targetAssembly`. See the
[synteny track guide](/docs/config_guides/synteny_track) and the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

### Large alignments {#synteny-large-alignments}

Every adapter but `PairwiseIndexedPAFAdapter` reads the whole file into memory,
so index big PAFs once:

```bash
jbrowse make-pif alignments.paf   # -> alignments.pif.gz (+ .tbi)
```

```json
"adapter": {
  "type": "PairwiseIndexedPAFAdapter",
  "uri": "alignments.pif.gz",
  "queryAssembly": "peach",
  "targetAssembly": "grape"
}
```

### Gene-level synteny from ortholog tables {#synteny-mcscan}

`MCScanAnchorsAdapter` links orthologous genes rather than sequence alignments,
and needs the MCScan workflow's per-assembly BED files. MCScan adapters take
only `assemblyNames`, query first:

```json
"adapter": {
  "type": "MCScanAnchorsAdapter",
  "uri": "grape.peach.anchors.gz",
  "bed1": "grape.bed.gz",
  "bed2": "peach.bed.gz",
  "assemblyNames": ["grape", "peach"]
}
```

See the [ortholog-tables tutorial](/docs/tutorials/multiway_synteny), which also
covers `MCScanBlocksAdapter` for a `.blocks` table.

### Stacking more than two genomes {#synteny-stacking}

A `LinearSyntenyView` takes N assembly rows and one track entry per band (three
rows, two bands), all servable by the same all-vs-all track:

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

`minAlignmentLength` hides the short alignments that would bury the shared
backbone. Walkthroughs: [all-vs-all synteny](/docs/tutorials/allvsall_synteny)
from one PAF, [ortholog tables](/docs/tutorials/multiway_synteny) from a jcvi
`.blocks` file.

### Related views {#synteny-related}

- [Dotplot view](/docs/user_guides/dotplot_view) and
  [linear synteny view](/docs/user_guides/linear_synteny_view) for what each
  view does with the track
- [Synteny on genomes.jbrowse.org](/docs/tutorials/genomes_synteny) to launch a
  synteny view from a liftOver track in a linear genome view
- [Pangenome graphs](/docs/tutorials/pangenome) for graph-derived alignments

---

## Instance-wide settings {#instance-wide-settings}

**Track folders**, set on the track. Nested arrays nest folders in the
[hierarchical track selector](/docs/config_guides/track_selector):

```json
"category": ["RNA-seq", "Brain"]
```

**Metadata** shown in the track details:

```json
"metadata": { "description": "150bp paired-end reads", "source": "See <a href='https://example.com'>the paper</a>" }
```

**Text searching.** `jbrowse text-index` builds the index and writes the
matching `aggregateTextSearchAdapters` entry into your config, after which the
search box jumps to genes by name. See
[text searching](/docs/config_guides/text_searching) to hand-write or relocate
one.

**Theming.** `primary` and `secondary` drive the toolbars and highlights,
`tertiary`/`quaternary` the accents. See
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

**Plugins.** `esmLoc` for a file next to your config, `esmUrl` for one hosted
elsewhere, see [plugins](/docs/config_guides/plugins):

```json
"plugins": [{ "name": "MyPlugin", "esmLoc": { "uri": "myplugin.js" } }]
```

**Opening to a specific view** with the `defaultSession` from
[the config above](#tldr-a-complete-config-on-one-screen), see
[default session](/docs/config_guides/default_session).

---

## From config to a URL {#from-config-to-a-url}

A link names what `config.json` already defines:

```
https://host/jbrowse2/?config=config.json&assembly=volvox&loc=ctgA:1-50000&tracks=genes,coverage
```

- `config` is which config file to load
- `assembly` is the `name` of an entry in `assemblies` (not a track, a common
  mix-up)
- `loc` is a region, or a gene name if you've run `jbrowse text-index`
- `tracks` is a comma-separated list of `trackId`s to turn on

Such a link starts a **fresh** view, ignoring any `defaultSession`;
`&extendSession=true` keeps the session and changes only the location.

To set how a track _looks_, give it a `displaySnapshot`, taking the same
settings as `displayDefaults`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-50000","tracks":[{"trackId":"genes","displaySnapshot":{"color":"green"}}]}]}
```

`&sessionTracks=` adds a track the config has never heard of, taking the same
objects as its `tracks` array. A `FromConfigAdapter` carries features inline, so
a region of interest travels in the link:

```
&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"1","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

See the [URL query parameter API](/docs/urlparams) for the full list, multi-view
layouts, and the encoded links the "Share" button produces, and
[FromConfig adapters](/docs/config_guides/from_config) for inline features in a
config.

---

## Where to go next

- [Config guide](/docs/config_guide) - structure of `config.json` and links to
  every per-track guide
- [Using jexl callbacks](/docs/config_guides/jexl) - full catalog of callback
  functions
- [Supported file types](/docs/config_guides/file_types) - every format and its
  adapter
- [Config reference](/docs/config/basetrack) - the complete, auto-generated slot
  list for every track, display, and adapter
- [Automating JBrowse](/docs/automating) - the shared `init` launch model across
  config, URL, and embedded components
