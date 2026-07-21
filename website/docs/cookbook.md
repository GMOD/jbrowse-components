---
title: Cookbook
description:
  'Copy-paste recipes for the most common JBrowse 2 configuration tasks: colors,
  labels, tooltips, tracks, themes, and more'
---

Short, copy-paste recipes for the `config.json` settings people reach for most.
Examples use the `volvox` sample data
([`test_data/volvox`](https://github.com/GMOD/jbrowse-components/tree/main/test_data/volvox))
so you can try them directly. For the full reference, see the
[Config guide](/docs/config_guide).

**New here?** Read the [TL;DR](#tldr-a-complete-config-on-one-screen) and
[shorthand](#how-config-shorthand-works) sections first, then use the **"On this
page"** panel (top right) to jump to a recipe.

---

## TL;DR: a complete config on one screen {#tldr-a-complete-config-on-one-screen}

Here's a full, working `config.json`: one assembly, four tracks, an opening
view, and a custom theme. It's written with all the shorthand JBrowse allows,
and it quietly puts about a dozen of the recipes below to work. Read it for the
shape of a config; every section after it zooms in on one piece. It's long on
purpose, so skim past it once you have the gist.

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
      "type": "FeatureTrack",
      "trackId": "regions",
      "name": "Regions of interest",
      "category": ["Annotation"],
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BedTabixAdapter", "uri": "volvox-bed12.bed.gz" },
      "displayDefaults": { "color": "#6a3d9a" }
    },
    {
      "type": "AlignmentsTrack",
      "trackId": "reads",
      "name": "Reads",
      "assemblyNames": ["volvox"],
      "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
      "displayDefaults": {
        "heightMode": "fit",
        "colorBy": { "type": "mappingQuality" }
      }
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
          "tracks": ["genes", "regions", "reads", "coverage"]
        }
      }
    ]
  },
  "configuration": {
    "theme": {
      "palette": {
        "primary": { "main": "#311b92" },
        "secondary": { "main": "#0097a7" }
      }
    }
  }
}
```

Nearly everything there is a plain CSS color, a `jexl:` one-liner, or a bare
`uri`: no index paths, no display IDs, no renderer names. The next section
explains why so little is needed. And the floor is much lower than this too. One
assembly plus one track, no `defaultSession` and no theme, is already a complete
config.

---

## How config shorthand works {#how-config-shorthand-works}

JBrowse expands a few kinds of **shorthand** at load time (a config
`preProcessSnapshot` step), so you only write the parts that matter.

### Adapter `uri` shorthand

Write the data file once as `uri` and JBrowse fills in the companion index and
location slot:

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

Use the **full form** only when the shorthand guesses wrong, e.g. a `.csi`
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

A location is a `{ "uri": "..." }` object. You almost never need the
`"locationType"` field, which JBrowse infers (local desktop files use
`{ "localPath": "..." }` instead). See
[supported file types](/docs/config_guides/file_types) for every format's `uri`
shorthand.

### Assembly `{ name, uri }` shorthand

An assembly is, at its flattest, just a `name` and a sequence-file `uri`:

```json
{ "name": "volvox", "uri": "volvox.2bit" }
```

expands to the full assembly. JBrowse picks the adapter from the file extension
(`.2bit` → `TwoBitAdapter`, `.fa.gz` → `BgzipFastaAdapter`, `.fa` →
`IndexedFastaAdapter`), derives the `.fai`/`.gzi` index siblings, and fills in
the `ReferenceSequenceTrack`:

```json
{
  "name": "volvox",
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "volvox-ReferenceSequenceTrack",
    "adapter": { "type": "TwoBitAdapter", "uri": "volvox.2bit" }
  }
}
```

`refNameAliases` and `cytobands` take the same bare `{ "uri": "..." }`:

```json
{
  "name": "hg38",
  "uri": "hg38.fa.gz",
  "refNameAliases": { "uri": "hg38.aliases.txt" },
  "cytobands": { "uri": "hg38.cytoBand.txt" }
}
```

Keep the `uri` _key_ (rather than a bare string) so relative uris still resolve
against the config's location. If you only want to drop the `type`/`trackId`
boilerplate but need extra adapter fields (a `chromSizesLocation` for a 2bit, a
non-sibling `.fai`), write the adapter out and let its own `uri` shorthand fill
in the rest: `"sequence": { "adapter": { "uri": "volvox.2bit" } }`. See the
[`BaseAssembly` config](/docs/config/baseassembly) for every form.

### `displayDefaults` shorthand

Appearance lives on a track's **displays** (the ways it can be drawn). Put
color, height, labels, and scale in `displayDefaults` and JBrowse routes each
setting to the right display, so you never have to name the display or write a
`displays` array:

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

If a track can be drawn more than one way, each setting lands where it fits. For
example, a `VariantTrack` uses `color` for its linear display and `strokeColor`
for its circular one, both in the same object. A setting nothing uses is ignored
with a console warning, so typos surface.

Reach for the **full `displays` array** only when you need precise control:
selecting a non-default display type (like the
[arc display](#draw-features-as-arcs-with-a-jexl-computed-height) below), two
displays with different values, or a fixed `displayId`. Everything else,
including `mouseover` and `jexlFilters`, routes through `displayDefaults`.

### `jexl:` callbacks

Any slot value starting with `jexl:` is a per-feature callback. Read attributes
as plain properties (`feature.type`, `feature.strand`, `feature.INFO.SVTYPE`):

```json
"color": "jexl:feature.strand==1?'blue':'red'"
```

See [using jexl callbacks](/docs/config_guides/jexl) for the full function
catalog.

### One important thing: these settings aren't config-only

Everything on this page is either a `displayDefaults` object or a view
definition, and neither one is tied to `config.json`. JBrowse treats config and
session as the same vocabulary, so the identical object works in four places:

- in **`config.json`**, as a track's `displayDefaults` and a `defaultSession`,
  so it loads for everyone
- in a **URL**, as a `session=spec-…` or a track's `displaySnapshot`, so you can
  hand one view to one person (see
  [from config to a URL](#from-config-to-a-url))
- in an **embedded component**, passed to `createViewState`, so it renders
  inside your own web page
- in the **running app**, where the track menu writes those same slots back out
  when you change a color or a height by hand

So a color callback or a `heightMode` you work out here is never throwaway. Copy
it into a share link, a notebook widget, or a colleague's config and it behaves
exactly the same. The recipes below are written as `config.json` because that's
the easiest form to read, but read "config" as "config, session, URL, or embed"
the whole way down. The
[same view definition works everywhere](#the-same-view-definition-works-everywhere)
section at the end shows the same idea for a whole view.

The alignment also runs the other way, which is often the easier route: tune a
track by clicking in the running app until it looks right, then read the JSON
back out. A track's **About** dialog has a **Copy config** button that gives you
that track's config with your session tweaks already folded in, and **File ▸
Export session** does the same for the whole view. Both paste straight into
`config.json` because they speak the same field names, so "poke at it in the UI,
then paste the result" is a real workflow, not a dead end.

---

## Getting data in fast (CLI)

The CLI is the quickest path to a working instance: it writes the config for
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

Every recipe on this page is reachable from `jbrowse add-track` without
hand-editing the config. `--color` and `--height` are shortcuts for the two most
common `displayDefaults` settings, so the "color by strand" recipe is just:

```bash
jbrowse add-track genes.gff3.gz --load copy --name Genes \
  --color 'jexl:feature.strand==1?"blue":"red"' --height 200
```

The trick that keeps it readable: wrap the value in single quotes and use double
quotes _inside_ the jexl, so there's nothing to escape. Anything else lands in
one of two catch-all flags: `--displayDefaults` takes inline JSON for any
display setting (the same object the recipes put under `displayDefaults`), and
`--config` takes inline JSON for the rest of the track (top-level fields like
`metadata` and `formatDetails`, or a full `displays` array).

```bash
jbrowse add-track genes.gff3.gz --load copy \
  --displayDefaults '{"mouseover":"jexl:feature.name","labels":{"description":"jexl:feature.note"}}'
```

That covers every appearance recipe. Four `add-track` flags carry all of them:

| To set                                                                                                            | Flag                         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Color or height                                                                                                   | `--color`, `--height`        |
| Any other display setting: labels, tooltips, `jexlFilters`, `colorBy`, `groupBy`, `scaleType`, `defaultRendering` | `--displayDefaults '<json>'` |
| A non-default display (arc, matrix), or a top-level field like `metadata`/`formatDetails`                         | `--config '<json>'`          |
| Track-selector folders                                                                                            | `--category "RNA-seq,Brain"` |

A few settings aren't per-track. Alias chromosome names when you add the
assembly:

```bash
jbrowse add-assembly genome.fa.gz --load copy --refNameAliases aliases.txt
```

And open JBrowse to a curated view by writing the `defaultSession` from a file,
which takes the same shape as the
[TL;DR config's](#tldr-a-complete-config-on-one-screen) `defaultSession` (the
`init` shorthand works here too):

```bash
echo '{"views":[{"type":"LinearGenomeView","init":{"assembly":"volvox","loc":"ctgA:1-50000","tracks":["genes","coverage"]}}]}' > session.json
jbrowse set-default-session --session session.json
```

The [multi-signal wiggle](#multiple-signals-on-one-track-each-its-own-color) is
the one recipe that bundles several files into one track, so it has its own flag
in place of the positional track argument. `--multiwig` takes a comma-separated
list of BigWigs, or a `.json` sources file whose entries carry a per-row
`name`/`color`, and builds the `MultiWiggleAdapter` for you:

```bash
jbrowse add-track --multiwig s1.bw,s2.bw,s3.bw --load copy --name "Coverage"
```

See the [CLI reference](/docs/cli) for every flag.

### Rendering a recipe as a static image

To turn a recipe into a PNG or SVG without building a browsable instance, reach
for [`@jbrowse/img`](/docs/jbrowse-img) (the `jb2export` command). It renders
straight from your files and takes the same settings inline as per-track tokens
(`color:`, `height:`, `sort:base`, `display:multivariant`), and has its own
`--multiwig` flag too. Use it for a figure; use `jbrowse add-track` when you
want a config someone can open and explore.

---

## Assemblies

### Reference sequence adapters

Pick the adapter that matches your file. All three do the same job:

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
up. Point at a two-column file (chromAliases) with the `uri` shorthand:

```json
{
  "name": "volvox",
  "uri": "volvox.2bit",
  "refNameAliases": { "uri": "volvox.chromAliases.txt" }
}
```

or list them inline with a `FromConfigAdapter`:

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

**The one thing to know:** a track's color is the `color` setting in
`displayDefaults`, either a plain CSS color or a `jexl:` expression JBrowse runs
per feature, returning that feature's color.

### What you can color by

A `jexl:` color expression sees the feature as `feature`, with any attribute
readable as a plain property. Most-used:

| Read this               | What it is                                       |
| ----------------------- | ------------------------------------------------ |
| `feature.type`          | GFF3/BED type: `gene`, `mRNA`, `CDS`, `exon`, …  |
| `feature.strand`        | `1` (+), `-1` (−), or `0` (none)                 |
| `feature.score`         | numeric score (BED/GFF3 score column, wig value) |
| `feature.name`          | display name                                     |
| `feature.start`         | start coordinate (0-based half-open)             |
| `feature.end`           | end coordinate                                   |
| `feature.refName`       | chromosome / contig name                         |
| `feature.INFO.SVTYPE`   | any VCF `INFO` field (variants)                  |
| `getTag(feature, 'HP')` | any BAM/CRAM tag: `HP`, `RG`, `MD`, …            |
| `feature.parent`        | parent feature (e.g. the gene of an mRNA)        |
| `feature.itemRgb`       | BED12/bigBed named columns (see caveat below)    |

The full property and function list is in
[using jexl callbacks](/docs/config_guides/jexl).

### A complete example: color by strand {#color-by-strand}

Every recipe below is the same track with a different `displayDefaults.color`
(or, for alignments/variants, `colorBy`). Here's the full track for **color by
strand**; the table after it shows just the line to swap for everything else:

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

### More ways to set `color`

Drop any of these into the same `displayDefaults` in place of the line above.
The first six are `FeatureTrack` recipes; the last two are for `AlignmentsTrack`
and `VariantTrack`, whose color slot works the same way.

| Recipe                            | `displayDefaults`                                                                             | Notes                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Solid color                       | `{ "color": "#6a3d9a" }`                                                                      | any CSS color: hex, `rgb()`/`hsl()`, or a name   |
| By feature type (lookup table)    | `{ "color": "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] \|\| 'gray'" }` | `\|\| 'gray'` catches anything not listed        |
| By a numeric threshold            | `{ "color": "jexl:feature.score > 7.3 ? 'red' : '#0068d1'" }`                                 | a hard cutoff, not a gradient                    |
| Continuous gradient from a number | ``{ "color": "jexl:`hsl(${feature.score*3},50%,50%)`" }``                                     | maps `feature.score` onto an HSL hue             |
| Auto color per category           | `{ "color": "jexl:randomColor(feature.type)" }`                                               | same string always gets the same color           |
| BED file's own colors (`itemRgb`) | `{ "color": "jexl:feature.itemRgb \|\| 'gray'" }`                                             | only guaranteed for BED12/bigBed (see note)      |
| BAM/CRAM tag (`AlignmentsTrack`)  | `{ "colorBy": { "type": "tag", "tag": "HP" } }`                                               | built-in, reads the tag and picks colors         |
| SNPs vs indels (`VariantTrack`)   | `{ "color": "jexl:feature.type=='SNV'?'green':'purple'" }`                                    | branch on `feature.type` or any VCF `INFO` field |

A few of these need more than the one line above:

- **BED `itemRgb`** is only guaranteed for **BED12**, **bigBed**, or a track
  given an `autoSql`/`columnNames`. On a plaintext BED with fewer columns the
  extra columns surface generically as `field6`, `field7`, and so on. See the
  BED column-names note in
  [customizing feature colors](/docs/config_guides/customizing_feature_colors).
- **Auto color per category**: `randomColor`, `alpha`, `hsl`, `colorString`, and
  `interpolate` are the built-in [color helpers](/docs/config_guides/jexl) in
  the jexl catalog, e.g. `alpha('#1f77b4', 0.4)` for a semi-transparent fill
  where features overlap.
- **BAM/CRAM tag**: other `colorBy` schemes (`mappingQuality`, `strand`,
  `pairOrientation`, `insertSize`, `modifications`) are in
  [alignments tracks](#alignments-tracks). To color by a tag on a `FeatureTrack`
  instead, read it in jexl with `getTag`, which smooths over BAM/CRAM tag
  differences: `"color": "jexl:getTag(feature, 'HP')==1?'crimson':'steelblue'"`.
- If the callback outgrows a one-liner (**plugin function**), move it into a
  small plugin that registers a jexl function (e.g. `colorFeature`) and call it
  by name: `{ "color": "jexl:colorFeature(feature)" }`. This needs a companion
  `plugins` array registering `colorFeature`; see
  [customizing feature colors](/docs/config_guides/customizing_feature_colors)
  for the full plugin file.

The lookup table scales past `feature.type`: key it on any field the track
exposes. UCSC RepeatMasker carries a `repClass` column, so one table colors
every repeat by its class:

```json
{
  "color": "jexl:{SINE:'#e41a1c',LINE:'#377eb8',LTR:'#4daf4a',DNA:'#984ea3',Simple_repeat:'#ff7f00',Low_complexity:'#a65628'}[get(feature,'repClass')] || 'gray'"
}
```

`get(feature, 'repClass')` reads a BED column the same way `feature.type` reads
a GFF type, and `|| 'gray'` catches the classes not in the table.

<Figure caption="The lookup-table recipe on a track with real categorical variety: UCSC RepeatMasker over a 17q21 window, each element colored by its repeat class with the table above — SINE red, LINE blue, LTR green, DNA purple, simple repeats orange, low complexity brown, anything else gray." src="/img/cookbook_color_by_type.png"/>

### Debugging a color callback

Two things catch most mistakes:

- Wrap the expression in `log(...)` to print the value it returns for each
  feature to the browser console: `"color": "jexl:log(feature.type)"` (or
  `log(...)` around the whole expression, which prints and passes the value
  through). See the `log` function in the
  [jexl catalog](/docs/config_guides/jexl).
- If a `displayDefaults` key routes to no display, JBrowse ignores it with a
  console warning, so a mistyped `colour` or `colorBy` surfaces there rather
  than failing silently.

---

## Labels, tooltips & details

These all build on the [canonical track above](#color-by-strand): same
`assemblyNames`/`adapter`, only `displayDefaults` (or `formatDetails`) changes.

### Labels

Labels route through `displayDefaults` exactly like `color`:

- Fallback name (first non-empty wins):
  `"labels": { "name": "jexl:feature.name || feature.id" }`
- Composite label:
  `"labels": { "name": "jexl:feature.name+' ['+feature.type+']'" }`
- Description shown under the name:

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

### Tooltips (mouseover)

`mouseover` is a per-feature callback whose returned string shows on hover, same
as color and labels:

```json
"displayDefaults": {
  "mouseover": "jexl:`${feature.name} [${feature.type}] ${feature.start}-${feature.end}`"
}
```

Reach subfeature attributes through `feature.parent` (e.g.
`feature.parent.name`). Tooltips render the returned string as HTML, so you can
include `<b>`, `<br/>`, and links.

### Customizing the feature details panel {#customizing-the-feature-details-panel}

Clicking a feature opens a details panel shaped by the track's `formatDetails`
slot, which sits at the top level of the track, not in `displayDefaults`. Its
`feature` callback returns an object that gets merged into what's shown: name a
field to rewrite it (say, turn `name` into a link), add a new field to slip in
an extra row, or set one to `undefined` to hide it.

```json
"formatDetails": {
  "feature": "jexl:{name:'<a href=https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name+'>'+feature.name+'</a>', type:undefined}"
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
adapter (`Gff3Adapter`, `BedAdapter`, or `VcfAdapter`), which reads the whole
file into memory:

```json
{ "type": "Gff3Adapter", "uri": "volvox.sort.gff3" }
```

Or skip files entirely and embed a handful of features straight in the config
with `FromConfigAdapter`, handy for demos, tests, or annotations you maintain by
hand. See [inline data](#inline-data-no-files) below.

### Set the drawing height

```json
"displayDefaults": { "height": 200 }
```

### Fit, grow, or fix the track height

`height` sets the box the track lives in. `heightMode` decides what happens when
there are more features than fit that box:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "height": 200, "heightMode": "fit" }
}
```

- `fixed` (the default) keeps the height you set and scrolls the overflow
- `grow` expands the track downward until every feature shows, no scrollbar
- `fit` shrinks the features themselves so the whole stack fits the current
  height

`fit` is the one people go looking for: it's how you get a full pileup or a
dense annotation into a screenshot without a scrollbar cutting it off. The same
slot lives on alignments tracks too (it's the "Track sizing" menu on any track).

### Pack features onto fewer rows

`displayMode` controls how much vertical room each feature gets, independent of
the track height above. `collapsed` drops everything onto a single row with
labels off, which is handy for a repeat or mappability track you just want as a
thin stripe:

```json
{
  "type": "FeatureTrack",
  "trackId": "repeats",
  "name": "Repeats",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BedTabixAdapter", "uri": "volvox-bed12.bed.gz" },
  "displayDefaults": { "displayMode": "collapsed" }
}
```

`normal` is the default, and `compact` or `superCompact` sit in between,
shrinking the rows without fully flattening them.

### Draw features as arcs, with a jexl-computed height

Useful for interactions, breakpoints, or paired features. The arc display isn't
a `FeatureTrack`'s default, so select it with a `displays` array. Its appearance
slots (`color`, `arcHeight`, `thickness`, `label`) sit directly on the display,
each accepting a `jexl:` expression:

```json
"displays": [
  {
    "type": "LinearArcDisplay",
    "displayId": "arcs-LinearArcDisplay",
    "arcHeight": "jexl:log10(feature.end-feature.start)*20"
  }
]
```

See the [`LinearArcDisplay` config](/docs/config/lineararcdisplay) for every arc
slot.

### Showing only some features (filtering) {#showing-only-some-features-filtering}

`jexlFilters` shows only features that pass every expression listed. One gotcha:
unlike `color`, filter expressions **leave off the `jexl:` prefix** (they use a
deferred-evaluation convention).

```json
"displayDefaults": {
  "jexlFilters": [
    "feature.end - feature.start > 1000",
    "feature.type == 'gene'"
  ]
}
```

The same `jexlFilters` works on variant and alignments tracks. To hide reads by
their SAM flags instead, reach for the alignments `filterBy` slot (see
[alignments tracks](/docs/config_guides/alignments_track)).

### Inline data (no files)

`FromConfigAdapter` embeds features directly in the config:

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

`showSoftClipping` and `groupBy` are both display settings on the same track
above. This draws soft-clipped bases and stacks reads into haplotype groups by
their `HP` tag:

```json
"displayDefaults": {
  "showSoftClipping": true,
  "groupBy": { "type": "tag", "tag": "HP" }
}
```

`groupBy` also takes `{ "type": "strand" }` to split the pileup by strand.

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

See the [`LinearWiggleDisplay` config](/docs/config/linearwiggledisplay) for
`scaleType`, `minScore`/`maxScore`, and the other scale slots, and the
[quantitative track guide](/docs/config_guides/quantitative_track) for concepts.

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

`multiline` overlays every signal as a line in one plot. The
[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
slot also accepts `multirowxy` (one stacked row per signal), `multirowdensity`,
and `multixyplot` (all signals overlaid in one plot).

From the CLI, `add-track --multiwig` builds this track. Pass the per-row
`name`/`color` subadapters above as a `.json` sources file, or a bare
comma-separated list for quick unnamed signals:

```bash
jbrowse add-track --multiwig v1.cram.bw,v2.cram.bw,v3.cram.bw --load copy --name Grains
```

<Figure caption="A three-sample MultiQuantitativeTrack over the AMY1 cluster (multirowxy): each 1000 Genomes sample's copy number draws in its own color and varies across the locus." src="/img/cookbook_multiwig.png"/>

---

## Variant tracks

### Filter which variants are shown

Apply `jexl` filters so only matching features render (as in
[filtering](#showing-only-some-features-filtering), `jexlFilters` entries omit
the `jexl:` prefix while `color` keeps it):

```json
"displayDefaults": {
  "jexlFilters": ["feature.start<8000"],
  "color": "jexl:feature.start>5000?'darkgreen':'red'"
}
```

Multi-sample VCFs open in the standard variant display. To see genotypes as a
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
aligner: `PAFAdapter` for minimap2/wfmash, `DeltaAdapter` for MUMmer,
`ChainAdapter` for liftOver/lastz.

The thing everyone trips on is which assembly is which. minimap2 takes its
inputs **target first**:

```bash
minimap2 grape.fa peach.fa > out.paf   # minimap2 target.fa query.fa
```

so here the **target is grape** and the **query is peach**. Name them outright
with `queryAssembly` and `targetAssembly` on the adapter instead of tracking the
order yourself:

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

**Track loads blank?** That's almost always swapped assemblies: the alignment's
coordinates don't line up with the assemblies on screen, so nothing draws. Flip
`queryAssembly` and `targetAssembly` (or, if you used the positional
`assemblyNames: [query, target]` array instead, reverse it). minimap2's
`target query` argument order is the _reverse_ of the array's `[query, target]`,
the usual culprit.

To open a dotplot or linear synteny view pointed at this track, see the
[synteny track guide](/docs/config_guides/synteny_track) and the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

---

## The instance

Settings for the whole JBrowse instance, rather than one track.

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

### Text searching (gene name search)

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

### Theming

Set `configuration.theme.palette`. `primary` and `secondary` drive the toolbars
and highlights, and `tertiary`/`quaternary` handle accents:

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

### Loading a plugin {#loading-a-plugin}

Extra plugins (new track types, adapters, or the jexl color/detail functions
from the recipes above) load from a top-level `plugins` array. Use `esmLoc` for
a file next to your config, or `esmUrl` for one hosted elsewhere:

```json
"plugins": [
  { "name": "MyPlugin", "esmLoc": { "uri": "myplugin.js" } }
]
```

See [plugins](/docs/config_guides/plugins) for the UMD form and the published
plugin store.

### Opening to a specific view on load

`defaultSession` opens JBrowse at a region with tracks already showing, the same
slot used in the [TL;DR config](#tldr-a-complete-config-on-one-screen) above:

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

## Building many tracks from a samplesheet

`config.json` is plain JSON, so once you have more than a handful of similar
tracks (an RNA-seq timecourse, a ModENCODE-style panel, anything a pipeline
emits one file per sample for) the sane approach is to generate it with a small
script instead of hand-writing each track. A `MultiWiggleAdapter`'s
`subadapters` array is just a list, so it lines up one row per sample with the
kind of metadata table a workflow like Nextflow already produces:

```js
const samples = [
  { name: 't0', uri: 's3://foo/RNAseq/timecourse_t0.bw', color: '#1f77b4' },
  { name: 't1', uri: 's3://foo/RNAseq/timecourse_t1.bw', color: '#ff7f0e' },
  { name: 't2', uri: 's3://foo/RNAseq/timecourse_t2.bw', color: '#2ca02c' },
]

const track = {
  type: 'MultiQuantitativeTrack',
  trackId: 'rnaseq_timecourse',
  name: 'RNA-seq timecourse',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: samples.map(s => ({
      type: 'BigWigAdapter',
      name: s.name,
      uri: s.uri,
      color: s.color,
    })),
  },
}
```

Push `track` onto your config's `tracks` array (or loop the whole thing to build
a hundred of them) and write the result out. None of this is JBrowse-specific
tooling: read the samplesheet with whatever your pipeline already uses, a
Nextflow channel, a pandas frame, `jq`, and emit JSON at the end. For a quick
one-off from the shell instead, `jbrowse add-track --multiwig` takes the same
rows as a `.json` sources file, see the
[multi-signal recipe](#multiple-signals-on-one-track-each-its-own-color).

---

## From config to a URL

Say a colleague asks "can you show me that gene on the coverage track?" Rather
than a screenshot or a list of click-here-then-here steps, send a link that
opens JBrowse already pointed at the right place, with the right tracks turned
on.

That's what URL parameters are for. A link doesn't set up anything new. It just
refers to things your `config.json` already defines, by name. Here's a
stripped-down config:

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

- `?config=config.json` - which config file to load.
- `&assembly=volvox` - the `name` of an entry in the config's `assemblies` list.
  (This is the assembly's name, not a track, a common mix-up.)
- `&loc=ctgA:1-50000` - where to navigate. A region like this, or a gene name if
  you've run `jbrowse text-index`.
- `&tracks=genes,coverage` - a comma-separated list of `trackId`s to turn on,
  taken straight from the `tracks` array.

Building a link is mostly reading `trackId`s and the assembly `name` out of your
config and stringing them together. Nothing in the URL exists that isn't already
in the config.

One thing to know: a link like this starts a **fresh** view and ignores any
`defaultSession` you configured. To jump to a different region within a curated
default session instead, add `&extendSession=true`. JBrowse keeps the session's
tracks and settings and only changes the location (and you can drop
`&assembly=`, since it comes from the session).

### Setting a track's color (or height) in the link

Everything above turns tracks _on_. To control how a track _looks_ from the link
too, list it as an object with a `displaySnapshot` (the same settings you'd put
in `displayDefaults`) instead of a plain `"genes"`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-50000","tracks":[{"trackId":"genes","displaySnapshot":{"color":"green"}}]}]}
```

This opens the genes track colored green without changing the config. Anything
you'd write in `displayDefaults` (color, height, display type, score range)
works here too.

### Adding a whole track that isn't in the config

Add a track the config has never heard of with `&sessionTracks=`, which takes
the same track config objects as the config's `tracks` array. For example, drop
in a few features inline with a [`FromConfigAdapter`](#inline-data-no-files)
(handy for sharing a BLAST hit or a region of interest) straight from the URL
bar:

```
&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"1","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

For the full list of parameters, plus multi-view layouts, dotplots, synteny, and
the shareable encoded links the "Share" button produces, see the
[URL query parameter API](/docs/urlparams).

### The same view definition works everywhere

Once you've described a view (an assembly, a location, some tracks, maybe a few
display settings), you can reuse it in three places without rewriting it:

- in the config, as `defaultSession.views[].init`, so it loads for everyone
- in a URL, as a session spec, so you can hand it to one person
- in an embedded component, passed to `createViewState`, so it renders inside
  your own web page

They all accept the same shape, so a view you work out in one place drops into
the others. [Automating JBrowse](/docs/automating) covers this shared launch
model, and [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) shows
the embedded version.

---

## Where to go next

- [Config guide](/docs/config_guide) - structure of `config.json` and links to
  every per-track guide
- [Using jexl callbacks](/docs/config_guides/jexl) - full catalog of callback
  functions
- [Supported file types](/docs/config_guides/file_types) - every format and its
  adapter
- [URL query parameter API](/docs/urlparams) - supplying assemblies, tracks, and
  views from a URL
- [Automating JBrowse](/docs/automating) - the shared `init` launch model across
  config, URL, and embedded components
- [Static image export (`@jbrowse/img`)](/docs/jbrowse-img) - render these
  recipes to PNG/SVG from the command line, no config required
- [Config reference](/docs/config/basetrack) - the complete, auto-generated slot
  list for every track, display, and adapter
