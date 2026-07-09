---
title: Cookbook
description:
  Copy-paste recipes for the most common JBrowse 2 configuration tasks —
  colors, labels, tooltips, tracks, themes, and more
---

A collection of short, copy-paste recipes for the things people configure most
often. Each recipe is a self-contained snippet you can drop into your
`config.json` and adapt. The examples use the `volvox` sample data (in
[`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox))
so you can try them against a real dataset.

**New here?** Read the [TL;DR](#tldr-a-complete-config-on-one-screen) and
[How config shorthand works](#how-config-shorthand-works) first — they explain
the terse syntax used by every recipe below. Then jump to the recipe you need:

- **Colors** — [solid](#solid-color) · [by strand](#color-by-strand) ·
  [by type](#color-by-feature-type-lookup-table-with-default) ·
  [by score](#color-by-a-numeric-threshold) ·
  [SNP vs indel](#different-colors-for-snps-vs-indels-variants)
- **Labels & tooltips** — [labels](#labels) · [tooltips](#tooltips-mouseover)
- **Tracks** — [features](#feature-tracks) · [alignments](#alignments-tracks) ·
  [wiggle](#quantitative-wiggle-tracks) · [variants](#variant-tracks) ·
  [inline data](#inline-data-no-files)
- **The instance** — [assemblies](#assemblies) ·
  [organizing tracks](#organizing-tracks) · [search](#text-searching-gene-name-search) ·
  [theme](#theming) · [open to a region](#opening-to-a-specific-view-on-load)
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

A location is really a `{ "uri": "..." }` object. `"locationType":
"UriLocation"` is optional for URLs and only needed for local desktop paths.
See [supported file types](/docs/config_guides/file_types) for the `uri`
shorthand of every format.

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
    "renderer": { "type": "...", "color": "green" },
    "height": 200
  }
]
```

If a track can be drawn more than one way, each setting lands where it fits —
e.g. a `VariantTrack` uses `color` for its linear display and `strokeColor` for
its circular one, both in the same object. A setting nothing uses is ignored
with a console warning, so typos surface.

Reach for the **full `displays` array** only when you need precise control:
two displays with different values, choosing the default display, or a fixed
`displayId`. The [tooltip recipe](#tooltips-mouseover) below is one such case,
because `mouseover` sits on the renderer, not in `displayDefaults`.

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

Everything below is the config those commands generate, which you can also hand-edit.

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

### Solid color

```json
"displayDefaults": { "color": "#6a3d9a" }
```

### Color by strand

```json
"displayDefaults": { "color": "jexl:feature.strand==1?'#1f77b4':'#d62728'" }
```

### Color by feature type (lookup table with default)

```json
"displayDefaults": {
  "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] || 'gray'"
}
```

### Color by a numeric threshold

```json
"displayDefaults": { "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }
```

### Different colors for SNPs vs indels (variants)

A `VariantTrack` colors its linear display with `color`:

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

### Color with a plugin function (when the logic is large)

If the callback is more than a one-liner, move it into a small plugin function
and call it from jexl. See
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
the full plugin file.

```json
"displayDefaults": { "color": "jexl:colorFeature(feature)" }
```

---

## Labels

### Label with a fallback (first non-empty wins)

```json
"displayDefaults": { "labels": { "name": "jexl:feature.name || feature.id" } }
```

### Show a description under the name

```json
"displayDefaults": {
  "labels": {
    "name": "jexl:feature.name || feature.id",
    "description": "jexl:feature.note || feature.description || ''"
  },
  "showLabels": true,
  "showDescriptions": true
}
```

### Build a composite label

```json
"displayDefaults": {
  "labels": { "name": "jexl:feature.name+' ['+feature.type+']'" }
}
```

---

## Tooltips (mouseover)

### Custom tooltip template

```json
{
  "type": "FeatureTrack",
  "trackId": "custom_tooltips",
  "name": "Custom tooltips",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "displayId": "custom_tooltips-LinearBasicDisplay",
      "renderer": {
        "type": "CanvasFeatureRenderer",
        "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`",
        "subfeatureMouseover": "jexl:feature.name+' — parent: '+feature.parent.name"
      }
    }
  ]
}
```

Tooltips render the returned string as HTML, so you can include `<b>`, `<br/>`,
and links.

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

### Set the drawing height

```json
"displayDefaults": { "height": 200 }
```

### Draw features as arcs, with a jexl-computed height

Useful for interactions, breakpoints, or paired features:

```json
"displays": [
  {
    "type": "LinearArcDisplay",
    "displayId": "arcs-LinearArcDisplay",
    "renderer": {
      "type": "ArcRenderer",
      "height": "jexl:log10(feature.end-feature.start)*20"
    }
  }
]
```

---

## Alignments tracks

### Color reads by mapping quality (or other schemes) and set a taller height

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_bam",
  "name": "My alignments",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displays": [
    {
      "type": "LinearPileupDisplay",
      "displayId": "my_bam-LinearPileupDisplay",
      "height": 400,
      "colorBy": { "type": "mappingQuality" }
    }
  ]
}
```

Other `colorBy` types include `strand`, `pairOrientation`, `insertSize`, and
`modifications` (for methylation). CRAM uses the `CramAdapter` in place of
`BamAdapter`.

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
      { "type": "BigWigAdapter", "name": "Grain1", "uri": "v1.cram.bw", "color": "#f00" },
      { "type": "BigWigAdapter", "name": "Grain2", "uri": "v2.cram.bw", "color": "#f60" },
      { "type": "BigWigAdapter", "name": "Grain3", "uri": "v3.cram.bw", "color": "#fa0" }
    ]
  },
  "displayDefaults": { "defaultRendering": "multiline" }
}
```

`defaultRendering` also accepts `xyplot`, `density`, and `multirowxy`.

---

## Variant tracks

### Filter which variants are shown

Apply `jexl` filters so only matching features render:

```json
"displays": [
  {
    "type": "LinearVariantDisplay",
    "displayId": "vcf-LinearVariantDisplay",
    "jexlFilters": ["feature.start<8000"],
    "color": "jexl:feature.start>5000?'darkgreen':'red'"
  }
]
```

Multi-sample VCFs automatically get a genotype matrix display; no extra config
is needed. See [variant tracks](/docs/config_guides/variant_track).

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
      { "uniqueId": "f1", "refName": "ctgA", "start": 190, "end": 400, "name": "SE_001", "type": "gene" },
      { "uniqueId": "f2", "refName": "ctgA", "start": 191, "end": 300, "name": "SE_002", "type": "gene" }
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
`&extendSession=true` — then JBrowse keeps your session's tracks and settings and
only changes the location (and you can drop `&assembly=`, since it comes from the
session).

### Setting a track's color (or height) in the link

Everything above turns tracks *on*. You can also control how a track *looks*
right from the link — the same appearance settings you'd normally put in
`displayDefaults` in the config. Instead of listing a track as a plain
`"genes"`, list it as an object and add a `displaySnapshot`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-50000","tracks":[{"trackId":"genes","displaySnapshot":{"color":"green"}}]}]}
```

This opens the genes track colored green without changing the config. Anything
you'd write in `displayDefaults` (color, height, display type, score range) works
here too.

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
display settings — you've written something you can reuse in three places without
rewriting it:

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
