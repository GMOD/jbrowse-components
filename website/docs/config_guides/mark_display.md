---
title: Mark display
description:
  A grammar of graphics over a feature, alignments, variant or quantitative
  track, where LinearMarkDisplay draws the bars, points and spans its config
  declares
guide_category: Track types
---

`LinearMarkDisplay` is a grammar of graphics over a track, in the sense of
Vega-Lite or ggplot: a picture is declared as marks, encodings and transforms
rather than drawn by code. It goes on a `FeatureTrack`, an `AlignmentsTrack`, a
`VariantTrack`, a `QuantitativeTrack` or a `MultiQuantitativeTrack` and draws
whatever its `marks` list declares — a `bar`, `point` or `span` per entry, each
with an `encoding` naming which feature fields feed it, a `transform` list that
can bin, count, pack or measure coverage before it, and a zoom range it draws
in. A BED score column becomes a bar chart with one display entry and no code,
the same file's density at wide zoom is a second entry, and a `pileup` step over
a BAM packs the reads into rows.

## When to reach for it

- **A value per feature.** A BED score, a segment's log ratio, a peak's signal
  and q-value: a `FeatureTrack` draws glyphs and a `QuantitativeTrack` reads a
  BigWig, and this display plots the field on a y-axis with a second as colour.
- **A read's or a variant's fields.** On an `AlignmentsTrack` a read's `score`
  is its MAPQ; on a `VariantTrack` the quality is `QUAL`. The format-typed
  displays still own what is not a field, such as mismatches and genotypes.

## A worked example

Bars from a BED score column, coloured by strand, with the colour key on screen:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "scores",
  "name": "Scores",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/scores.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "scores-LinearMarkDisplay",
      "marks": [
        {
          "shape": "bar",
          "encoding": {
            "y": "score",
            "color": { "field": "strand", "scale": "categorical" }
          }
        }
      ]
    }
  ]
}
```

Listing the display first under `displays` makes it the one the track opens
with. Every other slot has a default: `x` is `start`, `x2` is `end`, bars grow
from an `origin` of 0, and the y-axis autoscales to the values on screen.

## The encoding

Each mark's `encoding` maps feature fields to the channels its shape reads:

| Channel | Read by        | Value                                                                                                                                       |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`     | every shape    | a field holding the left edge in bp; `start` by default                                                                                     |
| `x2`    | every shape    | the right edge; `end` by default                                                                                                            |
| `y`     | `bar`, `point` | the field plotted on the score axis, read through the display's `scales.y` (below); a feature whose value is not a finite number is skipped |
| `row`   | `span`         | an integer field naming the band a span stacks on, from 0; missing is 0, and left empty it follows this mark's own `pileup` step            |
| `color` | every shape    | a CSS colour, a jexl callback returning one, or a scale (below)                                                                             |
| `glyph` | `point`        | `disc`, `triangle` or `diamond`, a jexl callback returning one, or a categorical scale (below)                                              |

A field name is read straight off the feature (`score`, `strand`, or any column
a BED `columnNames` or a GFF attribute names). A `jexl:` expression over
`feature` is accepted wherever a field name is, for a derived channel:

```json
{ "y": "jexl:-log10(feature.pvalue)" }
```

A jexl `y` is evaluated once per feature and costs about half again as much as a
field read, so reach for it where no field holds the value you want to plot.

## The value scale

A mark's `y` names a field; the scale it is read through belongs to the display,
which declares it once as `scales.y`:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "scales": { "y": { "type": "log", "domainMin": 1, "domainMax": 1000 } },
    "marks": [{ "shape": "bar", "encoding": { "y": "score" } }]
  }
]
```

`type` is `linear` (the default) or `log`, the two the display places, and the
track menu's scale-type radio offers exactly those two. `domainMin` and
`domainMax` pin the ends the axis spans; an end left unset autoscales to the
loaded regions, so `{ "domainMin": 0 }` pins the floor alone, and `autoscale`
chooses how an unpinned end is taken. The axis, its ticks, its cross-hatches and
the bars themselves read this one declaration, and so does the track menu: **Set
min/max score...** writes back into it, so what the user pins and what the
config author wrote are the same slot.

Every mark drawing at the current zoom folds into that one domain, the way a
grammar of graphics gives one scale per aesthetic. With a multiscale pair
(below) only one mark draws, so the axis is that mark's values.

### Reference lines and the axis title

`scales.y` also holds the two guides a reader checks a plot against: `rules`,
horizontal lines at chosen values, and `title`, the caption beside the axis.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "association",
  "name": "Association",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/association.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "association-LinearMarkDisplay",
      "scales": {
        "y": {
          "title": "-log10 p",
          "rules": [{ "value": 7.3, "color": "red", "label": "p = 5e-8" }, 5]
        }
      },
      "marks": [{ "shape": "point", "encoding": { "y": "score" } }]
    }
  ]
}
```

Each entry of `rules` is `{ value, color, label }`, and a bare number is a grey
unlabelled rule at that value: a significance threshold over a scatter of
p-values, a zero line under a log ratio, an allele-frequency cut. An autoscaled
end of the axis widens to keep every rule on it, so a threshold stays drawn over
a window where no point clears it, while a pinned `domainMin` or `domainMax`
that excludes a rule drops the rule. A rule belongs to the scale, so it draws in
every band of a faceted plot and at every zoom: on a multiscale pair whose two
marks plot different quantities, a rule written for one draws over the other
too.

`title` names what the axis measures, and is optional: unset, the axis has no
caption, and some text is that text at every zoom. A plot banded by a `facet` or
a `row` field carries the one caption beside its bands.

## Two quantities

A coverage run in the hundreds and a per-read mapping quality in the tens cannot
be read off one axis, and the display draws only one. Write them as two tracks,
each with its own display and its own `scales.y`, so each axis carries the field
it measures and the reader can stack them in whatever order the comparison
wants.

Where the two quantities answer the same question at different zooms, one track
still does it: give each mark a zoom range and they never draw together.

```json
"marks": [
  {
    "shape": "bar",
    "transform": [{ "type": "coverage" }],
    "encoding": { "y": "coverage", "color": "#c8d8ee" },
    "minBpPerPx": 20
  },
  { "shape": "point", "encoding": { "y": "score" }, "maxBpPerPx": 20 }
]
```

The coverage draws zoomed out and the per-read value zoomed in, and the axis at
each zoom is the drawing mark's. A right-hand second axis was withdrawn in
v5.0.0: the reader of that picture cannot tell which bars belong to which
numbers.

## Colour scales

`color` as a string paints every feature that colour (or whatever the jexl
callback answers). As an object it binds a field to a scale, and the legend
describes that binding:

- **categorical** —
  `{ "field": "strand", "scale": "categorical", "range": ["#1f77b4", "#ff7f0e"] }`
  hands each distinct value a colour, derived from the value itself so every
  region paints it the same way. `range` lists the CSS colours to draw from, and
  left off is the default palette. An optional `domain` lists the values in
  legend order and walks `range` from the first entry, continuing into the
  default palette past its end, for when the colours should be spent
  deliberately. A value it leaves out keeps a colour derived from itself that no
  listed value paints, and follows the listed ones in the legend sorted, the
  order a facet stacks its sections in. The legend lists the values drawn; a
  listed value the data lacks takes no row.
- **linear** or **log** —
  `{ "field": "signal", "scale": "linear", "domainMin": 0, "domainMax": 50, "range": ["white", "red"] }`
  reads the value between `domainMin` and `domainMax` into a ramp through the
  colours `range` lists, spaced evenly. `scheme` names a ramp instead
  (`"viridis"`, which is also what a ramp with no `range` draws), and
  `reverse: true` turns either one round. An end left off spans the values of
  every region loaded, so a bar and its key mean the same thing in every block
  on screen and that end moves as you pan into bigger values: pin both when a
  figure needs the colours to stay put, or one to hold a floor or a ceiling, as
  `{ "field": "signal", "scale": "linear", "domainMin": 0, "range": ["white", "red"] }`
  does. `domainMid` names the value the ramp's middle stop sits at, so a
  diverging ramp centres on zero inside an asymmetric domain, and
  `{ "field": "score", "scale": "log", "scheme": "viridis", "reverse": true }`
  runs viridis from yellow at the bottom to purple at the top.
- **threshold** —
  `{ "field": "signal", "scale": "threshold", "domain": [10, 50], "range": ["#eee", "#f90", "#c00"] }`
  cuts the value at each `domain` point and hands each interval a `range`
  colour, so `range` carries one more than `domain` does. The legend lists one
  row per interval.

Whichever way a scale resolves, the legend reads the same table the colours came
from.

A colour scale's key takes its heading from `title`, which has the three states
the axis `title` has. Left unset, the key reads the `field` name; some text is
that text; `"title": ""` draws the key with no heading. On an alignments track,
`{ "field": "score", "scale": "linear", "title": "Mapping quality" }` heads the
ramp with what a read's `score` measures. Marks sharing a scale share one key
only under one title, so a second mark titling the same scale differently draws
a key of its own.

## Glyph scales

A scale belongs to a channel, not only to colour. `glyph` takes the same
categorical form — `{ "field": "svtype", "scale": "categorical" }` — with
`range` listing the glyph names to hand out as a colour scale's lists colours
(`disc`, `triangle`, `diamond` in that order when left off) and `domain` the
values in legend order. The legend then carries a second key whose swatches are
the glyphs themselves:

```json
{
  "shape": "point",
  "encoding": {
    "y": "score",
    "color": { "field": "strand", "scale": "categorical" },
    "glyph": {
      "field": "svtype",
      "scale": "categorical",
      "domain": ["INS", "DEL"],
      "range": ["triangle", "diamond"]
    }
  }
}
```

A scale is a lookup from the field's value into `domain` and `range`, so it
costs a fraction of the per-feature jexl callback it replaces.

## Several marks

`marks` draws in order, a later entry over an earlier one, all over one score
axis and one fetch per region. Points over bars from the same file, with the
points' colour a callback:

```json
"marks": [
  { "shape": "bar", "encoding": { "y": "score" } },
  {
    "shape": "point",
    "encoding": {
      "y": "score",
      "color": "jexl:feature.name=='EDEN.1' ? 'red' : 'blue'"
    }
  }
]
```

A `span` has no `y`: it paints a band from `x` to `x2`, in its colour, for an
interval whose extent is the point, such as a region of interest under the bars
coloured by a class field. With no `row` every span shares one band across the
whole plot; with one —
`{ "shape": "span", "encoding": { "row": "sampleIndex" } }` — the plot divides
into as many bands as the highest row on screen needs, and each span sits on the
band its field names.

## Facets

The display's `facet` gives each value of a field its own band of rows, named by
a chip a reader can hide the section from. The facet splits the features first,
and every mark then runs its own steps over each section alone, so a `pileup`
packs each section on its own rows and a `coverage` counts each section's depth:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "facet": "sample",
    "marks": [
      {
        "shape": "span",
        "transform": [{ "type": "pileup" }],
        "encoding": { "row": "row" }
      }
    ]
  }
]
```

The field is read the way a channel reads one: a name, a dotted path into a
structured field (`INFO.SVTYPE`), or a `jexl:` expression. Where the value has
to be computed first, the display's own `transform` runs before the facet splits
the features:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "transform": [
      { "type": "formula", "expr": "jexl:getTag(feature,'HP')", "as": "HP" }
    ],
    "facet": { "field": "HP", "domain": ["2", "1"] },
    "marks": [
      {
        "shape": "span",
        "transform": [{ "type": "pileup" }],
        "encoding": {
          "row": "row",
          "color": { "field": "HP", "scale": "categorical", "title": "Haplotype" }
        }
      }
    ]
  }
]
```

Sections order a name with a number in it by that number, so chr2 before chr10,
and the rest by code point. The facet's `domain` is the section order: the
values listed stack first, in that order, and the rest follow sorted. Past forty
sections the tail merges into one, chosen by that natural order, so a domain
orders the sections and never changes which exist.

**Sections** in the track menu lists the sections drawn, each with **Move up**,
**Move down** and **Hide section**; a move writes the drawn order back as the
facet's `domain`, and **Reset section order** clears it. A hidden section leaves
the legend and the value axis along with the plot.

<Figure src="/img/mark_display/facet.png" caption="HG002 ONT reads faceted by their HP tag: each haplotype's reads packed into a separate band under the chip that names it, and the untagged reads in a third."/>

## Transforms

A mark's `transform` is a list of steps over the region's features, run in the
worker before the encoding, in order, each reading what the last answered. The
display's own `transform` takes the same steps and runs before every mark's.
Each step names its `type` and takes that step's own settings, which the
[MarkTransform config reference](/docs/config/marktransform) lists; a key
belonging to another step is refused where the config is read:

| Step        | What it does                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`    | keeps the features a jexl `expr` admits                                                                                                                                                                                                         |
| `formula`   | writes a jexl `expr`'s value into the field `as`                                                                                                                                                                                                |
| `bin`       | snaps each feature to the `step`-bp bin its `field` (`start`) falls in, writing the bin's edges to the two fields `as` names (`start`, `end`)                                                                                                   |
| `aggregate` | folds each group of features sharing the `groupby` fields into one, with each of `ops` — `count`, or `sum`/`mean`/`min`/`max` of a `field` — as a new field; an empty `groupby` takes the edges a preceding `bin` in the same `transform` wrote |
| `coverage`  | replaces the features with runs of how many overlap each stretch, in the field `as` (`coverage`)                                                                                                                                                |
| `flatten`   | fans each feature out into one per element of an array `field` (`subfeatures`), each reading its parent for what it lacks, with its position in the field `index` names; `keepEmpty` holds on to a feature whose array is empty                 |
| `pileup`    | writes each feature's row in a greedy first-fit packing into `as` (`row`), reading the interval `fields` (`start`, `end`) and keeping `padding` bp between two features on one row                                                              |

A field a step reads is a name or a dotted path into a structured field, so a
VCF's `INFO.DP` is the `field` of a `mean` and `INFO.SVTYPE` a `groupby`; a
field holding a one-element list groups by its element. A computed value is a
`formula` step's to write, for the steps after it to read by name.

A `bin` followed by an `aggregate` is a density: one bar per bin, its height the
count of features whose start fell in it. The `aggregate` groups by the edges
the `bin` wrote unless it names `groupby` fields of its own, so the grouping is
written once. That needs the `bin` in the same `transform`: a mark's `aggregate`
behind a `bin` in the display's `transform` names the edges, `["start", "end"]`
by default.

```json
{
  "shape": "bar",
  "transform": [
    { "type": "bin", "step": 10000 },
    {
      "type": "aggregate",
      "groupby": ["start", "end"],
      "ops": [{ "op": "count" }, { "op": "mean", "field": "score" }]
    }
  ],
  "encoding": { "y": "count" }
}
```

The aggregate's fields are `count` and `mean_score` here, and either can feed
`y` or a colour scale. `coverage` answers the other question — how many features
overlap each position — for a repeat annotation, a set of peaks or any interval
file with no summary track beside it:

```json
{
  "shape": "bar",
  "transform": [{ "type": "coverage" }],
  "encoding": { "y": "coverage" }
}
```

`pileup` is the packing a read pileup is, said as a step. It writes the lowest
row on which each feature overlaps nothing already there, and a `span` reading
that row draws the packing:

```json
{
  "shape": "span",
  "transform": [{ "type": "pileup", "padding": 10 }],
  "encoding": {
    "row": "row",
    "color": { "field": "strand", "scale": "categorical" }
  }
}
```

Over an `AlignmentsTrack` that is a declared pileup, coloured by any field a
read answers; the display's `facet` packs each section on rows of its own. A
mark whose `encoding.row` is empty reads the field its own `pileup` wrote, so
`"encoding": {}` draws the packing. The plot divides into as many bands as the
highest row needs, so the rows thin as the depth on screen grows and the track
keeps its height.

The display's `jexlFilters` run before every mark's own steps.

## A picture per zoom level

Each mark can name the zoom range it draws in, in bp per pixel: `minBpPerPx`
draws it only at or above that width, `maxBpPerPx` only below it, and 0 sets no
bound. A density on one mark and the features on another make one track that
shows the count per bin zoomed out and each feature's own value zoomed in, from
one fetch per region:

```json
"marks": [
  {
    "shape": "bar",
    "encoding": { "y": "milliDiv" },
    "maxBpPerPx": 100
  },
  {
    "shape": "bar",
    "transform": [
      { "type": "bin", "step": 10000 },
      { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
    ],
    "encoding": { "y": "count" },
    "minBpPerPx": 100
  }
]
```

<Figure src="/img/mark_display/multiscale.png" caption="One Alu track, twice: across 3 Mb the binned mark draws and the axis is elements per 10 kb; across 30 kb the raw mark draws and the axis is each element's divergence from its consensus."/>

A mark outside its range is off entirely — it is not drawn, not hovered, and its
values do not set the y-axis, the legend or the row count — so the axis at each
zoom is the drawing mark's, captioned with that mark's `y` field.

### A bin that follows the zoom

`"step": "auto"` on a `bin` picks the width from the view instead: the bin
targets four pixels of screen and snaps up to the next 1, 2 or 5 — 200 bp, 500
bp, 1 kb — so the bars stay the same width however far you zoom out, and one
mark replaces the three a config otherwise writes for three resolutions. The
width is resolved before the fetch and is part of what the fetch is keyed on, so
zooming within a rung re-uses what is loaded and crossing one re-reads at the
new width, the way a BigWig picks a summary level.

```json
"transform": [
  { "type": "bin", "step": "auto" },
  { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
]
```

### Past the fetch budget

A bin can only summarize what the fetch admits, and a wide enough view is over
the byte budget — the point where a track normally shows "region too large".
Give the adapter a density sidecar (a features-per-bin BigWig, which
`jbrowse make-density` writes) and mark one layer `"source": "density"`, and
that layer draws the sidecar's bins there instead of the banner:

```json
"adapter": {
  "type": "Gff3TabixAdapter",
  "gffGzLocation": { "uri": "genes.gff.gz" },
  "index": { "location": { "uri": "genes.gff.gz.tbi" } },
  "densityAdapter": {
    "type": "BigWigAdapter",
    "bigWigLocation": { "uri": "genes.density.bw" }
  }
},
"displays": [
  {
    "type": "LinearMarkDisplay",
    "displayId": "genes-LinearMarkDisplay",
    "marks": [
      { "shape": "bar", "encoding": { "y": "score" }, "maxBpPerPx": 100 },
      { "shape": "bar", "source": "density", "encoding": { "y": "count" }, "minBpPerPx": 100 }
    ]
  }
]
```

The sidecar's bars are drawn as bars like any other — same y axis, same hover,
same SVG export — and hovering one reads out the bin's count. Marks that are not
the density draw nothing there, and a chip in the corner marks the sidecar as
the source; the track menu's **Density band** submenu switches between
Automatic, Features only and Density only, and carries the Force-load the banner
would have. Clicking a bin opens nothing, because reading the features back is
the download the budget refused. With no mark declaring `"source": "density"`,
the banner still appears, unchanged.

<Figure src="/img/mark_display/density_sidecar.png" caption="Chromosome 1 end to end, past the budget: the Alu track's sidecar bins draw as the density mark, with the chip in the corner naming what is on screen."/>

## When a config cannot draw as written

A `marks` list loads whenever its keys and value types are right, and the
display draws what it can. Where two slots disagree, the track shows a warning
chip in its corner naming the slot, and the mark when the slot is a mark's:

- a `bar` or `point` naming no `y`, which draws nothing;
- a channel the shape does not read, such as `y` on a `span`;
- a `y` naming a field the mark's own `aggregate` or `coverage` step does not
  write, with the fields those steps leave;
- a `bar` or `point` drawn together with a stacked `span`, which stands in the
  first of the span's rows;
- two marks each running their own `pileup`, which share row numbers, where one
  `pileup` in the display's `transform` packs them together: without a `facet`
  each mark's `encoding.row` names the field the pileup writes, and under one
  the pileup packs across every section at once;
- a zoom range whose `minBpPerPx` is not below its `maxBpPerPx`, which never
  draws.

`jbrowse validate` reports the same list over a config file, which has none of
the half-written states an editor passes through: a mark that draws nothing,
never draws, or names a step that cannot run is an error, and a slot left unread
— a channel the shape ignores, a `source` a second mark already stands in for —
is a warning. The display's own `transform` steps are checked the way a mark's
are. Each finding names the slot, and the mark when the slot is a mark's, and
`--json` carries the rule's id beside it.

## What the track menu offers

**Plot field...** writes the `marks` above without leaving the app: pick a
numeric field the loaded features carry, a bar or a point, optionally a colour
field — a categorical scale for a text column, a linear one for a number — and a
"count per bin zoomed out" box that adds the second `bin`/`aggregate` mark with
`step: "auto"` and the `minBpPerPx`/`maxBpPerPx` handoff at 100. It reopens on
what a single-mark config already declares, so editing is the same dialog. A
display shown with no `marks` at all plots `score` as bars where the features
carry a numeric one, and opens this dialog where they do not.

<Figure src="/img/mark_display/plot_field.png" caption="The Plot field dialog over an Alu track, reopened on the mark that track declares: the numeric fields the loaded features carry, the shape, the colour field and the count-per-bin box."/>

The score submenu writes `scales.y` and nothing else: **Set min/max score...**
pins `domainMin` and `domainMax`, **Pin current min/max** writes the domain on
screen into them, and **Clear manual min/max** clears both back to autoscaling.
Beside it are **Point size**, **Show cross hatches** (`displayCrossHatches`),
the legend toggle, and **Filter by...** for the same `jexlFilters` the basic
feature and variant displays take. A filter runs in the worker before the
encoding, so a filtered feature is neither drawn nor counted in the y-axis.
Hovering a mark shows its location, value and colour class; clicking opens the
feature's details. A click on a binned or coverage bar opens the bin or the run
itself — its span, its count or depth and the other aggregates the mark's steps
wrote — remade over the features under it.

The full slot list is the
[LinearMarkDisplay config reference](/docs/config/linearmarkdisplay); how the
encoding is evaluated, and what a `jexl:` channel measured against a field read,
is
[MARK_ENCODING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MARK_ENCODING.md).

## On the circular view

A track with a mark display draws on the
[circular view](/docs/user_guides/circular_view) as a ring: the display renders
its strip as it would in a linear track and the view wraps it around the circle,
so a `coverage` step over a BAM or a binned count over a BED is a Circos-style
density ring with the same `marks` entry. A variant track keeps its chords
unless the session names the mark display for it.

## Tutorials

- [](/docs/tutorials/alu_age) plots a BED column as bars coloured by another
  column, counts the rows per zoom-following bin and reads a density sidecar
  past the fetch budget.
- [](/docs/tutorials/read_marks) plots a BAM's own fields: depth as a coverage
  step, insert size as a point per pair on a track of its own, the reads stacked
  and coloured by a ramp, and a derived BED scanning a chromosome.

## When a plugin is the next step

A drawing that is not a bar, a point or a span needs a **shape** of its own: one
shader, one painter and one hit test, declared as a mark over the same worker
channels this display reads: [](/docs/developer_guides/creating_gpu_display)
writes one. A display that lays features out its own way, or gives a channel a
meaning the encoding cannot say — Manhattan's colour by LD to an index SNP — is
the rung after that, and [](/docs/developer_guides/plotting_features) composes
one.
