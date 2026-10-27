---
title: Mark display
description:
  A grammar of graphics over a feature, alignments, variant or quantitative
  track, where LinearMarkDisplay draws the bars, points, rules, spans and labels
  its config declares
guide_category: Track types
---

`LinearMarkDisplay` is a grammar of graphics over a track, in the sense of
Vega-Lite or ggplot: a picture is declared as marks, encodings and transforms
rather than drawn by code. It goes on a `FeatureTrack`, an `AlignmentsTrack`, a
`VariantTrack`, a `QuantitativeTrack` or a `MultiQuantitativeTrack`, and draws a
`bar`, `point`, `rule`, `line`, `rect`, `text` or `link` per `marks` entry, each
with an `encoding` naming the fields that feed it, a `transform` list that can
bin, count, pack or measure coverage, and a zoom range it draws in.

Reach for it when a field is the picture: a BED score, a segment's log ratio, a
peak's signal and q-value, a read's MAPQ, a variant's `QUAL`. The format-typed
displays still cover mismatches, genotypes and isoform tiering, which are not
fields.

## A worked example

Bars from a BED score column, colored by strand, with the color key on screen:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "scores",
  "name": "Scores",
  "uri": "https://example.com/scores.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "scores-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "score",
            "color": { "field": "strand", "scale": { "type": "ordinal" } }
          }
        }
      ]
    }
  ]
}
```

The track opens with the display listed first. Every other slot has a default:
`x` is `start`, `x2` is `end`, bars grow from an `origin` of 0, and the axis
autoscales to what is on screen.

## The vocabulary, for a ggplot2 or Vega-Lite reader

A reader who knows ggplot2 or Vega-Lite can read a `marks` config through the
names those libraries use. Each row is one idea; the last column gives this
display's spelling, and the sections below cover each in turn. GenomeSpy shares
Vega-Lite's names and adds the genomic transforms, so it appears where it adds
one.

<!-- prettier-ignore -->
| Idea | ggplot2 | Vega-Lite, GenomeSpy | `LinearMarkDisplay` |
| --- | --- | --- | --- |
| a bar from a baseline to a value | `geom_col()` | `"mark": "bar"` | `"mark": "bar"`, the display's `origin` as the baseline |
| a point at a value | `geom_point(size)` | `"mark": "point"`, `"size"` on the mark | `"mark": "point"`, `encoding.size` a number, at the middle of `x` to `x2` |
| a line across an interval at a value | `geom_segment(aes(xend = end, yend = score))` | `"mark": "rule"` over `x`, `x2` and `y` | `"mark": "rule"`, `encoding.strokeWidth` a number as its thickness |
| a line through the values | `geom_step()`, `geom_line()` | `"mark": { "type": "line", "interpolate": "step-after" }` or `"linear"` | `"mark": { "type": "line", "interpolate": "step" }` or `"linear"`, `encoding.strokeWidth` its width |
| a band across the plot, with no value | `geom_rect()` with no y | `"mark": "rect"` over `x` and `x2` alone | `"mark": "rect"` |
| a heatmap strip, its color the value | `geom_tile(aes(fill = score))` | `"mark": "rect"` with a quantitative `color` | `"mark": "rect"` with a color scale over the field |
| a band thinner than its row | `geom_tile(height = 0.8)` | `"mark": {"type": "rect", "height": {"band": 0.8}}` | `"mark": {"type": "rect", "height": {"band": 0.8}}` |
| the field a mark plots | `aes(y = score)` | `"y": {"field": "score"}` | `"encoding": {"y": "score"}` |
| a value computed on the way in | `mutate()` before the plot | `{"calculate": …, "as": …}` | `{"type": "formula", "expr": …, "as": …}` |
| a color per category | `aes(fill = strand)` | `"color": {"field": "strand", "type": "nominal"}` | `"color": {"field": "strand", "scale": {"type": "ordinal"}}` |
| which colors, in which order | `scale_fill_manual(values, breaks)` | `"scale": {"domain": […], "range": […]}` | `scale.domain` and `scale.range` on the color |
| a color ramp over a number | `scale_fill_viridis_c()`, `scale_fill_gradientn(colors)` | `"type": "quantitative"`, `"scale": {"scheme"}` | `"scale": {"type": "linear"}` with `scheme` or `range` |
| the ramp's middle stop at a value | `scale_fill_gradient2(midpoint)` | `"scale": {"domainMid"}` | `scale.domainMid` on the color |
| a color per interval of a number | `cut()` into `scale_fill_manual(values)` | `"scale": {"type": "threshold", "domain", "range"}` | `"scale": {"type": "threshold"}`, `domain` holding the cuts |
| a shape per category | `aes(shape = svType)` | `"shape": {"field": "svType"}` | `"shape": {"field": "svType", "scale": {"type": "ordinal"}}` |
| a log axis | `scale_y_log10()` | `"y": {"scale": {"type": "log"}}` | `"encoding": {"y": {"scale": {"type": "log"}}}` |
| a log-like axis through zero | `scale_y_continuous(transform = "pseudo_log")` | `"y": {"scale": {"type": "symlog", "constant"}}` | `"encoding": {"y": {"scale": {"type": "symlog", "constant"}}}` |
| fixed axis ends | `coord_cartesian(ylim)` | `"scale": {"domain": [lo, hi]}` | `domainMin` and `domainMax` on `encoding.y.scale` |
| one axis over a faceted plot | `facet_*(scales = "fixed")` | the default | always: every section and row reads the display's one `encoding.y` |
| one axis over several tracks | | `"resolve": {"scale": {"y": "shared"}}` on a concatenation | `encoding.y.scale.group` |
| an axis caption | `labs(y = "…")` | `"axis": {"title"}` | `encoding.y.axis.title` |
| a key heading | `labs(fill = "…")` | `"legend": {"title"}` | `legend.title` on the color |
| which values the key lists | `scale_fill_manual(breaks)` | `"legend": {"values"}` | `legend.values` on the color or shape |
| a stepped key, highest first | `guide_legend(reverse = TRUE)` | | `legend.descending` on a threshold color |
| a horizontal line at a value | `geom_hline(yintercept)` | `"mark": "rule"` with a `datum` | `encoding.y.rules` |
| a histogram | `geom_histogram(binwidth)` | `{"bin": {"step"}}` then `{"aggregate": [{"op": "count"}]}` | `{"type": "bin", "step"}` then `{"type": "aggregate", "ops": [{"op": "count"}]}` |
| a summary per bin | `stat_summary_bin(fun = mean)` | `bin` then `aggregate` with `"op": "mean"` | `bin` then `aggregate` with `"op": "mean"` |
| keep some of the rows | `filter()` before the plot | `{"filter": …}` | `{"type": "filter", "expr": …}`, or the display's `filter` |
| one row per element of a list field, or per entry of a keyed record | `tidyr::unnest()` | `{"flatten": [field]}` | `{"type": "flatten", "field"}`, with the entry's key in `key` |
| how many features overlap each position | | GenomeSpy `{"type": "coverage"}` | `{"type": "coverage"}` |
| overlapping features stacked into rows | | GenomeSpy `{"type": "pileup", "as": "lane"}` | `{"type": "pileup"}`, read by the mark's `row` |
| a fixed px height per row | | `"height": {"step": 20}` on the view | the display's `rowHeight`, under `rows` |
| a label at each feature | `geom_text(aes(label = name), check_overlap = TRUE)` | `"mark": "text"`, `"text": {"field": "name"}` | `"mark": "text"`, `"encoding": {"text": "name"}` |
| a curve between two positions | `geom_curve(aes(x, xend))` | GenomeSpy `"mark": "link"`, `"x2"` | `"mark": "link"`, `x` to `x2` |
| a stroke width per feature | `aes(linewidth = score)` | `"strokeWidth": {"field": "score"}` | `"encoding": {"strokeWidth": {"field": "score"}}` on a link |
| a record's other end | | | `{"type": "mate"}`, which a link's `x2` then reads |
| a band of the plot per category | `facet_grid(rows = vars(sample))` | `"row": {"field": "sample"}` | `"facet": "sample"`, or `"rows": "sample"` for one row each |
| layers drawn in order | `+ geom_…()` | `"layer": […]` | `marks`, in list order |
| a layer that draws at some zooms only | | GenomeSpy `multiscale` with `stops` | `minBpPerPx` and `maxBpPerPx` on the mark |
| a polar plot | `coord_polar()` | | the circular view, over the same config |

Two names mean something else here. Vega-Lite's `row` is a facet channel; on
this display `encoding.row` is the band a feature stands in, the integer a
`pileup` step writes, and the facet is the display's `facet`. A positional
channel is a bare field here, where Vega-Lite's has a scale, because the y scale
is the display's `encoding.y` and every mark reads one axis. The display has no
stacked bar and no `opacity` channel; every bar rises from the baseline. A
point's diameter is `encoding.size`, and a rule's, line's or link's stroke is
`encoding.strokeWidth`, Vega-Lite's word: a number of px, or on a link a field
mapped to a width.

## The encoding

Each mark's `encoding` maps feature fields to the channels its type reads:

| Channel       | Read by                                | Value                                                                                                                                                                                                                                                         |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`           | every mark                             | a field holding the left edge in bp; `start` by default                                                                                                                                                                                                       |
| `x2`          | every mark                             | the right edge; `end` by default                                                                                                                                                                                                                              |
| `y`           | `bar`, `point`, `rule`, `line`, `text` | the field plotted on the score axis, read through the display's `encoding.y` (below); a feature whose value is not a finite number is skipped. A `text` may leave it empty and stand at the apex of a link between its two ends, or in the middle of its band |
| `row`         | every mark                             | an integer field naming the band the mark stands in, from 0; missing is 0, and left empty it follows the last `pileup` step before it, in the mark's, the facet's or the display's                                                                            |
| `color`       | every mark                             | a field through a scale (below), or a constant `{ "value": … }` holding a CSS color or a jexl callback returning one; a bare string is a field                                                                                                                |
| `shape`       | `point`                                | `circle`, `triangle-down`, `diamond` or `square`, a jexl callback returning one, or a categorical scale (below)                                                                                                                                               |
| `size`        | `point`                                | a number of px, the point's diameter                                                                                                                                                                                                                          |
| `strokeWidth` | `rule`, `line`, `link`                 | a number of px, a rule's thickness, a line's width or a link's stroke; or, on a link, a field read through a linear or log scale into a px range (below)                                                                                                      |
| `text`        | `text`                                 | the field printed, `name` by default; a feature with nothing there prints nothing                                                                                                                                                                             |

A field name is read directly from the feature (`score`, `strand`, or any column
a BED `columnNames` or a GFF attribute names). A `jexl:` expression over
`feature` is accepted wherever a field name is, for a derived channel:

```json
{ "y": "jexl:-log10(feature.pvalue)" }
```

A jexl `y` is evaluated once per feature and costs about half again as much as a
field read, so reach for it where no field holds the value you want to plot.

## The value scale

A mark's `y` names a field; the scale it is read through belongs to the display,
which declares it once as `encoding.y`:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "encoding": { "y": { "scale": { "type": "log", "domainMin": 1, "domainMax": 1000 } } },
    "marks": [{ "mark": "bar", "encoding": { "y": "score" } }]
  }
]
```

`scale.type` is `linear` (the default), `log` or `symlog`, which reads like
`log` away from zero and stays linear through it, so values reaching or crossing
0 keep their place; `scale.constant` sets how wide that linear region is. An end
left unset autoscales over the loaded regions, and
[`scale.fenceQuantile`](/docs/config/yscale/#slot-fencequantile) fences its
outliers. The axis, its ticks, its grid lines and the bars read this one
declaration, and so does the **Y axis...** panel.

Every mark drawing at the current zoom folds into that one domain, the way a
grammar of graphics gives one scale per aesthetic. With a multiscale pair
(below) only one mark draws, so the axis is that mark's.

`scale.group` shares the axis across tracks: every track in the view naming the
same group autoscales over all of their data, so a plot and a wiggle or coverage
track stay comparable as the view moves. An end pinned on one track applies to
that track alone. **Share axis with** in the **Y axis...** panel writes it.

### Reference lines and the axis title

`encoding.y` also holds the two guides a reader checks a plot against: `rules`,
horizontal lines at chosen values, and `axis.title`, the caption beside the
axis.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "association",
  "name": "Association",
  "uri": "https://example.com/association.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "association-LinearMarkDisplay",
      "encoding": {
        "y": {
          "axis": { "title": "-log10 p" },
          "rules": [{ "value": 7.3, "color": "red", "label": "p = 5e-8" }, 5]
        }
      },
      "marks": [{ "mark": "point", "encoding": { "y": "score" } }]
    }
  ]
}
```

Each entry of `rules` is `{ value, color, label }`, and a bare number is a grey
unlabelled rule — a significance threshold, a zero line under a log ratio, an
allele-frequency cut. An autoscaled end widens to keep every rule on the axis; a
pinned end that excludes one drops it. A rule belongs to the scale, so it draws
in every band of a faceted plot and at every zoom, including over the other half
of a multiscale pair.

`title` is optional: unset, the axis has no caption. A plot banded by `facet` or
`rows` has the one caption beside its bands.

## One quantity per category

A count per bin per strand, or a depth per haplotype, is one bar per category at
each position, and drawn from the origin at one x they cover each other. Give
each category a separate place instead. Two categories mirror across the axis,
one drawn upward and one down through a `formula` negating its value:

```json
"marks": [
  {
    "mark": "bar",
    "transform": [
      { "type": "filter", "expr": "jexl:feature.strand == 1" },
      { "type": "coverage" }
    ],
    "encoding": { "color": { "value": "tomato" } }
  },
  {
    "mark": "bar",
    "transform": [
      { "type": "filter", "expr": "jexl:feature.strand == -1" },
      { "type": "coverage" },
      { "type": "formula", "expr": "jexl:-feature.coverage", "as": "down" }
    ],
    "encoding": { "y": "down", "color": { "value": "steelblue" } }
  }
]
```

Several categories take a row each, the multi-row form, with `rows` on the
display and the same `coverage` in the mark; the sections keep the value they
were split on, so a color over it names each row:

```json
{
  "transform": [
    { "type": "formula", "expr": "jexl:getTag(feature,'HP')", "as": "hp" }
  ],
  "rows": "hp",
  "marks": [
    {
      "mark": "bar",
      "transform": [{ "type": "coverage" }],
      "encoding": { "color": "hp" }
    }
  ]
}
```

`facet` in place of `rows` gives each category a labelled section with a chip to
hide it by. Every row and section reads the display's one `encoding.y`, so the
heights compare.

## Two quantities

A coverage run in the hundreds and a per-read mapping quality in the tens cannot
be read off one axis, and the display draws only one. Write them as two tracks,
one display and one `encoding.y` per track, so each axis has the field it
measures and the reader can stack the tracks in whatever order the comparison
needs.

Where the two quantities answer the same question at different zooms, one track
still does it: give each mark a zoom range and they never draw together.

```json
"marks": [
  {
    "mark": "bar",
    "transform": [{ "type": "coverage" }],
    "encoding": { "color": { "value": "#c8d8ee" } },
    "minBpPerPx": 20
  },
  { "mark": "point", "encoding": { "y": "score" }, "maxBpPerPx": 20 }
]
```

The coverage draws zoomed out and the per-read value zoomed in, and the axis at
each zoom is the drawing mark's. v5.0.0 withdrew the right-hand second axis,
because with two axes each bar could belong to either set of numbers.

## Color scales

`color` as a bare string names a field, and as an object binds that field to a
scale, so the legend reads the same table the colors came from. A constant is
`{ "value": "steelblue" }`, or a `value` holding a jexl callback that answers a
color per feature; a color name written bare is reported as a field no feature
holds. With `scale` unset, `score` runs through a linear ramp and any other
field is categorical, a color per distinct value, so a numeric field such as
RepeatMasker's `milliDiv` needs `"scale": { "type": "linear" }` written. A color
written with an alpha, `rgba()` or `#rrggbbaa`, paints at that opacity, as a
constant or as an entry of a `scale.range`, which is how a dense scatter or
overlapping spans stay readable.

- **ordinal** —
  `{ "field": "strand", "scale": { "type": "ordinal", "range": ["#1f77b4", "#ff7f0e"] } }`

  `scale.domain` lists values in legend order and takes `scale.range` entries
  from the first; values it leaves out follow, sorted. Each value it leaves out
  takes a distinct color the first time the track shows it, and keeps that color
  as other regions load; a value that no other value competes with paints the
  color derived from the value. `scale.unknown`, d3's name, paints every value
  the domain leaves out one color instead, and the key names them one row,
  Other. A feature with no value paints the no-value grey, or the
  `scale.invalid` color where one is set. One row per color, so two values
  painted alike share a row, and a no-value color matching `unknown`'s joins
  Other. A key of one color, or over 20 rows, is not drawn.

- **linear**, **log** or **symlog** —
  `{ "field": "signal", "scale": { "type": "linear", "domainMin": 0, "domainMax": 50, "range": ["white", "red"] } }`

  `symlog` runs logarithmic away from 0 and linear through it, so a signed fold
  change ramps on both sides. `scale.scheme` names a ramp in place of
  `scale.range`, and `scale.reverse` turns either round. An end left off spans
  every loaded region and moves as you pan, so pin both for a figure and one for
  a floor or a ceiling. `scale.domainMid` places the middle stop, which is how a
  diverging ramp centres on zero inside an asymmetric domain.

- **threshold** —
  `{ "field": "signal", "scale": { "type": "threshold", "domain": [10, 50], "range": ["#eee", "#f90", "#c00"] } }`

  Each cut in `scale.domain` opens an interval, so `scale.range` has one color
  more. The key lists a row per interval, and a grey one for features with no
  value.

The display paints every color from the data it already loaded, so a change to a
constant color, a palette, a domain, a threshold's cuts or a ramp's ends redraws
without fetching again. A change to what is read from each feature does fetch
again: a field named or dropped, a switch between categories and numbers, or a
`jexl:` color.

`legend.title` heads the key and has three states: unset reads the `field` name,
text is that text, `""` draws no heading. Marks share one key only under one
title, and share a ramp only with both ends pinned.

Three more `legend` members shape the key and paint nothing. `values` lists the
values it names, in that order, and every value still takes its color.
`descending` lists a threshold's intervals from the highest down. `missingLabel`
names the grey row for features with nothing in the field.

## Shape scales

Other channels take a scale too. `shape` takes the same categorical form,
`{ "field": "svType", "scale": { "type": "ordinal" } }`, where `scale.range`
lists the shapes to hand out as a color scale's lists colors (`circle`,
`triangle-down`, `diamond` in that order when left off, `square` only where
listed, since a circle 3 px across draws as one) and `scale.domain` lists the
values in legend order. The legend then has a second key whose swatches are the
shapes themselves:

```json
{
  "mark": "point",
  "encoding": {
    "y": "score",
    "color": { "field": "strand", "scale": { "type": "ordinal" } },
    "shape": {
      "field": "svType",
      "scale": {
        "type": "ordinal",
        "domain": ["INS", "DEL"],
        "range": ["triangle-down", "diamond"]
      }
    }
  }
}
```

A scale is a lookup from the field's value into `scale.domain` and
`scale.range`, so it costs a fraction of the per-feature jexl callback it
replaces. With three shapes to hand out, two unlisted values often derive the
same one; the corner notice names them, and **Pin distinct shapes** writes the
key's values into `scale.domain`.

## Several marks

The display draws `marks` in order, a later entry over an earlier one, all over
one score axis and one fetch per region. Points over bars from the same file,
with the points' color a callback:

```json
"marks": [
  { "mark": "bar", "encoding": { "y": "score" } },
  {
    "mark": "point",
    "encoding": {
      "y": "score",
      "color": { "value": "jexl:feature.name=='EDEN.1' ? 'red' : 'blue'" }
    }
  }
]
```

A point stands at the middle of its `x` to `x2`, `encoding.size` px across. A
`rule` is the line from `x` to `x2` at `y`, `encoding.strokeWidth` px thick, for
a value that belongs to an interval — a window's Fst, a segment's copy number:

```json
{ "mark": "rule", "encoding": { "y": "score", "strokeWidth": 3 } }
```

A `line` strokes through consecutive values on a row. Its mark object's
`interpolate: "step"`, the default, holds each value across its span and steps
to the next where two spans abut, dropping to `origin` across a gap, so a
bedGraph or a BigWig tier draws the values as stored; `"linear"` runs from one
span's centre to the next, which is smoother where the spans are few.
`encoding.strokeWidth` is the width in px, 1 unset. A color scale over the field
`y` plots colors the stroke by the value under each pixel, so a threshold at 0
with two colors paints a rise across zero in both, changing at the axis.

```json
{
  "mark": { "type": "line", "interpolate": "linear" },
  "encoding": { "y": "score", "strokeWidth": 2 }
}
```

A `rect` has no `y`: it paints a band from `x` to `x2` in its color, for an
interval whose extent is the point. With no `row` every rect shares one band;
with one, `{ "mark": "rect", "encoding": { "row": "sampleIndex" } }`, the plot
divides into as many bands as the highest row on screen needs. A color scale
over a field makes the rect a heatmap:
`{ "mark": "rect", "encoding": { "color": { "field": "score", "scale": { "type": "linear", "range": ["white", "red"] } } } }`
paints each interval by its value, and a diverging `scale.range` with
`scale.domainMid` fades through the middle color at that value, which is how a
signed signal reads white at zero.

`"mark": { "type": "rect", "height": { "band": 0.8 } }` fills that fraction of
its band, centred, where an unwritten `band` fills all of it. It sits on the
mark, so two spans over the same rows can differ, one drawn thick at `0.8` and
one thin at `0.3`.

## Labels

A `text` mark prints a field at each feature: over the middle of its `x` to
`x2`, just above its `y` where the mark names one, at the apex of the curve a
`link` mark draws between the same two ends (see [Links](#links)), and in the
middle of its row band otherwise. Bars with each feature's name over them:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "labelled_scores",
  "name": "Scores with labels",
  "uri": "https://example.com/scores.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "labelled_scores-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "encoding": { "y": "score", "color": { "value": "#c8d8ee" } }
        },
        {
          "mark": "text",
          "encoding": { "y": "score", "text": "name" },
          "maxBpPerPx": 50
        }
      ]
    }
  ]
}
```

The display places labels left to right and omits a label that overlaps one
already placed or runs off the edge, as ggplot2's `check_overlap` does. A label
too near the top of its band goes under the value instead. The text takes the
mark's `color`, or the theme's, with a halo so it stays legible over the bars,
and shows no hover; the mark it labels does.

Every feature whose middle is in view is a candidate before the culling, so a
text mark needs a `maxBpPerPx` that stops it once there are more features than
labels fit. On the circular view the labels appear on the linear track only.

## Links

A `link` mark draws a curve from `x` up and over to `x2`. Over a BED with
start-end pairs, `x` to `x2` is the feature's two ends, and
`encoding.strokeWidth` strokes each curve by a field through a linear or log
scale into a pixel range. Splice junctions from a STAR file, stroked by read
support and labelled with it:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "junctions",
  "name": "Splice junctions",
  "uri": "https://example.com/junctions.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "junctions-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "encoding": {
            "strokeWidth": {
              "field": "score",
              "scale": { "type": "log", "range": [1, 8] }
            }
          }
        },
        { "mark": "text", "encoding": { "text": "score" }, "maxBpPerPx": 50 }
      ]
    }
  ]
}
```

A paired record names its other end elsewhere: a BEDPE or STAR-Fusion adapter
fills a `mate` field, a VCF states each end in an `ALT`, and a paired read has
its mate's position as `next_ref` and `next_pos`. The `mate` step reads any of
them into `mate.refName`, `mate.start` and `mate.end`, one feature per end and a
read pair once, with `svType` beside a variant's; `x2` then names those as a
locus, so a mate on another chromosome draws wherever the view shows it. Over a
BAM that is the read-pair arcs of the alignments track's band, one curve per
pair, colored by whatever field the reads have:

```json
{
  "mark": "link",
  "transform": [{ "type": "mate" }],
  "encoding": { "color": "pair_orientation" }
}
```

**A track whose records name a mate draws the links with no configuration**:
pick **Marks** from the track menu's display types over a BEDPE, a STAR-Fusion
file or an SV VCF and the display writes the mark and the step below. Write them
out to add more: a color by type, a stroke by score, a shape:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "sv_calls",
  "name": "SV calls",
  "uri": "https://example.com/sv.vcf.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "sv_calls-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "encoding": { "color": "svType", "strokeWidth": 2 },
          "transform": [{ "type": "mate" }]
        }
      ]
    }
  ]
}
```

The apex of a link is its half-width, clamped to the band under
`"mark": { "type": "link", "interpolate": "dome" }` (the default) and a true
semicircle under `"arc"`; a `y` puts it at a value on the display's axis
instead, so a link plotted by its score rises to it. `"linear"` draws a straight
segment between the two ends, on the baseline or at the `y` value. A pair wider
than three screens straightens into a leg rising from each end, and a mate the
view does not show draws a short stem at the end it does. Where the `mate` step
read a direction for an end, as it does from a breakend `ALT`, the link draws a
short foot there, lying over the side of the junction the rearranged sequence
keeps. A link answers a hover and a click along its stroke, and the SVG export
writes it as a path.

A `text` mark naming no `y` labels the link on its two ends: each label sits
just inside the apex of its curve, or just over it where the curve is too small
to hold it. A pair wide enough to straighten into legs has no apex on the band
and prints no label.

## Facets

The display's `facet` gives each value of a field a separate band of rows, named
by a chip a reader can hide the section from. The facet splits the features
first and runs the facet's `transform` over each section alone. Every mark then
runs its steps over each section, so a `pileup` in the facet's `transform` packs
each section into separate rows with every mark standing in them, and a
`coverage` in a mark's counts each section's depth:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "facet": { "field": "sample", "transform": [{ "type": "pileup" }] },
    "marks": [{ "mark": "rect" }]
  }
]
```

A `pileup` in the display's `transform` runs before the split, so it packs
across every section and leaves each section the rows the others fill; the
facet's is the one that packs per section.

A section's rows keep the facet's value through a `coverage` or an `aggregate`,
the way a ggplot2 stat keeps its facet variable, so a color over the field the
plot is split on paints the depth in each section with that section's color:

```json
{
  "facet": "strand",
  "marks": [
    {
      "mark": "bar",
      "transform": [{ "type": "coverage" }],
      "encoding": { "color": "strand" }
    }
  ]
}
```

The field is read the way a channel reads one: a name, a dotted path
(`INFO.SVTYPE`), or a `jexl:` expression. Where the value has to be computed
first, the display's `transform` runs before the split:

Sections order a name holding a number by that number, so chr2 before chr10, and
the rest by code point. `sort` sets the order: listed values first, the rest
sorted after. A `sort` orders the sections and leaves the set of sections
unchanged.

When a reader drags a section's chip onto another section, the display writes
the drawn order back as the facet's `sort`, and **Show → Reset section
order**<!-- menu-path-ok --> clears it. A hidden section leaves the legend and
the value axis along with the plot.

Haplotagged reads split by their `HP` tag, the tag lifted into a field by a
`formula` so the chips and the key name it `HP`:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "transform": [{ "type": "formula", "expr": "jexl:getTag(feature,'HP')", "as": "HP" }],
    "facet": "HP",
    "marks": [
      {
        "mark": "rect",
        "transform": [{ "type": "pileup" }],
        "encoding": {
          "color": {
            "field": "HP",
            "scale": { "type": "ordinal" },
            "legend": { "title": "Haplotype" }
          }
        }
      }
    ]
  }
]
```

<Figure src="/img/mark_display/facet.png" caption="HG002 ONT reads faceted by their HP tag: each haplotype's reads packed into a separate band under the chip that names it, and the untagged reads in a third."/>

`facet` and its `sort` are the same slot and the same ordering rule that the
gene, alignments, variant, multiway synteny and multi-row displays each take in
a separate form. [](/docs/config_guides/grouping_and_ordering) describes the
shared mechanism across all of them.

## Rows

The display's `rows` gives each value of a field one row: over a multi-BigWig,
whose features have the file they came from in `source`, it draws one xyplot per
file, the value axis repeated on each row tall enough to hold it.

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "rows": "source",
    "marks": [{ "mark": "bar", "encoding": { "y": "score" } }]
  }
]
```

A label names each row, and the track menu has what the other row displays have:
**Cluster rows by similarity...**, **Edit colors/arrangement...**, and **Sort
rows by value here** on a right-click. As an object, `rows` takes the order too,
`{ "field": "source", "sort": ["tumor", "normal"] }`, and a reorder, a
clustering run or a clade off the tree is written there, so undo, **Reset row
order** and a share link all reach it.

The rows divide the plot between them by default, so every row shows.
`"rowHeight": 20` pins each row at 20 px instead, and the rows that do not fit
scroll: a wheel over the rows or the scrollbar at the right reaches them, and
shift+wheel resizes them. `0`, the default, fits them to the plot again, and
**Row height → Squeeze to fit view** writes it. The menu's Normal and Compact
presets also set every rect's `mark.height.band`, so the rows stand apart.

The display's [`rowColor`](/docs/config/linearmarkdisplay/#slot-rowcolor) paints
the bar beside each row's label, a mark naming no color, and a mark colored by
the field the rows split on, `"color": "source"` under `"rows": "source"`. A
row's own color there beats the mark's `scale.range`, which colors the rows that
have none. `{ "scale": { "domain": ["tumor"], "range": ["#e15759"] } }` pairs a
row's value with a color, the form **Edit colors/arrangement...** writes.

`facet` and `rows` both split the features on a field, and differ in what a
value gets: a facet section is as deep as its packing and has a chip, where a
row is one row. Beside a facet, the facet draws: with `rows` on the same field
the facet is the whole picture, and with `rows` on another field the track shows
a warning, because bands of rows are not drawn yet. A mark display picked from
the track menu over a multi-BigWig opens with `rows: "source"`, a row per file
in the adapter's order, unless the display already names a `facet` or `rows`.

A row per species over a MAF is the same `rows`, once a `flatten` has fanned
each alignment block out. A MAF block is one feature with an `alignments` record
keyed by species, and `flatten` over a record writes each entry's key to the
field `key` names, so `rows: "species"` reads one value per species from the
features themselves. The adapter lists its species too, so every species has a
row whether or not the loaded regions align it, in the guide tree's order with
the tree drawn beside the rows, as on the MAF display. Each row keeps its
block's reference span and has the species' `srcRefName`, `srcStart`, `strand`,
`srcSize` and `seq`; a rect colored by `srcRefName` colors each block by the
sequence it comes from in that species, as the MAF display's `refNameRank` fill
does by rank:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "multiz470way_species",
  "name": "Multiz 470-way, a row per species",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigMafAdapter",
    "bigBedLocation": {
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470way.bigMaf"
    }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "multiz470way_species-LinearMarkDisplay",
      "transform": [
        { "type": "flatten", "field": "alignments", "key": "species" }
      ],
      "rows": "species",
      "marks": [
        {
          "mark": "rect",
          "encoding": {
            "color": { "field": "srcRefName", "scale": { "type": "ordinal" } }
          }
        }
      ]
    }
  ]
}
```

A `cells` step behind the flatten replaces each species row with its runs of
columns against the reference: one feature per run in one `state`, `match`,
`mismatch` or `gap`, a mismatch run with its `base`, and one interbase
`insertion` per run of inserted bases, standing at the reference base it
precedes with the bases in `base`. A rect colored by `state` is the MAF
display's mismatch view, an insertion painting as a one-pixel sliver at its
anchor, and a `text` over `base` letters each mismatch and each insertion once
the zoom shows a base:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "multiz470way_cells",
  "name": "Multiz 470-way, cells against the reference",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigMafAdapter",
    "bigBedLocation": {
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470way.bigMaf"
    }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "multiz470way_cells-LinearMarkDisplay",
      "transform": [
        { "type": "flatten", "field": "alignments", "key": "species" },
        { "type": "cells" }
      ],
      "rows": "species",
      "marks": [
        {
          "mark": "rect",
          "encoding": {
            "color": {
              "field": "state",
              "scale": {
                "type": "ordinal",
                "domain": ["match", "mismatch", "gap", "insertion"],
                "range": ["#d9d9d9", "#e41a1c", "#404040", "#984ea3"]
              }
            }
          }
        },
        { "mark": "text", "encoding": { "text": "base" }, "maxBpPerPx": 0.5 }
      ]
    }
  ]
}
```

A VCF's samples fan out the same way, `flatten` over `samples` with
`key: "sample"`, for `rows: "sample"` and a color over `GT`.

## Transforms

A mark's `transform` is a list of steps over the region's features, run in the
worker before the encoding, in order, each reading what the last wrote. The
display's `transform` takes the same steps and runs before every mark's. Each
step names its `type` and takes the settings for that step, which the
[MarkTransform config reference](/docs/config/marktransform) lists; a key
belonging to another step is refused where the config is read:

| Step        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`    | keeps the features a jexl `expr` admits                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `formula`   | writes a jexl `expr`'s value into the field `as`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `bin`       | snaps each feature to the `step`-bp bin its `field` (`start`) falls in, writing the bin's edges to the two fields `as` names (`start`, `end`)                                                                                                                                                                                                                                                                                                                 |
| `aggregate` | folds each group of features sharing the `groupby` fields into one, with each of `ops` (`count`, or `sum`/`mean`/`min`/`max` of a `field`) as a new field; an empty `groupby` takes the edges the last `bin` before it wrote, in this mark's `transform`, the facet's or the display's                                                                                                                                                                        |
| `coverage`  | replaces the features with runs of how many overlap each stretch, in the field `as` (`coverage`)                                                                                                                                                                                                                                                                                                                                                              |
| `flatten`   | fans each feature out into one per element of an array `field` (`subfeatures`) or per entry of a record keyed by name (a VCF's `samples`, a MAF block's `alignments`), each reading its parent for what it lacks, with its position in the field `index` names and its key in the field `key` names; `keepEmpty` holds on to a feature whose field is empty                                                                                                   |
| `cells`     | replaces each aligned row with its runs of columns in one `state` (`match`, `mismatch` or `gap`) against the reference, reading the row's `field` (`seq`) and the same field on the feature the row was fanned out of, and one interbase `insertion` per run of inserted bases, at the reference base it precedes; a mismatch run has its `base`, an insertion its bases in `base` and their count in `length`, and a match or mismatch run `match` as 1 or 0 |
| `pileup`    | writes each feature's row in a greedy first-fit packing into `as` (`row`), reading the interval `fields` (`start`, `end`) and keeping `padding` bp between two features on one row                                                                                                                                                                                                                                                                            |

A field a step reads is a name or a dotted path into a structured field, so a
VCF's `INFO.DP` is the `field` of a `mean` and `INFO.SVTYPE` a `groupby`. A
computed value is a `formula`'s to write, for the steps after it to read.

A `bin` then an `aggregate` is a density: one bar per bin, its height the count
of features starting in it. The `aggregate` groups by the edges the `bin` wrote
unless it sets `groupby`, whether the `bin` is in the same `transform` or in the
display's.

The aggregate's fields are `count` and `mean_score` here, and either can feed
`y` or a color scale. `coverage` counts how many features overlap each position,
for a repeat annotation, a set of peaks or any interval file with no summary
track beside it:

```json
{
  "mark": "bar",
  "transform": [{ "type": "coverage" }]
}
```

A mark that names no `y` plots what its steps wrote, the way a ggplot2 stat
names what its geom draws (`after_stat`): the depth a `coverage` writes, or the
one summary an `aggregate` with a single op writes. An aggregate writing two
summaries needs `y` to choose one. A link behind a `mate` step reaches the other
end the step found without naming `x2`, and a written channel takes precedence.

`pileup` expresses the packing of a read pileup as a step. It writes the lowest
row on which each feature overlaps nothing already there, and a `rect` reading
that row draws the packing:

```json
{
  "mark": "rect",
  "transform": [{ "type": "pileup", "padding": 10 }],
  "encoding": {
    "row": "row",
    "color": { "field": "strand", "scale": { "type": "ordinal" } }
  }
}
```

Over an `AlignmentsTrack` that is a declared pileup, colored by any field a read
has. A mark whose `encoding.row` is empty reads the field the last `pileup`
before it wrote (the mark's, the facet's or the display's), so `"encoding": {}`
draws the packing. The plot takes as many bands as the highest row needs, so
rows thin as depth grows and the track keeps its height.

The display's `filter` expressions run before every mark's steps.

## A picture per zoom level

Each mark can name the zoom range it draws in, in bp per pixel: `minBpPerPx`
draws it only at or above that width, `maxBpPerPx` only below it, and 0 sets no
bound. A density on one mark and the features on another make one track that
shows the count per bin zoomed out and each feature's value zoomed in, from one
fetch per region:

```json
"marks": [
  {
    "mark": "bar",
    "encoding": { "y": "milliDiv" },
    "maxBpPerPx": 100
  },
  {
    "mark": "bar",
    "transform": [
      { "type": "bin", "step": 10000 },
      { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
    ],
    "minBpPerPx": 100
  }
]
```

<Figure src="/img/mark_display/multiscale.png" caption="One Alu track twice: across 3 Mb the binned mark draws, across 30 kb the raw mark."/>

A mark outside its range is off entirely (not drawn, not hovered, and out of the
y-axis, the legend and the row count), so the axis at each zoom is the drawing
mark's. `encoding.y.axis.title` holds at every zoom, so a pair plotting two
quantities takes a title covering both, or none.

### A bin that follows the zoom

`"step": "auto"` picks the width from the view instead: four pixels of screen,
snapped up to the next 1, 2 or 5. The bars stay one width however far you zoom
out, and one mark replaces the three a config otherwise writes. The width
resolves before the fetch and is keyed into it, so zooming within a rung re-uses
what is loaded and crossing one re-reads, the way a BigWig picks a summary
level.

```json
"transform": [
  { "type": "bin", "step": "auto" },
  { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
]
```

## When a config cannot draw as written

A `marks` list loads whenever its keys and value types are right, and the
display draws what it can. Where two slots disagree, the track shows a warning
chip in its corner naming the slot, and the mark when the slot is a mark's. A
`bar`, `point` or `rule` naming no `y` draws nothing, and the rest are these,
each reported under its id:

<!-- MARK_RULES START -->

<!-- prettier-ignore -->
| Rule | Level | Reports |
| --- | --- | --- |
| `mark-without-value` | error | A bar, point, rule or line naming no `y`, with no step before it writing one it reads by default. |
| `empty-zoom-range` | error | A `minBpPerPx` not below the mark's `maxBpPerPx`, so the mark never draws. |
| `step-expression` | error | A `filter` or `formula` whose `expr` is not a `jexl:` expression. |
| `bin-width` | error | A `bin` whose `step` is neither `"auto"` nor a positive width. |
| `op-field` | error | A `sum`, `mean`, `min` or `max` naming no `field`. |
| `step-field-expression` | error | A step's field written as a `jexl:` expression, where a step reads a name or a dotted path. |
| `unwritten-y` | error | A `y` naming a field that no `aggregate` or `coverage` step before it writes. |
| `unread-channel` | warning | A channel the mark's type does not read, such as `y` on a `rect`, a `size` on a rule, whose width is `strokeWidth`, or a size field on a point. |
| `unread-size` | warning | An `encoding.size` or `encoding.strokeWidth` on a mark that draws no point, rule or line and strokes no link. |
| `unread-mark-member` | warning | A `mark` member its type does not read: an `interpolate` off a line or a link, a `height` off a rect, a `gapBp` off a line. |
| `mark-interpolate` | warning | An `interpolate` the mark's type does not draw, such as `dome` on a line, which then draws its default. |
| `threshold-cuts` | warning | Threshold cuts that repeat, leaving an interval no value falls in. |
| `threshold-no-cuts` | warning | A threshold color naming no cut, so every value paints one color. |
| `threshold-cut-count` | warning | A threshold color naming more cuts than it paints, so a value past the eighth takes the ninth color. |
| `threshold-range` | warning | A threshold `scale.range` not one color longer than its cuts. |
| `ramp-domain` | warning | A `scale.domain` on a linear, log or symlog color, whose ends are `scale.domainMin` and `scale.domainMax`. |
| `ramp-range` | warning | A linear, log or symlog color whose `scale.range` lists one color, which paints every value alike. |
| `domain-ends` | warning | A scale's `domainMax` below its `domainMin`: a color ramp's, a width's or the y axis's. |
| `domain-quantile` | warning | A color ramp's `domainQuantile` or the y axis's `fenceQuantile` outside 0.5 to 1, a percent among them. |
| `log-floor` | warning | A log scale's `domainMin` at or below 0, which a log scale cannot represent, so the end floors above it. |
| `field-spells-constant` | warning | A color's or a shape's `field` spelling a CSS color or a shape name, which is a constant written `{ value }`. |
| `names-domain` | warning | A color's or a shape's `scale.names` naming values its `scale.domain` does not list, or no ordinal scale's. |
| `unknown-domain` | warning | An ordinal color's `scale.unknown` with no `scale.domain`, so it paints every value. |
| `scheme-domain` | warning | An ordinal color's `scale.scheme` with no `scale.domain` or `scale.range`, so the default palette paints. |
| `unknown-scale` | warning | A `scale.unknown` on a color painting through no ordinal scale, so nothing reads it. |
| `invalid-scale` | warning | A `scale.invalid` on a color painting through no ordinal scale, so nothing reads it. |
| `window-frame` | warning | A `window`'s `frame` other than two whole row offsets or `null`, the first not past the second, so the step reads its default. |
| `step-pair` | warning | A `bin`'s `as` or `fields`, or a `pileup`'s `fields`, naming other than two fields, so the step reads its defaults. |
| `bin-field-and-fields` | warning | A `bin` naming a `field` beside the `fields` it cuts at the bin edges, which leaves the `field` unread. |
| `unread-weight` | warning | A `weight` on a `min` or a `max`, where it has no effect. |
| `unwritten-field` | warning | Another channel naming a field that no `aggregate` or `coverage` step before it writes, so it reads no value; the field a `facet` or `rows` splits on counts as written. |
| `value-beside-rows` | warning | A mark other than a rect drawn beside one that stacks rows, standing in the first of them. |
| `two-packings` | warning | Two `pileup` steps packing one plot, whose rows share numbers. |
| `cross-section-packing` | warning | A `pileup` in the display's `transform` under a `facet`, packing across every section. |
| `rows-beside-facet` | warning | `rows` beside a `facet` on another field, where the facet draws alone. |
| `packing-under-rows` | warning | A `pileup` or a `row` field under `rows`, where the packed rows share one row per value. |

<!-- MARK_RULES END -->

`jbrowse validate` reports the same list over a config file, which has none of
the half-written states an editor passes through, at the level the table lists:
an error is a mark that draws nothing, never draws, or names a step that cannot
run. The display's `transform` steps are checked the way a mark's are. Each
finding names the slot, and the mark when the slot is a mark's, and `--json`
shows the rule's id beside it.

## What the track menu offers

**Edit marks...** is the whole plot as controls. Above are the settings of the
plot as a whole: the field its sections stack by (`facet`) and the field that
gives each value a row (`rows`), each with the order its values take, and the
axis every mark stands on, with its title, type, pinned ends and grid. Below,
the marks in paint order on the left, and on the right the selected mark's type,
its steps, and a field picker per channel that type reads.

<Figure src="/img/mark_display/edit_plot.png" caption="Edit marks on a multiscale pair: the two marks on the left, the selected mark's channels and zoom range on the right."/>

A picker takes free text as well as a scanned field or one the mark's steps
write, so `INFO.DP`, `count`, a `jexl:` expression or a constant all go through.
Under a field that names a scale, the editor shows the kind of scale and then
what that kind reads: a categorical scale's values in order, their colors and
their names in the key; a threshold's cut points and a color per interval; a
ramp's `scale.scheme`, its `scale.reverse`, the ends that pin it, its middle,
and whether an open end follows the extremes or a percentile. An end left empty
spans the loaded regions, so pinning both fixes a figure's colors. A list is
comma-separated. When the kind changes, the editor drops the members the new
kind does not paint.

The editor lists a mark's steps, each named by what it writes and shown with its
settings in place, with a list of common steps to add: a count per bin, a
coverage, a filter. A step that writes a value fills a bar that names no `y`.
Beside **Add mark**, **Add zoomed-out density** appends the count per bin that
draws from 100 bp per px out and hands the marks above it the closer zooms.

The form shows, without rewriting, a channel the mark's type stopped reading and
a far end that names a separate sequence field. The rules run as you type and
each finding sits under the control that caused it. The corner notice opens the
same dialog.

**Edit as text...**, inside it, is the same plot as text, which **Advanced →
Edit plot...** in the track menu also opens, and **Back to form** there returns.
A setting left out stays as it is; `null` clears one. Each editor accepts a plot
that the rules report, since the display draws what it can; Apply refuses only
what a config file is refused for.

With no `marks` at all a display plots `score` as bars, links a record to the
other end it names, or opens the dialog where the fields supply neither.

The **Y axis...** row opens the panel that writes `encoding.y` as you change it:
scale type, min and max, Include 0, outlier clipping, grid lines and reference
lines. Beside it, **Point size**, the legend toggle, and **Filter by...**, whose
jexl runs in the worker before the encoding, so a filtered feature is neither
drawn nor in the axis. Hovering a mark shows its location, value and color
class; clicking opens the feature, and clicking a binned or coverage bar opens
the bin remade over the features under it.

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
density ring with the same `marks` entry. The ring is the canvas, so a `text`
mark's labels stay on the linear track. A variant track keeps its chords unless
the session names the mark display for it.

## Examples and tutorials

- [](/docs/config_guides/mark_display_examples) is one complete config per idea
  over a hosted file, each with its picture and a live link: bars, points,
  ramps, thresholds, bins, pileups, facets, labels, links and rows.
- [](/docs/tutorials/alu_age) plots a BED column as bars colored by another
  column and counts the rows per zoom-following bin.
- [](/docs/tutorials/read_marks) plots a BAM's fields: depth as a coverage step,
  insert size as a point per pair on a separate track, the reads stacked and
  colored by a ramp, and a derived BED scanning a chromosome.

## When a plugin is the next step

A drawing that is not a bar, a point, a rule, a rect or a label needs a new
**mark type**: one shader, one painter and one hit test, declared as a mark over
the same worker channels this display reads. See
[](/docs/developer_guides/creating_gpu_display) to write one. A display that
uses a custom feature layout, or that gives a channel a meaning the encoding
cannot express, such as Manhattan's color by LD to an index SNP, is the next
step after that. See [](/docs/developer_guides/plotting_features) to compose
one.
