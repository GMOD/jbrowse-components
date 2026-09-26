---
title: Mark display
description:
  A grammar of graphics over a feature, alignments, variant or quantitative
  track, where LinearMarkDisplay draws the bars, points, spans and labels its
  config declares
guide_category: Track types
---

`LinearMarkDisplay` is a grammar of graphics over a track, in the sense of
Vega-Lite or ggplot: a picture is declared as marks, encodings and transforms
rather than drawn by code. It goes on a `FeatureTrack`, an `AlignmentsTrack`, a
`VariantTrack`, a `QuantitativeTrack` or a `MultiQuantitativeTrack`, and draws a
`bar`, `point`, `span`, `text` or `link` per `marks` entry, each with an
`encoding` naming the fields that feed it, a `transform` list that can bin,
count, pack or measure coverage, and a zoom range it draws in.

Reach for it when a field is the picture: a BED score, a segment's log ratio, a
peak's signal and q-value, a read's MAPQ, a variant's `QUAL`. The format-typed
displays still own what is not a field — mismatches, genotypes, isoform tiering.

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
          "mark": "bar",
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

Listing the display first makes it the one the track opens with. Every other
slot has a default: `x` is `start`, `x2` is `end`, bars grow from an `origin` of
0, and the axis autoscales to what is on screen.

## The vocabulary, for a ggplot2 or Vega-Lite reader

A reader who knows ggplot2 or Vega-Lite can read a `marks` config through the
names those libraries use. Each row is one idea; the last column is where this
display spells it, and the sections below take each in turn. GenomeSpy shares
Vega-Lite's names and adds the genomic transforms, so it appears where it adds
one.

<!-- prettier-ignore -->
| Idea | ggplot2 | Vega-Lite, GenomeSpy | `LinearMarkDisplay` |
| --- | --- | --- | --- |
| a bar from a baseline to a value | `geom_col()` | `"mark": "bar"` | `"mark": "bar"`, the display's `origin` as the baseline |
| a point at a value | `geom_point(size)` | `"mark": "point"`, `"size"` on the mark | `"mark": "point"`, `size` on the mark |
| a band across the plot, with no value | `geom_rect()` with no y | `"mark": "rect"` over `x` and `x2` alone | `"mark": "span"` |
| the field a mark plots | `aes(y = score)` | `"y": {"field": "score"}` | `"encoding": {"y": "score"}` |
| a value computed on the way in | `mutate()` before the plot | `{"calculate": …, "as": …}` | `{"type": "formula", "expr": …, "as": …}` |
| a colour per category | `aes(fill = strand)` | `"color": {"field": "strand", "type": "nominal"}` | `"color": {"field": "strand", "scale": "categorical"}` |
| which colours, in which order | `scale_fill_manual(values, breaks)` | `"scale": {"domain": […], "range": […]}` | `domain` and `range` on the colour |
| a colour ramp over a number | `scale_fill_viridis_c()`, `scale_fill_gradientn(colours)` | `"type": "quantitative"`, `"scale": {"scheme"}` | `"scale": "linear"` with `scheme` or `range` |
| the ramp's middle stop at a value | `scale_fill_gradient2(midpoint)` | `"scale": {"domainMid"}` | `domainMid` on the colour |
| a colour per interval of a number | `cut()` into `scale_fill_manual(values)` | `"scale": {"type": "threshold", "domain", "range"}` | `"scale": "threshold"`, `domain` holding the cuts |
| a shape per category | `aes(shape = svtype)` | `"shape": {"field": "svtype"}` | `"shape": {"field": "svtype", "scale": "categorical"}` |
| a log axis | `scale_y_log10()` | `"y": {"scale": {"type": "log"}}` | `"scales": {"y": {"type": "log"}}` |
| a log-like axis through zero | `scale_y_continuous(transform = "pseudo_log")` | `"y": {"scale": {"type": "symlog", "constant"}}` | `"scales": {"y": {"type": "symlog", "symlogConstant"}}` |
| fixed axis ends | `coord_cartesian(ylim)` | `"scale": {"domain": [lo, hi]}` | `domainMin` and `domainMax` on `scales.y` |
| one axis over a faceted plot | `facet_*(scales = "fixed")` | the default | always: every section and row reads the display's one `scales.y` |
| one axis over several tracks | — | `"resolve": {"scale": {"y": "shared"}}` on a concatenation | `scales.y.autoscaleGroup` |
| an axis caption | `labs(y = "…")` | `"axis": {"title"}` | `scales.y.title` |
| a key heading | `labs(fill = "…")` | `"legend": {"title"}` | `title` on the colour |
| which values the key lists | `scale_fill_manual(breaks)` | `"legend": {"values"}` | `breaks` on the colour or shape |
| a stepped key, highest first | `guide_legend(reverse = TRUE)` | | `descending` on a threshold colour |
| a horizontal line at a value | `geom_hline(yintercept)` | `"mark": "rule"` with a `datum` | `scales.y.rules` |
| a histogram | `geom_histogram(binwidth)` | `{"bin": {"step"}}` then `{"aggregate": [{"op": "count"}]}` | `{"type": "bin", "step"}` then `{"type": "aggregate", "ops": [{"op": "count"}]}` |
| a summary per bin | `stat_summary_bin(fun = mean)` | `bin` then `aggregate` with `"op": "mean"` | `bin` then `aggregate` with `"op": "mean"` |
| keep some of the rows | `filter()` before the plot | `{"filter": …}` | `{"type": "filter", "expr": …}`, or the display's `jexlFilters` |
| one row per element of a list field | `tidyr::unnest()` | `{"flatten": [field]}` | `{"type": "flatten", "field"}` |
| how many features overlap each position | | GenomeSpy `{"type": "coverage"}` | `{"type": "coverage"}` |
| overlapping features stacked into rows | | GenomeSpy `{"type": "pileup", "as": "lane"}` | `{"type": "pileup"}`, read by the mark's `row` |
| a label at each feature | `geom_text(aes(label = name), check_overlap = TRUE)` | `"mark": "text"`, `"text": {"field": "name"}` | `"mark": "text"`, `"encoding": {"text": "name"}` |
| a curve between two positions | `geom_curve(aes(x, xend))` | GenomeSpy `"mark": "link"`, `"x2"` | `"mark": "link"`, `x` to `x2` |
| a stroke width per feature | `aes(linewidth = score)` | `"size": {"field": "score"}` | `"encoding": {"size": {"field": "score"}}` on a link |
| a record's other end | | | `{"type": "mate"}`, which a link's `x2` then reads |
| a band of the plot per category | `facet_grid(rows = vars(sample))` | `"row": {"field": "sample"}` | `"facet": "sample"`, or `"rows": "sample"` for one row each |
| layers drawn in order | `+ geom_…()` | `"layer": […]` | `marks`, in list order |
| a layer that draws at some zooms only | | GenomeSpy `multiscale` with `stops` | `minBpPerPx` and `maxBpPerPx` on the mark |
| a polar plot | `coord_polar()` | | the circular view, over the same config |

Two names mean something else here. Vega-Lite's `row` is a facet channel; on
this display `encoding.row` is the band a feature stands in, the integer a
`pileup` step writes, and the facet is the display's own `facet`. And a
positional channel is a bare field where Vega-Lite's carries a scale, because
the y scale is the display's `scales.y` and every mark reads one axis. Stacked
bars and an `opacity` channel have no row: a bar stands on its own from the
baseline. A point's diameter is its mark's `size`, and a link's stroke is its
`encoding.size`.

## The encoding

Each mark's `encoding` maps feature fields to the channels its type reads:

| Channel | Read by                | Value                                                                                                                                                                                                        |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `x`     | every mark             | a field holding the left edge in bp; `start` by default                                                                                                                                                      |
| `x2`    | every mark             | the right edge; `end` by default                                                                                                                                                                             |
| `y`     | `bar`, `point`, `text` | the field plotted on the score axis, read through the display's `scales.y` (below); a feature whose value is not a finite number is skipped. A `text` may leave it empty and stand in the middle of its band |
| `row`   | every mark             | an integer field naming the band the mark stands in, from 0; missing is 0, and left empty it follows the last `pileup` step before it, this mark's own, the facet's or the display's                         |
| `color` | every mark             | a CSS colour, a jexl callback returning one, or a scale (below)                                                                                                                                              |
| `shape` | `point`                | `circle`, `triangle-down` or `diamond`, a jexl callback returning one, or a categorical scale (below)                                                                                                        |
| `text`  | `text`                 | the field printed, `name` by default; a feature with nothing there prints nothing                                                                                                                            |

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
    "marks": [{ "mark": "bar", "encoding": { "y": "score" } }]
  }
]
```

`type` is `linear` (the default), `log` or `symlog`, which reads like `log` away
from zero and stays linear through it, so values reaching or crossing 0 keep
their place; `symlogConstant` sets how wide that linear region is. An end left
unset autoscales over the loaded regions, and `autoscale` chooses how it is
taken. The axis, its ticks, its cross-hatches and the bars read this one
declaration, and so does **Set min/max score...**.

Every mark drawing at the current zoom folds into that one domain, the way a
grammar of graphics gives one scale per aesthetic. With a multiscale pair
(below) only one mark draws, so the axis is that mark's.

`autoscaleGroup` shares the axis across tracks: every track in the view naming
the same group autoscales over all of their data, so a plot and a wiggle or
coverage track stay comparable as the view moves. An end one track pins stays
its own. The score menu's **Autoscale with other tracks...** writes it.

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
`rows` carries the one caption beside its bands.

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
    "mark": "bar",
    "transform": [{ "type": "coverage" }],
    "encoding": { "color": "#c8d8ee" },
    "minBpPerPx": 20
  },
  { "mark": "point", "encoding": { "y": "score" }, "maxBpPerPx": 20 }
]
```

The coverage draws zoomed out and the per-read value zoomed in, and the axis at
each zoom is the drawing mark's. A right-hand second axis was withdrawn in
v5.0.0: the reader of that picture cannot tell which bars belong to which
numbers.

## Colour scales

`color` as a string paints every feature that colour, or whatever a jexl
callback answers. As an object it binds a field to a scale, and the legend reads
the same table the colours came from.

- **categorical** —
  `{ "field": "strand", "scale": "categorical", "range": ["#1f77b4", "#ff7f0e"] }`

  Each distinct value takes a colour derived from itself, so every region paints
  it alike. `domain` lists values in legend order and spends `range` from the
  first entry; values it leaves out follow, sorted. One row per colour, so two
  values painted alike share a row. A key of one colour, or over 20 rows, is not
  drawn.

- **linear** or **log** —
  `{ "field": "signal", "scale": "linear", "domainMin": 0, "domainMax": 50, "range": ["white", "red"] }`

  `scheme` names a ramp in place of `range`, and `reverse` turns either round.
  An end left off spans every loaded region and moves as you pan, so pin both
  for a figure and one for a floor or a ceiling. `domainMid` places the middle
  stop, which is how a diverging ramp centres on zero inside an asymmetric
  domain.

- **threshold** —
  `{ "field": "signal", "scale": "threshold", "domain": [10, 50], "range": ["#eee", "#f90", "#c00"] }`

  Each cut in `domain` opens an interval, so `range` carries one colour more.
  The key lists a row per interval, and a grey one for features with no value.

`title` heads the key and has the axis `title`'s three states: unset reads the
`field` name, text is that text, `""` draws no heading. Marks share one key only
under one title, and share a ramp only with both ends pinned.

Three more members shape the key and paint nothing. `breaks` lists only the
values it names, in that order, while every value still takes its colour.
`descending` lists a threshold's intervals from the highest down. `missingLabel`
names the grey row for features with nothing in the field.

## Shape scales

A scale belongs to a channel, not only to colour. `shape` takes the same
categorical form — `{ "field": "svtype", "scale": "categorical" }` — with
`range` listing the shapes to hand out as a colour scale's lists colours
(`circle`, `triangle-down`, `diamond` in that order when left off) and `domain`
the values in legend order. The legend then carries a second key whose swatches
are the shapes themselves:

```json
{
  "mark": "point",
  "encoding": {
    "y": "score",
    "color": { "field": "strand", "scale": "categorical" },
    "shape": {
      "field": "svtype",
      "scale": "categorical",
      "domain": ["INS", "DEL"],
      "range": ["triangle-down", "diamond"]
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
  { "mark": "bar", "encoding": { "y": "score" } },
  {
    "mark": "point",
    "encoding": {
      "y": "score",
      "color": "jexl:feature.name=='EDEN.1' ? 'red' : 'blue'"
    }
  }
]
```

A point's `size` is its diameter in px. A point whose `x` to `x2` is wider than
its glyph draws as a bar of the glyph's height across that span, so a shape
scale shows on a SNP and not on a wide deletion; `"x2": "start"` marks each
feature at one position whatever its length.

A `span` has no `y`: it paints a band from `x` to `x2` in its colour, for an
interval whose extent is the point. With no `row` every span shares one band;
with one — `{ "mark": "span", "encoding": { "row": "sampleIndex" } }` — the plot
divides into as many bands as the highest row on screen needs.

## Labels

A `text` mark prints a field at each feature: over the middle of its `x` to
`x2`, just above its `y` where the mark names one, and in the middle of its row
band where it does not. Bars with each feature's name over them:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "labelled_scores",
  "name": "Scores with labels",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/scores.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "labelled_scores-LinearMarkDisplay",
      "marks": [
        { "mark": "bar", "encoding": { "y": "score", "color": "#c8d8ee" } },
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

Labels are placed left to right, and one overlapping a label already placed, or
running off the edge, is left out — ggplot2's `check_overlap`. One sitting too
near the top of its band goes under the value instead. The text takes the mark's
`color`, or the theme's, with a halo so it reads over the bars, and answers no
hover; the mark it labels does.

Every feature whose middle is in view is a candidate before the culling, so a
text mark wants a `maxBpPerPx` that stops it once the features outrun the
labels. On the circular view the labels stand on the linear track only.

## Links

A `link` mark draws a curve from `x` up and over to `x2`. Over a BED with
start-end pairs that is the feature's own two ends, and `size` strokes each
curve by a field through a linear or log scale into a range of pixels. Splice
junctions from a STAR file, stroked by read support and labelled with it:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "junctions",
  "name": "Splice junctions",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/junctions.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "junctions-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "encoding": {
            "size": { "field": "score", "scale": "log", "range": [1, 8] }
          }
        },
        { "mark": "text", "encoding": { "text": "score" }, "maxBpPerPx": 50 }
      ]
    }
  ]
}
```

A paired record names its other end elsewhere: a BEDPE or STAR-Fusion adapter
fills a `mate` field, and a VCF states each end in an `ALT`. The `mate` step
reads either into `mate.refName`, `mate.start` and `mate.end`, one feature per
end, with `svtype` beside them; `x2` then names those as a locus, so a mate on
another chromosome draws wherever the view shows it.

**A track whose records name a mate draws the links with nothing configured**:
pick **Marks** from the track menu's display types over a BEDPE, a STAR-Fusion
file or an SV VCF and the display writes the mark and the step below for itself.
Write them out to say more — a colour by type, a stroke by score, a shape:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "sv_calls",
  "name": "SV calls",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://example.com/sv.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "sv_calls-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "size": 2,
          "encoding": { "color": { "field": "svtype" } },
          "transform": [{ "type": "mate" }]
        }
      ]
    }
  ]
}
```

The apex of a link is its half-width, clamped to the band under
`linkShape: "dome"` (the default) and a true semicircle under `"arc"`; a `y`
puts it at a value on the display's axis instead, so a link plotted by its score
rises to it. `"line"` draws a straight segment between the two ends, on the
baseline or at the `y` value. A pair wider than three screens straightens into a
leg rising from each end, and a mate the view does not show draws a short stem
at the end it does. A link answers a hover and a click along its stroke, and the
SVG export carries it as a path.

## Facets

The display's `facet` gives each value of a field its own band of rows, named by
a chip a reader can hide the section from. The facet splits the features first,
runs its own `transform` over each section alone, and every mark then runs its
own steps over each section, so a `pileup` in the facet's `transform` packs each
section on its own rows with every mark standing in them, and a `coverage` in a
mark's counts each section's depth:

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "facet": { "field": "sample", "transform": [{ "type": "pileup" }] },
    "marks": [{ "mark": "span" }]
  }
]
```

A `pileup` in the display's own `transform` runs before the split, so it packs
across every section and leaves each section the rows the others fill; the
facet's is the one that packs per section.

The field is read the way a channel reads one: a name, a dotted path
(`INFO.SVTYPE`), or a `jexl:` expression. Where the value has to be computed
first, the display's own `transform` runs before the split:

Sections order a name holding a number by that number, so chr2 before chr10, and
the rest by code point. `domain` sets the order: listed values first, the rest
sorted after. Past forty sections the tail merges into one, so a domain orders
the sections and never changes which exist.

**Sections** in the track menu lists the sections drawn, each with **Move up**,
**Move down** and **Hide section**; a move writes the drawn order back as the
facet's `domain`, and **Reset section order** clears it. A hidden section leaves
the legend and the value axis along with the plot.

<Figure src="/img/mark_display/facet.png" caption="HG002 ONT reads faceted by their HP tag: each haplotype's reads packed into a separate band under the chip that names it, and the untagged reads in a third."/>

`facet` and its `domain` are the same slot and the same ordering rule the gene,
alignments, variant, multiway synteny and multi-row displays each take their own
way — [grouping and lane order](/docs/config_guides/grouping_and_ordering) has
the shared mechanism across all of them.

## Rows

The display's `rows` gives each value of a field one row, for bar and point
marks: over a multi-BigWig, whose features carry the file they came from in
`source`, it draws one xyplot per file, the value axis repeated on each row tall
enough to hold it.

```json
"displays": [
  {
    "type": "LinearMarkDisplay",
    "rows": "source",
    "marks": [{ "mark": "bar", "encoding": { "y": "score" } }]
  }
]
```

A label names each row, and the track menu carries what the other row displays
have: **Cluster rows by similarity...**, **Edit colors/arrangement...**, and
**Sort rows by value here** on a right-click. As an object `rows` takes the
order too — `{ "field": "source", "domain": ["tumor", "normal"] }` — and a
reorder, a clustering run or a clade off the tree is written there, so undo,
**Reset row order** and a share link all reach it.

`facet` and `rows` both split the features on a field, and differ in what a
value gets: a facet section is as deep as its packing and wears a chip, where a
row is one row. Beside a facet the facet draws: on the same field that is the
whole picture, and on another it asks for bands of rows, which are not drawn
yet, so the track says so. A mark display picked from the track menu over a
multi-BigWig opens with `rows: "source"`, a row per file in the adapter's order,
unless the display already names a `facet` or `rows`.

## Transforms

A mark's `transform` is a list of steps over the region's features, run in the
worker before the encoding, in order, each reading what the last answered. The
display's own `transform` takes the same steps and runs before every mark's.
Each step names its `type` and takes that step's own settings, which the
[MarkTransform config reference](/docs/config/marktransform) lists; a key
belonging to another step is refused where the config is read:

| Step        | What it does                                                                                                                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`    | keeps the features a jexl `expr` admits                                                                                                                                                                                                                                                  |
| `formula`   | writes a jexl `expr`'s value into the field `as`                                                                                                                                                                                                                                         |
| `bin`       | snaps each feature to the `step`-bp bin its `field` (`start`) falls in, writing the bin's edges to the two fields `as` names (`start`, `end`)                                                                                                                                            |
| `aggregate` | folds each group of features sharing the `groupby` fields into one, with each of `ops` — `count`, or `sum`/`mean`/`min`/`max` of a `field` — as a new field; an empty `groupby` takes the edges the last `bin` before it wrote, in this mark's `transform`, the facet's or the display's |
| `coverage`  | replaces the features with runs of how many overlap each stretch, in the field `as` (`coverage`)                                                                                                                                                                                         |
| `flatten`   | fans each feature out into one per element of an array `field` (`subfeatures`), each reading its parent for what it lacks, with its position in the field `index` names; `keepEmpty` holds on to a feature whose array is empty                                                          |
| `pileup`    | writes each feature's row in a greedy first-fit packing into `as` (`row`), reading the interval `fields` (`start`, `end`) and keeping `padding` bp between two features on one row                                                                                                       |

A field a step reads is a name or a dotted path into a structured field, so a
VCF's `INFO.DP` is the `field` of a `mean` and `INFO.SVTYPE` a `groupby`. A
computed value is a `formula`'s to write, for the steps after it to read.

A `bin` then an `aggregate` is a density: one bar per bin, its height the count
of features starting in it. The `aggregate` groups by the edges the `bin` wrote
unless it names its own, whether that `bin` sits in the same `transform` or in
the display's.

The aggregate's fields are `count` and `mean_score` here, and either can feed
`y` or a colour scale. `coverage` answers the other question — how many features
overlap each position — for a repeat annotation, a set of peaks or any interval
file with no summary track beside it:

```json
{
  "mark": "bar",
  "transform": [{ "type": "coverage" }]
}
```

A mark that names no `y` plots what its steps wrote, the way a ggplot2 stat
names what its geom draws (`after_stat`): the depth a `coverage` writes, or the
one summary an `aggregate` with a single op writes. An aggregate writing two
summaries leaves the choice to `y`. A link behind a `mate` step reaches the
other end the step found without naming `x2`, and a written channel always wins.

`pileup` is the packing a read pileup is, said as a step. It writes the lowest
row on which each feature overlaps nothing already there, and a `span` reading
that row draws the packing:

```json
{
  "mark": "span",
  "transform": [{ "type": "pileup", "padding": 10 }],
  "encoding": {
    "row": "row",
    "color": { "field": "strand", "scale": "categorical" }
  }
}
```

Over an `AlignmentsTrack` that is a declared pileup, coloured by any field a
read answers. A mark whose `encoding.row` is empty reads the field the last
`pileup` before it wrote — its own, the facet's or the display's — so
`"encoding": {}` draws the packing. The plot takes as many bands as the highest
row needs, so rows thin as depth grows and the track keeps its height.

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

<Figure src="/img/mark_display/multiscale.png" caption="One Alu track, twice: across 3 Mb the binned mark draws and the axis is elements per 10 kb; across 30 kb the raw mark draws and the axis is each element's divergence from its consensus."/>

A mark outside its range is off entirely — not drawn, not hovered, and out of
the y-axis, the legend and the row count — so the axis at each zoom is the
drawing mark's. `scales.y.title` holds at every zoom, so a pair plotting two
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

### Past the fetch budget

A bin summarizes only what the fetch admits, and a wide enough view is over the
byte budget, where a track normally shows "region too large". Give the adapter a
density sidecar — a features-per-bin BigWig, which `jbrowse make-density` writes
— and mark one layer `"source": "density"`, and that layer draws the sidecar's
bins there instead of the banner:

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
      { "mark": "bar", "encoding": { "y": "score" }, "maxBpPerPx": 100 },
      {
        "mark": "bar",
        "source": "density",
        "transform": [
          { "type": "bin", "step": "auto" },
          { "type": "aggregate", "ops": [{ "op": "count" }] }
        ],
        "minBpPerPx": 100
      }
    ]
  }
]
```

Under the budget the density mark counts the features it fetched; the `source`
takes over only past it. The sidecar's bars draw as any other — same axis, same
hover, same SVG export — and hovering reads out the bin's count. Other marks
draw nothing there, a corner chip names the sidecar, and the track menu's
**Density band** submenu switches between Automatic, Features only and Density
only, and carries the Force-load. Clicking a bin opens nothing: reading the
features back is the download the budget refused. With no `"source": "density"`
the banner appears unchanged.

<Figure src="/img/mark_display/density_sidecar.png" caption="Chromosome 1 end to end, past the budget: the Alu track's sidecar bins draw as the density mark, with the chip in the corner naming what is on screen."/>

## When a config cannot draw as written

A `marks` list loads whenever its keys and value types are right, and the
display draws what it can. Where two slots disagree, the track shows a warning
chip in its corner naming the slot, and the mark when the slot is a mark's. A
`bar` or `point` naming no `y` draws nothing, and the rest are these, each
reported under its id:

<!-- MARK_RULES START -->

<!-- prettier-ignore -->
| Rule | Level | Reports |
| --- | --- | --- |
| `mark-without-value` | error | A bar or point naming no `y`, with no step before it writing one it reads by default. |
| `empty-zoom-range` | error | A `minBpPerPx` not below the mark's `maxBpPerPx`, so the mark never draws. |
| `step-expression` | error | A `filter` or `formula` whose `expr` is not a `jexl:` expression. |
| `bin-width` | error | A `bin` whose `step` is neither `"auto"` nor a positive width. |
| `op-field` | error | A `sum`, `mean`, `min` or `max` naming no `field`. |
| `step-field-expression` | error | A step's field written as a `jexl:` expression, where a step reads a name or a dotted path. |
| `unwritten-y` | error | A `y` naming a field that no `aggregate` or `coverage` step before it writes. |
| `unread-channel` | warning | A channel the mark's type does not read, such as `y` on a `span`. |
| `unread-size` | warning | A `size` on a mark that draws no point and strokes no link. |
| `unread-link-shape` | warning | A `linkShape` on a mark that draws no link. |
| `span-density-source` | warning | `source: "density"` on a `span` or a `text`, which cannot draw the sidecar's bins. |
| `threshold-cuts` | warning | Threshold cuts that repeat, leaving an interval no value falls in. |
| `threshold-no-cuts` | warning | A threshold colour naming no cut, so every value paints one colour. |
| `threshold-range` | warning | A threshold `range` not one colour longer than its cuts. |
| `ramp-domain` | warning | A `domain` on a linear or log colour, whose ends are `domainMin` and `domainMax`. |
| `ramp-ends` | warning | A colour ramp's `domainMax` below its `domainMin`. |
| `labels-domain` | warning | A colour's `labels` naming values its `domain` does not list, or no categorical scale's. |
| `unpinned-span-ramp` | warning | A span's or a text's colour ramp with an open end, whose colours then differ from one region to the next. |
| `step-pair` | warning | A `bin`'s `as` or a `pileup`'s `fields` naming other than two fields, so the step reads its defaults. |
| `value-beside-rows` | warning | A bar, point or text drawn beside a mark that stacks rows, standing in the first of them. |
| `two-packings` | warning | Two `pileup` steps packing one plot, whose rows share numbers. |
| `cross-section-packing` | warning | A `pileup` in the display's `transform` under a `facet`, packing across every section. |
| `second-density-mark` | warning | A second mark standing in for the density sidecar at a zoom where one already does. |
| `rows-beside-facet` | warning | `rows` beside a `facet` on another field, where the facet draws alone. |
| `packing-under-rows` | warning | A `pileup` or a `row` field under `rows`, whose packed rows share their value's one row. |

<!-- MARK_RULES END -->

`jbrowse validate` reports the same list over a config file, which has none of
the half-written states an editor passes through, at the level the table gives:
an error is a mark that draws nothing, never draws, or names a step that cannot
run. The display's own `transform` steps are checked the way a mark's are. Each
finding names the slot, and the mark when the slot is a mark's, and `--json`
carries the rule's id beside it.

## What the track menu offers

**Edit plot...** is the whole plot as controls. Above, the plot's own settings:
the field its sections stack by (`facet`) and the field that gives each value a
row (`rows`), each with the order its values take, and the axis every mark
stands on, with its title, type, pinned ends and grid. Below, the marks in paint
order on the left, and on the right the selected mark's type, its steps, and a
field picker per channel that type reads.

<Figure src="/img/mark_display/edit_plot.png" caption="Edit plot over an Alu track declaring a multiscale pair: the two marks in paint order on the left, and on the right the selected mark's type, a picker per channel a bar reads, and the zoom range that hands over to the binned count."/>

A picker takes free text as well as a scanned field or one the mark's steps
write, so `INFO.DP`, `count`, a `jexl:` expression or a constant all go through.
Under a field naming a scale sits the kind it reads through, then what that kind
reads: a categorical scale's values in order, their colours and their names in
the key; a threshold's cut points and a colour per interval; a ramp's `scheme`,
its `reverse`, the ends that pin it, its middle, and whether an open end follows
the extremes or a percentile — an end left empty spans the loaded regions, so
pinning both is what fixes a figure's colours. A list is comma-separated.
Changing the kind drops the members the new one does not paint.

A mark's steps are a list of their own, each named by what it writes, with its
settings in place and a list of common ones to add — a count per bin, a
coverage, a filter. A step writing a value fills a bar that names no `y`. Beside
**Add mark**, **Add zoomed-out density** appends the count per bin that draws
from 100 bp per px out and hands the marks above it the closer zooms.

The form shows rather than rewrites a channel the mark's type stopped reading,
and a far end naming its own sequence field. The rules run as you type and each
finding sits under the control that caused it. The corner notice opens the same
dialog.

**Edit as JSON...**, inside it, is the same plot as text, and **Back to form**
there returns. A setting left out stays as it is; `null` clears one. Neither
editor refuses a plot the rules complain about, since the display draws what it
can; Apply refuses only what a config file is refused for.

With no `marks` at all a display plots `score` as bars, links a record to the
other end it names, or opens the dialog where the fields say neither.

The score submenu writes `scales.y` through **Set min/max score...**, whose
dialog also fills both fields from the range on screen or empties them back to
autoscale. Beside it, **Point size**, **Show cross hatches**, the legend toggle,
and **Filter by...**, whose jexl runs in the worker before the encoding, so a
filtered feature is neither drawn nor in the axis. Hovering a mark shows its
location, value and colour class; clicking opens the feature, and clicking a
binned or coverage bar opens the bin remade over the features under it.

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

## Tutorials

- [](/docs/tutorials/alu_age) plots a BED column as bars coloured by another
  column, counts the rows per zoom-following bin and reads a density sidecar
  past the fetch budget.
- [](/docs/tutorials/read_marks) plots a BAM's own fields: depth as a coverage
  step, insert size as a point per pair on a track of its own, the reads stacked
  and coloured by a ramp, and a derived BED scanning a chromosome.

## When a plugin is the next step

A drawing that is not a bar, a point, a span or a label needs a **mark type** of
its own: one shader, one painter and one hit test, declared as a mark over the
same worker channels this display reads:
[](/docs/developer_guides/creating_gpu_display) writes one. A display that lays
features out its own way, or gives a channel a meaning the encoding cannot say —
Manhattan's colour by LD to an index SNP — is the rung after that, and
[](/docs/developer_guides/plotting_features) composes one.
