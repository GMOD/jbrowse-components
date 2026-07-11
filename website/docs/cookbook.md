---
title: Cookbook
description:
  Copy-paste recipes for the most common JBrowse 2 configuration tasks — colors,
  labels, tooltips, tracks, themes, and more
---

A collection of short, copy-paste recipes for the things people configure most
often. Each recipe is a self-contained snippet you can drop into your
`config.json` and adapt. The examples use the `volvox` sample data (in
[`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox))
so you can try them against a real dataset. For the full reference behind these
recipes, see the [Config guide](/docs/config_guide).

**New here?** Read the [TL;DR](#tldr-a-complete-config-on-one-screen) and
[How config shorthand works](#how-config-shorthand-works) first — they explain
the terse syntax used by every recipe below. Then jump to the recipe you need:

- **Colors** — [what you can color by](#what-you-can-color-by) ·
  [solid](#solid-color) · [by strand](#color-by-strand) ·
  [by type](#color-by-feature-type-lookup-table-with-default) ·
  [by score](#color-by-a-numeric-threshold) ·
  [gradient](#continuous-gradient-from-a-number) ·
  [by BAM/CRAM tag](#color-reads-by-a-bamcram-tag) ·
  [SNP vs indel](#different-colors-for-snps-vs-indels-variants) ·
  [BED itemRgb](#use-the-colors-already-in-a-bed-file-itemrgb) ·
  [plugin function](#color-with-a-plugin-function-when-the-logic-is-large) ·
  [debugging](#debugging-a-color-callback)
- **Labels, tooltips & details** — [labels](#labels) ·
  [tooltips](#tooltips-mouseover) ·
  [feature details panel](#customizing-the-feature-details-panel)
- **Tracks** — [features](#feature-tracks) · [alignments](#alignments-tracks) ·
  [wiggle](#quantitative-wiggle-tracks) · [variants](#variant-tracks) ·
  [synteny/dotplot](#synteny-and-dotplot-tracks) ·
  [filter features](#showing-only-some-features-filtering) ·
  [inline data](#inline-data-no-files)
- **The instance** — [assemblies](#assemblies) ·
  [organizing tracks](#organizing-tracks) ·
  [search](#text-searching-gene-name-search) · [theme](#theming) ·
  [load a plugin](#loading-a-plugin) ·
  [open to a region](#opening-to-a-specific-view-on-load)
- **Launching** — [config → URL](#from-config-to-a-url) ·
  [color a track in the link](#setting-a-tracks-color-or-height-in-the-link) ·
  [reuse a view everywhere](#the-same-view-definition-works-everywhere)

---

## TL;DR: a complete config on one screen {#tldr-a-complete-config-on-one-screen}

This is a full, working `config.json` — one assembly, three tracks, and an
opening view — written as compactly as JBrowse allows. Every recipe on this page
is a variation on one of these blocks.

```json
{
  "assemblies": [
    {
      "name": "volvox",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "volvox_refseq",
        "adapter": { "type": "TwoBitAdapter", "uri": "volvox.2bit" }
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "genes",
      "name": "Genes",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
      "displayDefaults": { "color": "jexl:feature.strand==1?'blue':'red'" }
    },
    {
      "type": "AlignmentsTrack",
      "trackId": "reads",
      "name": "Reads",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" }
    },
    {
      "type": "QuantitativeTrack",
      "trackId": "coverage",
      "name": "Coverage",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
      "displayDefaults": { "color": "#C8B414", "scaleType": "log" }
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
          "tracks": ["genes", "reads", "coverage"]
        }
      }
    ]
  }
}
```

That's it — no index paths, no display IDs, no renderer names. The next section
explains why it can be this short.

---

## How config shorthand works {#how-config-shorthand-works}

JBrowse configs used to be verbose. Modern JBrowse expands two kinds of
**shorthand** for you at load time (via a config `preProcessSnapshot` step), so
you only write the parts that matter.

### Adapter `uri` shorthand

Write the data file once as `uri` and JBrowse fills in the companion index and
the correctly-named location slot:

```json
{ "type": "BamAdapter", "uri": "sample.bam" }
```

expands to the full form:

```json
{
  "type": "BamAdapter",
  "bamLocation": { "uri": "sample.bam" },
  "index": { "location": { "uri": "sample.bam.bai" } }
}
```

The index name is inferred from the adapter: `.bam` → `.bam.bai`, `.cram` →
`.cram.crai`, and bgzip+tabix files (`.vcf.gz`, `.gff3.gz`, `.bed.gz`) → `.tbi`.

Use the **full form** only when the shorthand's assumption is wrong — a `.csi`
index, or an index whose name doesn't follow `file + .bai/.crai/.tbi`:

```json
{
  "type": "BamAdapter",
  "bamLocation": { "uri": "sample.bam" },
  "index": {
    "indexType": "CSI",
    "location": { "uri": "sample.bam.csi" }
  }
}
```

A location is really a `{ "uri": "..." }` object.
`"locationType": "UriLocation"` is optional for URLs and only needed for local
desktop paths. See [supported file types](/docs/config_guides/file_types) for
the `uri` shorthand of every format.

### `displayDefaults` shorthand

Appearance lives on a track's **displays** (the ways a track can be drawn). Put
color, height, labels, and scale in a `displayDefaults` object and JBrowse
routes each setting to the display that uses it — you never have to name the
display or write a `displays` array:

```json
"displayDefaults": { "color": "green", "height": 200 }
```

expands to:

```json
"displays": [
  {
    "type": "LinearBasicDisplay",
    "displayId": "<trackId>-LinearBasicDisplay",
    "color": "green",
    "height": 200
  }
]
```

If a track can be drawn more than one way, each setting lands where it fits —
e.g. a `VariantTrack` uses `color` for its linear display and `strokeColor` for
its circular one, both in the same object. A setting nothing uses is ignored
with a console warning, so typos surface.

Reach for the **full `displays` array** only when you need precise control:
selecting a non-default display type (like the
[arc display](#draw-features-as-arcs-with-a-jexl-computed-height) below), two
displays with different values, or a fixed `displayId`. Everything else —
including `mouseover` and `jexlFilters` — routes through `displayDefaults`.

### `jexl:` callbacks

Any slot value starting with `jexl:` is a per-feature callback. Read attributes
as plain properties (`feature.type`, `feature.strand`, `feature.INFO.SVTYPE`):

```json
"color": "jexl:feature.strand==1?'blue':'red'"
```

See [using jexl callbacks](/docs/config_guides/jexl) for the full function
catalog.

---

## Getting data in fast (CLI)

The quickest path to a working instance is the CLI — it writes the config for
you. See the [web quickstart](/docs/quickstart_web).

```bash
jbrowse create jbrowse2 && cd jbrowse2
samtools faidx genome.fa && jbrowse add-assembly genome.fa --load copy
samtools index file.bam && jbrowse add-track file.bam --load copy
bgzip file.vcf && tabix file.vcf.gz && jbrowse add-track file.vcf.gz --load copy
jbrowse text-index      # build search index for gene names
npx serve -S .          # serve locally
```

Everything below is the config those commands generate, which you can also
hand-edit.

### Applying a recipe from the CLI

You don't have to hand-edit the config. `add-track` has `--color` and `--height`
flags that drop straight into `displayDefaults`, so the "color by strand" recipe
is just:

```bash
jbrowse add-track genes.gff3.gz --load copy --name Genes \
  --color 'jexl:feature.strand==1?"blue":"red"' --height 200
```

The trick that keeps it readable: wrap the value in single quotes and use double
quotes _inside_ the jexl, so there's nothing to escape. For any other appearance
setting — `mouseover`, `labels`, `jexlFilters`, a specific display type — pass
inline JSON to `--displayDefaults` (and the catch-all `--config` for non-display
fields like `metadata`):

```bash
jbrowse add-track genes.gff3.gz --load copy \
  --displayDefaults '{"mouseover":"jexl:feature.name","labels":{"description":"jexl:feature.note"}}'
```

See the [CLI reference](/docs/cli) for every flag.

## A minimal config.json

One assembly plus one track is a complete config:

```json
{
  "assemblies": [
    {
      "name": "volvox",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "volvox_refseq",
        "adapter": {
          "type": "TwoBitAdapter",
          "uri": "volvox.2bit"
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "genes",
      "name": "Genes",
      "assemblyNames": ["volvox"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "volvox.sort.gff3.gz"
      }
    }
  ]
}
```

---

## Assemblies

### Reference sequence adapters

Pick the adapter that matches your file. All three are equivalent input for the
same job:

```json
{ "type": "TwoBitAdapter", "uri": "genome.2bit" }
```

```json
{ "type": "BgzipFastaAdapter", "uri": "genome.fa.gz" }
```

```json
{ "type": "IndexedFastaAdapter", "uri": "genome.fa" }
```

`BgzipFastaAdapter` (from `bgzip genome.fa` + `samtools faidx genome.fa.gz`) is
recommended for large genomes.

### Refname aliases (chr1 vs 1 vs NC_000001)

Map alternative chromosome names so tracks that use different conventions line
up. Point at a two-column file (chromAliases) or list them inline:

```json
{
  "name": "volvox",
  "sequence": { "...": "..." },
  "refNameAliases": {
    "adapter": {
      "type": "FromConfigAdapter",
      "features": [
        { "refName": "ctgA", "uniqueId": "a1", "aliases": ["contigA", "A"] },
        { "refName": "ctgB", "uniqueId": "a2", "aliases": ["contigB", "B"] }
      ]
    }
  }
}
```

See [assemblies](/docs/config_guides/assemblies) for the file-based form.

---

## Colors

**The one thing to know:** a track's color is a single setting named `color` in
`displayDefaults`. Its value is _either_ a plain CSS color _or_ a `jexl:`
expression that JBrowse runs once per feature and whose returned string is that
feature's color. Every recipe below is a complete, copy-paste track — the only
line that changes between them is `displayDefaults`, always written last so it's
easy to spot.

### What you can color by

A `jexl:` color expression sees the feature as `feature`. Read any attribute as
a plain property — these are the ones you'll reach for most:

| Read this               | What it is                                       |
| ----------------------- | ------------------------------------------------ |
| `feature.type`          | GFF3/BED type — `gene`, `mRNA`, `CDS`, `exon`, … |
| `feature.strand`        | `1` (+), `-1` (−), or `0` (none)                 |
| `feature.score`         | numeric score (BED/GFF3 score column, wig value) |
| `feature.name`          | display name                                     |
| `feature.start`         | start coordinate (0-based half-open)             |
| `feature.end`           | end coordinate                                   |
| `feature.refName`       | chromosome / contig name                         |
| `feature.INFO.SVTYPE`   | any VCF `INFO` field (variants)                  |
| `getTag(feature, 'HP')` | any BAM/CRAM tag — `HP`, `RG`, `MD`, …           |
| `feature.parent`        | parent feature (e.g. the gene of an mRNA)        |
| `feature.itemRgb`       | BED12/bigBed named columns (see caveat below)    |

The full property and function list is in
[using jexl callbacks](/docs/config_guides/jexl).

### Solid color {#solid-color}

Any CSS color — a hex value, an `rgb()`/`hsl()`, or a named color:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_solid_color",
  "name": "Genes (solid color)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "#6a3d9a" }
}
```

### Color by strand {#color-by-strand}

A ternary on `feature.strand`:

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

<Figure caption="The volvox genes track with this recipe applied: + strand genes blue, - strand genes red." src="/img/cookbook_color_by_strand.png"/>

### Color by feature type (lookup table with default) {#color-by-feature-type-lookup-table-with-default}

Look up the color in a small table keyed by the feature's type — the `|| 'gray'`
catches anything that isn't listed:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_by_type",
  "name": "Genes (colored by type)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] || 'gray'"
  }
}
```

### Color by a numeric threshold {#color-by-a-numeric-threshold}

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_by_threshold",
  "name": "Genes (colored by score)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }
}
```

### Continuous gradient from a number

Want a smooth gradient instead of a hard cutoff? Turn the number straight into a
color — this maps `feature.score` onto an HSL hue, so the color slides as the
score climbs (a [template string](/docs/config_guides/jexl) reads clearest
here):

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_gradient",
  "name": "Genes (score gradient)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }
}
```

### A distinct color per category, automatically

`randomColor` turns any string into a color, and always the same color for the
same string — so every feature type gets its own consistent color and you never
have to pick them:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_random_by_type",
  "name": "Genes (auto color per type)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "jexl:randomColor(feature.type)" }
}
```

`randomColor`, `alpha`, `hsl`, `colorString`, and `interpolate` are the built-in
[color helpers](/docs/config_guides/jexl) in the jexl catalog — e.g.
`alpha('#1f77b4', 0.4)` for a semi-transparent fill where features overlap.

### Color reads by a BAM/CRAM tag {#color-reads-by-a-bamcram-tag}

On an **`AlignmentsTrack`**, let the built-in `colorBy` handle it — it reads the
tag and picks the colors for you, no callback needed:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "reads_by_haplotype",
  "name": "Reads (colored by HP tag)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": { "colorBy": { "type": "tag", "tag": "HP" } }
}
```

Other `colorBy` schemes (`mappingQuality`, `strand`, `pairOrientation`,
`insertSize`, `modifications`) are in [alignments tracks](#alignments-tracks).
To color by a tag on a **`FeatureTrack`** instead, read it in jexl with
`getTag`, which smooths over BAM/CRAM tag differences:
`"color": "jexl:getTag(feature, 'HP')==1?'crimson':'steelblue'"`.

### Different colors for SNPs vs indels (variants) {#different-colors-for-snps-vs-indels-variants}

A `VariantTrack` colors its linear display with `color`, and you can branch on
`feature.type` or any VCF `INFO` field (e.g. `feature.INFO.SVTYPE`):

```json
{
  "type": "VariantTrack",
  "trackId": "variant_colors",
  "name": "SNPs green, indels purple",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "VcfTabixAdapter", "uri": "volvox.filtered.vcf.gz" },
  "displayDefaults": {
    "color": "jexl:feature.type=='SNV'?'green':'purple'"
  }
}
```

### Use the colors already in a BED file (`itemRgb`) {#use-the-colors-already-in-a-bed-file-itemrgb}

BED12 and bigBed carry a per-feature `itemRgb` column — honor it directly:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_itemrgb",
  "name": "Genes (BED itemRgb colors)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigBedAdapter", "uri": "volvox.bb" },
  "displayDefaults": { "color": "jexl:feature.itemRgb || 'gray'" }
}
```

Named BED columns like `itemRgb` are only guaranteed for **BED12**, **bigBed**,
or a track given an `autoSql`/`columnNames`. On a plaintext BED with fewer
columns the extra columns surface generically as `field6`, `field7`, … — see the
BED column-names note in
[customizing feature colors](/docs/config_guides/customizing_feature_colors).

### Color with a plugin function (when the logic is large) {#color-with-a-plugin-function-when-the-logic-is-large}

If the callback outgrows a one-liner, move it into a small plugin that registers
a jexl function (e.g. `colorFeature`) and call it by name — the callback stays
readable and the logic lives in real JavaScript you can test:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_plugin_color",
  "name": "Genes (plugin color function)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "color": "jexl:colorFeature(feature)" }
}
```

This track needs a companion `plugins` array registering `colorFeature`; see
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
the full plugin file.

### Debugging a color callback

Two things catch most mistakes:

- Wrap the expression in `log(...)` to print the value it returns for each
  feature to the browser console: `"color": "jexl:log(feature.type)"` (or
  `log(...)` around the whole expression — it prints and passes the value
  through). See the `log` function in the
  [jexl catalog](/docs/config_guides/jexl).
- If a `displayDefaults` key routes to no display, JBrowse ignores it with a
  console warning — so a mistyped `colour` or `colorBy` surfaces there rather
  than failing silently.

---

## Labels

Labels are display settings too, so they route through `displayDefaults` exactly
like `color`. Each recipe is a complete track.

### Label with a fallback (first non-empty wins)

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_label_fallback",
  "name": "Genes (name with fallback)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "labels": { "name": "jexl:feature.name || feature.id" } }
}
```

### Show a description under the name

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_with_description",
  "name": "Genes (name + description)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.name || feature.id",
      "description": "jexl:feature.note || feature.description || ''"
    },
    "showLabels": true,
    "showDescriptions": true
  }
}
```

### Build a composite label

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_composite_label",
  "name": "Genes (composite label)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "labels": { "name": "jexl:feature.name+' ['+feature.type+']'" }
  }
}
```

---

## Tooltips (mouseover)

### Custom tooltip template

`mouseover` is a per-feature callback; its returned string shows on hover. Like
color and labels, it's a display setting, so it goes straight in
`displayDefaults`:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_custom_tooltip",
  "name": "Genes (custom tooltip)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`"
  }
}
```

Reach subfeature attributes through `feature.parent` (e.g.
`feature.parent.name`). Tooltips render the returned string as HTML, so you can
include `<b>`, `<br/>`, and links.

---

## Customizing the feature details panel {#customizing-the-feature-details-panel}

When you click a feature, the details panel is shaped by the track's
`formatDetails` slot — and note this one sits at the top level of the track, not
in `displayDefaults`. Its `feature` callback returns an object that gets merged
into what's shown: name a field to rewrite it (say, turn `name` into a link),
add a new field to slip in an extra row, or set one to `undefined` to hide it.

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_linked_details",
  "name": "Genes (linked details)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "formatDetails": {
    "feature": "jexl:{name:'<a href=https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name+'>'+feature.name+'</a>', type:undefined}"
  }
}
```

Use `subfeatures` (with `depth`) to reshape subfeature rows the same way. See
[customizing feature details](/docs/config_guides/customizing_feature_details).

---

## Feature tracks

### GFF3, BED, or bigBed genes

Each is the same track with a different adapter:

```json
{ "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" }
```

```json
{ "type": "BedTabixAdapter", "uri": "volvox-bed12.bed.gz" }
```

```json
{ "type": "BigBedAdapter", "uri": "volvox.bb" }
```

For a **small, unindexed** file (no bgzip/tabix needed) use the plaintext
adapter — `Gff3Adapter`, `BedAdapter`, or `VcfAdapter` — which reads the whole
file into memory:

```json
{ "type": "Gff3Adapter", "uri": "volvox.sort.gff3" }
```

### Set the drawing height

```json
"displayDefaults": { "height": 200 }
```

### Draw features as arcs, with a jexl-computed height

Useful for interactions, breakpoints, or paired features. The arc display isn't
a `FeatureTrack`'s default, so select it with a `displays` array. Its appearance
slots (`color`, `arcHeight`, `thickness`, `label`) sit directly on the display
and each accepts a `jexl:` expression:

```json
"displays": [
  {
    "type": "LinearArcDisplay",
    "displayId": "arcs-LinearArcDisplay",
    "arcHeight": "jexl:log10(feature.end-feature.start)*20"
  }
]
```

---

## Showing only some features (filtering) {#showing-only-some-features-filtering}

`jexlFilters` shows only the features that pass every expression you list. One
gotcha to remember: unlike `color`, the filter expressions **leave off the
`jexl:` prefix**.

```json
{
  "type": "FeatureTrack",
  "trackId": "genes_filtered",
  "name": "Only long genes",
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

The same `jexlFilters` works on variant and alignments tracks. To hide reads by
their SAM flags instead, reach for the alignments `filterBy` slot
([below](#alignments-tracks)).

---

## Alignments tracks

### Color reads by mapping quality (or other schemes) and set a taller height

`colorBy` and `height` are display settings, so they go in `displayDefaults`:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam",
  "name": "My alignments",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": { "height": 400, "colorBy": { "type": "mappingQuality" } }
}
```

Other `colorBy` types include `strand`, `pairOrientation`, `insertSize`, and
`modifications` (for methylation). CRAM uses the `CramAdapter` in place of
`BamAdapter`.

### Show soft-clipping and group the pileup

`showSoftClipping` and `groupBy` are both display settings. This track draws the
soft-clipped bases and stacks the reads into haplotype groups by their `HP` tag:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "reads_grouped",
  "name": "Reads (grouped by haplotype)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "showSoftClipping": true,
    "groupBy": { "type": "tag", "tag": "HP" }
  }
}
```

`groupBy` also takes `{ "type": "strand" }` to split the pileup by strand. If
you need to hide reads by their SAM flags, add a `filterBy` — e.g.
`"filterBy": { "flagExclude": 3844 }` to show primary alignments only.

### Limit how much data is fetched

```json
"adapter": { "type": "CramAdapter", "uri": "big.cram", "fetchSizeLimit": 1000 }
```

---

## Quantitative (wiggle) tracks

### BigWig with a custom color

```json
{
  "type": "QuantitativeTrack",
  "trackId": "coverage",
  "name": "Coverage",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigWigAdapter", "uri": "volvox_microarray.bw" },
  "displayDefaults": { "color": "#C8B414" }
}
```

### Log scale and a fixed score range

```json
"displayDefaults": { "scaleType": "log", "minScore": 0, "maxScore": 100 }
```

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
        "uri": "v1.cram.bw",
        "color": "#f00"
      },
      {
        "type": "BigWigAdapter",
        "name": "Grain2",
        "uri": "v2.cram.bw",
        "color": "#f60"
      },
      {
        "type": "BigWigAdapter",
        "name": "Grain3",
        "uri": "v3.cram.bw",
        "color": "#fa0"
      }
    ]
  },
  "displayDefaults": { "defaultRendering": "multiline" }
}
```

The
[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
slot also accepts `multirowxy` (one stacked row per signal), `multirowdensity`,
and `multixyplot` (all signals overlaid in one plot).

---

## Variant tracks

### Filter which variants are shown

Apply `jexl` filters so only matching features render. Note `jexlFilters`
entries omit the `jexl:` prefix (they use a deferred-evaluation convention),
while `color` keeps it:

```json
"displayDefaults": {
  "jexlFilters": ["feature.start<8000"],
  "color": "jexl:feature.start>5000?'darkgreen':'red'"
}
```

Multi-sample VCFs open in the standard variant display; to see genotypes as a
grid, switch to the genotype-matrix display from the track menu, or select it in
the config:

```json
"displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay" }]
```

See [variant tracks](/docs/config_guides/variant_track).

---

## Synteny and dotplot tracks {#synteny-and-dotplot-tracks}

A `SyntenyTrack` lines up two assemblies from a whole-genome alignment and feeds
both the dotplot and linear-synteny views. Pick the adapter that matches your
aligner — `PAFAdapter` for minimap2/wfmash, `DeltaAdapter` for MUMmer,
`ChainAdapter` for liftOver/lastz.

The thing everyone trips on is which assembly is which. minimap2 takes its
inputs **target first**:

```bash
minimap2 grape.fa peach.fa > out.paf   # minimap2 target.fa query.fa
```

so here the **target is grape** and the **query is peach**. Rather than keep the
ordering straight in your head, name them outright with `queryAssembly` and
`targetAssembly` on the adapter — then there's nothing to swap:

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

The query is drawn on the dotplot's horizontal axis (the top row in linear
synteny), the target on the vertical axis (bottom row). Both assemblies must
already exist in `assemblies`.

**Track loads blank?** That's almost always swapped assemblies — the alignment's
coordinates don't line up with the assemblies on screen, so nothing draws. Flip
`queryAssembly` and `targetAssembly` (or, if you used the positional
`assemblyNames: [query, target]` array instead, reverse it). Watch out that
minimap2's `target query` argument order is the _reverse_ of the array's
`[query, target]` — that mismatch is the usual culprit.

To open a dotplot or linear synteny view pointed at this track, see the
[synteny track guide](/docs/config_guides/synteny_track) and the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

---

## Inline data (no files)

Embed a handful of features directly in the config with `FromConfigAdapter` —
handy for demos, tests, or annotations you maintain by hand:

```json
{
  "type": "FeatureTrack",
  "trackId": "inline_features",
  "name": "Inline features",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "FromConfigAdapter",
    "features": [
      {
        "uniqueId": "f1",
        "refName": "ctgA",
        "start": 190,
        "end": 400,
        "name": "SE_001",
        "type": "gene"
      },
      {
        "uniqueId": "f2",
        "refName": "ctgA",
        "start": 191,
        "end": 300,
        "name": "SE_002",
        "type": "gene"
      }
    ]
  }
}
```

See [FromConfig adapters](/docs/config_guides/from_config).

---

## Organizing tracks

### Group tracks in the selector with categories

```json
"category": ["RNA-seq", "Brain"]
```

Nested arrays create nested folders in the
[hierarchical track selector](/docs/config_guides/track_selector).

### Add metadata shown in the track details

```json
"metadata": {
  "description": "150bp paired-end reads",
  "source": "See <a href='https://example.com'>the paper</a>"
}
```

---

## Text searching (gene name search)

Build an index with `jbrowse text-index`, then reference it so the search box
can jump to genes by name:

```json
"aggregateTextSearchAdapters": [
  {
    "type": "TrixTextSearchAdapter",
    "textSearchAdapterId": "volvox-index",
    "ixFilePath": { "uri": "trix/volvox.ix" },
    "ixxFilePath": { "uri": "trix/volvox.ixx" },
    "metaFilePath": { "uri": "trix/volvox_meta.json" },
    "assemblyNames": ["volvox"]
  }
]
```

See [text searching](/docs/config_guides/text_searching).

---

## Theming

### Customize the app colors

Set `configuration.theme.palette`. `primary` and `secondary` drive the toolbars
and highlights; `tertiary`/`quaternary` are used for accents:

```json
"configuration": {
  "theme": {
    "palette": {
      "primary": { "main": "#311b92" },
      "secondary": { "main": "#0097a7" },
      "tertiary": { "main": "#f57c00" },
      "quaternary": { "main": "#d50000" }
    }
  }
}
```

See [coloring/theming](/docs/config_guides/theme) for logos, fonts, and dark
mode.

---

## Loading a plugin {#loading-a-plugin}

Extra plugins — new track types, adapters, or the jexl color/detail functions
from the recipes above — load from a top-level `plugins` array. Use `esmLoc` for
a file next to your config, or `esmUrl` for one hosted elsewhere:

```json
"plugins": [
  { "name": "MyPlugin", "esmLoc": { "uri": "myplugin.js" } }
]
```

See [plugins](/docs/config_guides/plugins) for the UMD form and the published
plugin store.

---

## Opening to a specific view on load

Use `defaultSession` to open JBrowse at a region with tracks already showing:

```json
"defaultSession": {
  "name": "My session",
  "views": [
    {
      "type": "LinearGenomeView",
      "init": {
        "loc": "ctgA:1000-2000",
        "assembly": "volvox",
        "tracks": ["genes", "coverage"]
      }
    }
  ]
}
```

See [default session](/docs/config_guides/default_session), and
[URL params](/docs/urlparams) for linking to a view without editing the config.

---

## From config to a URL

Say you've got JBrowse deployed and a colleague asks "can you show me that gene
on the coverage track?" You don't want to email them a screenshot, or a list of
click-here-then-here steps. You want to send a link that opens JBrowse already
pointed at the right place, with the right tracks turned on.

That's what the URL parameters are for. The important thing to understand is
that a link doesn't set up anything new — it just refers to things your
`config.json` already defines, by name. So it helps to look at the two together.
Here's a stripped-down config:

```json
{
  "assemblies": [{ "name": "volvox", "...": "..." }],
  "tracks": [
    { "trackId": "genes", "...": "..." },
    { "trackId": "coverage", "...": "..." }
  ]
}
```

And here's a link that opens both of those tracks at a region:

```
https://host/jbrowse2/?config=config.json&assembly=volvox&loc=ctgA:1-50000&tracks=genes,coverage
```

Reading it left to right, every piece is just a value copied out of the config:

- `?config=config.json` — which config file to load.
- `&assembly=volvox` — the `name` of an entry in the config's `assemblies` list.
  (This is the assembly's name, not a track — a common mix-up.)
- `&loc=ctgA:1-50000` — where to navigate. A region like this, or a gene name if
  you've run `jbrowse text-index`.
- `&tracks=genes,coverage` — a comma-separated list of `trackId`s to turn on,
  taken straight from the `tracks` array.

So building a link is mostly a matter of reading `trackId`s and the assembly
`name` out of your config and stringing them together. Nothing in the URL exists
that isn't already in the config.

One thing to know: a link like the one above starts a **fresh** view and ignores
any `defaultSession` you configured. If you've carefully curated a default
session and just want to jump to a different region within it, add
`&extendSession=true` — then JBrowse keeps your session's tracks and settings
and only changes the location (and you can drop `&assembly=`, since it comes
from the session).

### Setting a track's color (or height) in the link

Everything above turns tracks _on_. You can also control how a track _looks_
right from the link — the same appearance settings you'd normally put in
`displayDefaults` in the config. Instead of listing a track as a plain
`"genes"`, list it as an object and add a `displaySnapshot`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-50000","tracks":[{"trackId":"genes","displaySnapshot":{"color":"green"}}]}]}
```

This opens the genes track colored green without changing the config. Anything
you'd write in `displayDefaults` (color, height, display type, score range)
works here too.

### Adding a whole track that isn't in the config

You can even add a track that the config has never heard of, using
`&sessionTracks=`. It takes exactly the same track config objects you'd put in
the config's `tracks` array — so you can, for example, drop in a few features
inline with a [`FromConfigAdapter`](#inline-data-no-files) (handy for sharing a
BLAST hit or a region of interest) straight from the URL bar:

```
&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"1","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

For the full list of parameters — plus multi-view layouts, dotplots, synteny,
and the shareable encoded links the "Share" button produces — see the
[URL query parameter API](/docs/urlparams).

### The same view definition works everywhere

Once you've described a view — an assembly, a location, some tracks, maybe a few
display settings — you've written something you can reuse in three places
without rewriting it:

- in the config, as `defaultSession.views[].init`, so it loads for everyone;
- in a URL, as a session spec, so you can hand it to one person; and
- in an embedded component, passed to `createViewState`, so it renders inside
  your own web page.

They all accept the same shape, so a view you work out in one place drops into
the others. [Automating JBrowse](/docs/automating) covers this shared launch
model, and [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) shows
the embedded version.

---

## Where to go next

- [Config guide](/docs/config_guide) — structure of `config.json` and links to
  every per-track guide
- [Using jexl callbacks](/docs/config_guides/jexl) — full catalog of callback
  functions
- [Supported file types](/docs/config_guides/file_types) — every format and its
  adapter
- [URL query parameter API](/docs/urlparams) — supplying assemblies, tracks, and
  views from a URL
- [Automating JBrowse](/docs/automating) — the shared `init` launch model across
  config, URL, and embedded components
- [Config reference](/docs/config/basetrack) — the complete, auto-generated slot
  list for every track, display, and adapter
