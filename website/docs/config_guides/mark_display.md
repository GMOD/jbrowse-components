---
title: Mark display
description:
  Drawing bars, points and spans from the fields of any feature track with
  LinearMarkDisplay, whose picture is an encoding declared in config
guide_category: Track types
---

**TL;DR:** `LinearMarkDisplay` goes on a `FeatureTrack` and draws whatever its
`marks` list declares — a `bar`, `point` or `span` per entry, each with an
`encoding` naming which feature fields feed it, a `transform` list that can bin,
count or measure coverage before it, and a zoom range it draws in. A BED score
column becomes a bar chart with one display entry and no code, and the same
file's density at wide zoom is a second entry.

## When to reach for it

A `FeatureTrack` normally draws its features as glyphs in rows, which says where
they are and nothing about the numbers on them. A `QuantitativeTrack` plots one
value per position from a BigWig. In between sit the files that carry a value
per feature — a BED with a real score column, a segment file with a log ratio
per interval, a peak file with a signal and a q-value — and those are what this
display plots: the value on a y-axis, the interval on x, and a second field as
colour.

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

| Channel | Read by        | Value                                                                                                                                                                 |
| ------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`     | every shape    | a field holding the left edge in bp; `start` by default                                                                                                               |
| `x2`    | every shape    | the right edge; `end` by default                                                                                                                                      |
| `y`     | `bar`, `point` | the field plotted on the score axis, or an object naming the field with the scale it is read through (below); a feature whose value is not a finite number is skipped |
| `row`   | `span`         | an integer field naming the band a span stacks on, from 0; missing is 0                                                                                               |
| `color` | every shape    | a CSS colour, a jexl callback returning one, or a scale (below)                                                                                                       |
| `glyph` | `point`        | `disc`, `triangle` or `diamond`, a jexl callback returning one, or a categorical scale (below)                                                                        |

A field name is read straight off the feature (`score`, `strand`, or any column
a BED `columnNames` or a GFF attribute names). A `jexl:` expression over
`feature` is accepted wherever a field name is, for a derived channel:

```json
{ "y": "jexl:-log10(feature.pvalue)" }
```

It costs about half again as much per feature as a field read, which is why it
is the escape rather than the default.

## The value scale

`y` as a string plots that field on an autoscaled linear axis. As an object it
says how the axis reads it, in the same shape a colour scale takes:

```json
{ "y": { "field": "score", "scale": "log", "domain": [1, 1000] } }
```

`scale` is `linear` (the default) or `log`, and `domain` pins the `[min, max]`
the axis spans instead of autoscaling to the loaded regions — an empty entry
leaves that end autoscaling, so `["0", ""]` pins the floor alone. The axis, its
ticks, its cross-hatches and the bars themselves all read this one declaration,
and so does the track menu: "Set min/max" writes back into it, so what the user
pins and what the config author wrote are the same slot.

Marks share one y-axis, so the first mark that names a `y` field is the one
whose scale the display uses. With a multiscale pair (below) that is the mark
drawing at the current zoom.

## Colour scales

`color` as a string paints every feature that colour (or whatever the jexl
callback answers). As an object it binds a field to a scale, which is what the
legend can describe:

- **categorical** — `{ "field": "strand", "scale": "categorical" }` hands a
  palette entry to each distinct value, derived from the value itself so every
  region paints it the same way. `palette` lists CSS colours to draw from;
  `domain` lists the values in legend order and walks the palette from the first
  entry, for when the colours should be spent deliberately.
- **linear** or **log** —
  `{ "field": "signal", "scale": "linear", "domain": [0, 50], "ramp": ["white", "red"] }`
  reads the value through `domain` into the ramp. `ramp` is `["viridis"]` or two
  or more CSS colour stops spaced evenly; `domain` left off spans the values of
  every region loaded, so a bar and its key mean the same thing in every block
  on screen and the ramp widens as you pan into bigger values. Pin `domain` when
  a figure needs the colours to stay put.

Whichever way a scale resolves, the legend reads the same table the colours came
from — so what the key says is what was painted.

## Glyph scales

A scale belongs to a channel, not only to colour. `glyph` takes the same
categorical form — `{ "field": "svtype", "scale": "categorical" }` — with
`range` listing the glyph names to hand out in place of `palette` (`disc`,
`triangle`, `diamond` in that order when left off) and `domain` the values in
legend order. The legend then carries a second key whose swatches are the glyphs
themselves:

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

A field read through a scale costs a fraction of the jexl callback it replaces,
which is what makes shape-by-field a declaration rather than an expression.

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
interval whose extent is the point — a region of interest under the bars,
coloured by a class field. With no `row` every span shares one band across the
whole plot; with one —
`{ "shape": "span", "encoding": { "row": "sampleIndex" } }` — the plot divides
into as many bands as the highest row on screen needs, and each span sits on the
band its field names.

## Transforms

A mark's `transform` is a list of steps over the region's features, run in the
worker before the encoding, in order, each reading what the last answered:

| Step        | What it does                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`    | keeps the features a jexl `expr` admits                                                                                                                     |
| `formula`   | writes a jexl `expr`'s value into the field `as`                                                                                                            |
| `bin`       | snaps each feature to the `step`-bp bin its `field` (`start`) falls in, writing the bin's edges over `start` and `end`                                      |
| `aggregate` | folds each group of features sharing the `groupby` fields into one, with each of `ops` — `count`, or `sum`/`mean`/`min`/`max` of a `field` — as a new field |
| `coverage`  | replaces the features with runs of how many overlap each stretch, in the field `as` (`coverage`)                                                            |
| `flatten`   | fans each feature out into one per element of an array `field` (`subfeatures`), each reading its parent for what it lacks, with its index in `as`           |

A `bin` followed by an `aggregate` grouped by `start` and `end` is a density:
one bar per bin, its height the count of features whose start fell in it.

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
zoom is the drawing mark's.

## What the track menu offers

The score submenu (min/max score), point size, cross hatches, the legend toggle,
and **Filter by...** for the same `jexlFilters` every feature display takes — a
filter runs in the worker before the encoding, so a filtered feature is neither
drawn nor counted in the y-axis. Hovering a mark shows its location, value and
colour class; clicking opens the feature's details. A click on a binned or
coverage bar opens the bin or the run itself — its span, its count or depth and
the other aggregates the mark's steps wrote — remade over the features under it.

The full slot list is the
[LinearMarkDisplay config reference](/docs/config/linearmarkdisplay); how the
encoding is evaluated, and what a `jexl:` channel measured against a field read,
is
[MARK_ENCODING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MARK_ENCODING.md).

## When a plugin is the next step

A drawing that is not a bar, a point or a span needs a **shape** of its own —
one shader, one painter, one hit test — declared as a mark over the same worker
channels this display reads: [](/docs/developer_guides/creating_gpu_display)
writes one. A display that lays features out its own way, or gives a channel a
meaning the encoding cannot say — Manhattan's colour by LD to an index SNP — is
the rung after that, and [](/docs/developer_guides/plotting_features) composes
one.
