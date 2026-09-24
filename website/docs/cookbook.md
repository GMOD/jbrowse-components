---
title: Cookbook
sidebar_label: Cookbook (config recipes)
description:
  'Copy-paste recipes for the most common JBrowse 2 configuration tasks: colors,
  labels, tooltips, tracks, themes, and more'
---

Copy-paste recipes for the settings people reach for most. Each is a whole track
config, so it lands the same way in `config.json`, through the CLI, or pasted
into a running JBrowse. They run against the `volvox` sample data JBrowse ships
([`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox)).

## The smallest config

An assembly to supply the reference sequence, and a track to draw on it:

```json
{
  "$schema": "https://jbrowse.org/jb2/schema/v5/config.json",
  "assemblies": [{ "name": "volvox", "uri": "volvox.2bit" }],
  "tracks": [{ "trackId": "genes", "uri": "volvox.sort.gff3.gz" }]
}
```

JBrowse reads the adapter and the track type off the file's extension, finds the
index sibling, and takes `name` from the file name
([the shortest track](/docs/config_guides/tracks#the-shortest-track)). The same
track written out. Every recipe below starts from this:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" }
}
```

Display settings go in `displayDefaults`, which routes each one to the display
that defines it. A `jexl:` prefix turns any slot into a per-feature callback
([using jexl callbacks](/docs/config_guides/jexl)). **About → Copy config** on a
track writes out what you set in the app.

## A complete config

A config.json with the settings people usually reach for: a track of each common
type, a [`defaultSession`](/docs/config_guides/default_session) to open on load,
and a theme. Every recipe below changes one piece of it.

```json
{
  "$schema": "https://jbrowse.org/jb2/schema/v5/config.json",
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
        "color": { "field": "mapq" },
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
        "scales": { "y": { "type": "log", "domainMin": 0 } }
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

## Colors

`color` takes a CSS color or a `jexl:` expression that runs once per feature.
These are the colors **Color by... → Strand** writes, so forward stays red
everywhere in the app, synteny ribbons included:

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

<Figure caption="NCBI RefSeq genes on hg38 with this recipe applied: forward-strand genes red, reverse-strand blue." src="/img/cookbook_color_by_strand.png"/>

Every attribute is a plain property on `feature`. VCF `INFO` fields parse as
arrays, so index them (`feature.INFO.SVTYPE[0]`), and on a gene track the
expression runs once per exon, so a transcript's attribute is
`feature.parent.myattr`. A `color` that comes out undefined paints magenta.

| Recipe                            | `displayDefaults`                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Solid color                       | `{ "color": "#6a3d9a" }`                                                                      |
| By feature type (lookup table)    | `{ "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] \|\| 'gray'" }` |
| By a numeric threshold            | `{ "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }`                                 |
| Continuous gradient from a number | ``{ "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }``                                     |
| Auto color per category           | `{ "color": "jexl:randomColor(feature.type)" }`                                               |
| BED file's own colors             | leave `color` unset                                                                           |
| BAM/CRAM tag (`AlignmentsTrack`)  | `{ "color": { "field": "tags.HP" } }`                                                         |

The lookup table can key on any field the track exposes, and the `legend` slot
names what each color stands for:

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

<Figure caption="UCSC RepeatMasker over a 17q21 window with the lookup table above: every repeat gets the color of its repClass, and classes missing from the table draw gray. The key over the track is the legend slot." src="/img/cookbook_color_by_type.png"/>

[](/docs/config_guides/customizing_feature_colors) covers reading the type list
off the file and moving an outgrown callback into a plugin.

## Labels, tooltips & details {#labels-tooltips-details}

[`showLabels`](/docs/config/linearcanvasbasedisplay/#slot-showlabels) pins which
text is drawn at every zoom, and `mouseover` is rendered as HTML:

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

`formatDetails` reshapes the click-details panel: the returned object merges
into what is shown, a field set to `undefined` is hidden, and a bare URL becomes
a link:

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

[](/docs/config_guides/customizing_feature_details) covers subfeatures, the
session-wide form, and the About dialog.

## Feature tracks

A feature track fits its height by default: a crowded window drops labels and
then squeezes the rows rather than scrolling.
[`heightMode`](/docs/config/linearcanvasbasedisplay/#slot-heightmode) `fixed`
keeps every label and scrolls instead. `jexlFilters` draws only the features
that pass every expression, on variant tracks too:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "long_genes",
  "name": "Long genes only",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "height": 200,
    "jexlFilters": [
      "feature.end - feature.start > 1000",
      "feature.type == 'gene'"
    ]
  }
}
```

## Alignments tracks

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam",
  "name": "Haplotype 1 reads",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "height": 400,
    "color": { "field": "mapq" },
    "showSoftClipping": true,
    "facet": { "field": "tags.HP", "domain": ["2", "1"] },
    "filterBy": {
      "flagExclude": 1540,
      "flagInclude": 0,
      "tagFilters": [{ "tag": "HP", "value": "1" }]
    }
  }
}
```

- `color`'s field also takes `strand`, `pairOrientation`, `insertSize` and
  `tags.XX`; a string is one colour for every read
- `baseColor` draws a per-base layer over the reads, whatever `color` fills them
  with: `"modifications"`, `"bisulfite"`, `"baseQuality"` or `"base"`
- `facet` also takes `strand`, `firstOfPairStrand`, `pairOrientation`,
  `splitRead`, `mapq`, or any read field; `domain` pins which haplotype (or
  other value) stacks first — the same slot
  [feature, variant, mark and multiway synteny tracks](/docs/config_guides/grouping_and_ordering)
  all take
- `flagExclude` 1540 hides unmapped, vendor-failed, and duplicate reads; 3844
  also hides secondary and supplementary
  ([flag explainer](https://broadinstitute.github.io/picard/explain-flags.html))
- CRAM uses `CramAdapter` in place of `BamAdapter`

## Quantitative (wiggle) tracks

A string in `color` paints every bar; left alone, a wiggle cuts at its `origin`
and paints the two sides apart.
[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks `xyplot`, `line`, `scatter`, or `density`.

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "coverage",
  "name": "Coverage",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
  "displayDefaults": {
    "color": "#C8B414",
    "scales": { "y": { "type": "log", "domainMin": 0 } }
  }
}
```

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
  "displayDefaults": { "defaultRendering": "line", "rows": "" }
}
```

`rows` decides the layout: `"source"` stacks one row per signal, and `""`,
above, draws every signal in one shared plot box. Pin
`scales.y.domainMin`/`domainMax` when the quantity has an absolute meaning, or
per-row autoscale draws a flat sample at the same height as an amplified one.
Past a handful of samples, generate `subadapters` from your samplesheet
([multi-quantitative tracks](/docs/config_guides/quantitative_track)).

<Figure caption="An eight-sample MultiQuantitativeTrack across 1.5 Mb of chr1, one interpolated line and one color per 1000 Genomes individual on a shared 0 to 5 copy-number scale. Every row sits at two copies through the flanks; only the amylase cluster in the middle separates them, from one copy to four." src="/img/cookbook_multiwig.png"/>

## Variant tracks

`color` and `jexlFilters` work as on a feature track, and VCF `INFO` fields are
the usual thing to branch on:

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

For a multi-sample VCF as a genotype grid, see
[variant tracks](/docs/config_guides/variant_track#multivariant-display-configuration).

## Synteny and dotplot tracks

Getting the two assemblies backwards is the most common mistake here. minimap2
takes its inputs target first (`minimap2 grape.fa peach.fa` makes grape the
target), so name them explicitly. The query draws on the dotplot's horizontal
axis and the top row in linear synteny; if the track loads blank, flip the two.

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

### Large alignments {#synteny-large-alignments}

Every synteny adapter reads the whole file into memory, except the indexed (PIF)
ones. Index a big PAF once, then use the same track with
`"type": "PairwiseIndexedPAFAdapter"` and the `.pif.gz` as its `uri`:

```bash
jbrowse make-pif alignments.paf   # -> alignments.pif.gz (+ .tbi)
```

The [synteny track guide](/docs/config_guides/synteny_track) has every adapter,
and [all-vs-all synteny](/docs/tutorials/allvsall_synteny) stacks more than two
genomes from one PAF. Three or more genomes as one lane apiece, rather than
every assembly anchored against one reference, is `MultiWaySyntenyDisplay`
([grouping and lane order](/docs/config_guides/grouping_and_ordering#multiway-synteny)
has a worked config).

## Instance-wide settings

A nested `category` makes nested folders in the track selector, and `metadata`
shows in the track details:

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

`refNameAliases` lines up tracks that name the same chromosome differently (chr1
vs 1 vs NC_000001):

```json addassembly
{
  "name": "volvox",
  "uri": "volvox.2bit",
  "refNameAliases": { "uri": "volvox.chromAliases.txt" }
}
```

- **Text searching:** `jbrowse text-index` builds the index and writes it into
  your config ([text searching](/docs/config_guides/text_searching))
- **Theme:** `configuration.theme`, as in the complete config above
  ([theming](/docs/config_guides/theme))
- **Plugins:**
  `"plugins": [{ "name": "MyPlugin", "esmLoc": { "uri": "myplugin.js" } }]`
  ([plugins](/docs/config_guides/plugins))

## From config to a URL

```text
https://host/jbrowse2/?config=config.json&assembly=volvox&loc=ctgA:1-50000&tracks=genes,coverage
```

`assembly` is the `name` of an entry in `assemblies`, `loc` is a region or a
gene name once you have run `jbrowse text-index`, and `tracks` is a list of
`trackId`s. A link like this ignores any `defaultSession`; add
`&extendSession=true` to keep the session and change only the location. See
[](/docs/urlparams) for display settings in the link, multi-view layouts, and
share links.

## Where to go next

- [](/docs/config_guides/grouping_and_ordering) - the `domain` slot that orders
  sections, lanes and rows, across every display type that has one
- [](/docs/config_guide) - structure of `config.json` and every per-track guide
- [](/docs/cli) - `add-track --displayDefaults '<json>'` applies any recipe
  above
- [Config reference](/docs/config) - the auto-generated slot list for every
  track, display, and adapter
