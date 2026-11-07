---
title: Settings every track shares
description:
  The encoding, facet, rows and filter objects that every track type reads the
  same way, from a config, the track menu, Edit plot and a share link
guide_category: Track types
---

A track's appearance is set by a few objects that mean the same thing on every
track type. `encoding.color` sets how features are colored, `encoding.y` how a
value is plotted, `facet` how features split into sections, `rows` how a row
display orders and labels its rows, and `filter` which features are drawn. They
follow the grammar of graphics as Vega-Lite spells it, so a color written for a
gene track is written the same way for reads or variants, and the track menu,
the legend, "Edit plot..." and a share link all read and write the same object.

| Setting          | Says                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| `encoding.color` | unset, one constant color, or a field painted through a scale, with its key  |
| `encoding.y`     | the plotted field, its scale, its axis and any fixed reference lines         |
| `facet`          | the field that splits features into sections, and the order of the sections  |
| `rows`           | a row display's rows: which field names them, their order, labels and colors |
| `filter`         | a list of tests on fields; a feature failing any test is not drawn           |
| `marks`          | on the [mark display](/docs/config_guides/mark_display), the layers it draws |

Each display's page in the [config reference](/docs/config) lists which of these
it takes, and which members of each.

## Color

`encoding.color` is in one of three states. Unset, the track paints its own
default. A `value` paints every feature one color. A `field` paints each feature
by its value through a `scale`, and the track's key comes from the same object.
A bare field name is short for `{ "field": … }`. The same threshold object
applies to mapping quality on reads and to score on genes:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "reads_by_mapq",
  "name": "Reads (low MAPQ grey)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "encoding": {
      "color": {
        "field": "mapq",
        "scale": {
          "type": "threshold",
          "domain": [20],
          "range": ["#bbbbbb", "#0068d1"]
        }
      }
    }
  }
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_by_score",
  "name": "Genes (low score grey)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": {
    "encoding": {
      "color": {
        "field": "score",
        "scale": {
          "type": "threshold",
          "domain": [20],
          "range": ["#bbbbbb", "#0068d1"]
        }
      }
    }
  }
}
```

The recipes for each form (a color per value, chosen colors, a gradient, a
file's own colors) are in the [cookbook](/docs/cookbook#colors).

## Value scale

`encoding.y.scale` sets how a plotted value maps to height: its `type`
(`linear`, `log` or `symlog`), and `domainMin` and `domainMax` to pin its ends,
which otherwise follow the loaded data. Tracks giving the same name in `share`
autoscale on one axis. A display has one value scale, shared by everything it
plots and read by its axis. [](/docs/config_guides/quantitative_track) covers it
in full.

## Facet

`facet` names the field whose values split features into sections, and its
`sort` list names the sections that stack first. A `sort` orders sections and
never creates them. On a row display the field is a row attribute, such as a
sample sheet's `population`, and each section is a band of rows.
[](/docs/config_guides/grouping_and_ordering) works it through on gene,
alignments, variant and synteny tracks.

## Rows

A row display, such as a multi-sample variant track or a multi-signal
quantitative track, describes its rows in one `rows` object: the `field` that
names them, their `sort`, their `labels`, a clustering `tree` and a row `color`
read off sample metadata. On the variant and mark displays, where rows scroll,
`step` sets the row height or `"fit"`. The
[variant track guide](/docs/config_guides/variant_track) shows rows read from a
sample sheet.

## Filter

`filter` is a list of tests, each naming a `field` and one of `equal`, `oneOf`,
`lt`, `lte`, `gt`, `gte` or `valid`. A feature is drawn when it passes every
test. A `jexl:` string is accepted for a test no field states, and runs slower:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "reads_mapq20",
  "name": "Reads (MAPQ 20 and up)",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BamAdapter", "uri": "volvox-sorted.bam" },
  "displayDefaults": {
    "filter": [{ "field": "mapq", "gte": 20 }]
  }
}
```

## Editing the settings in the app

The track menu's **Advanced → Edit plot...** shows a track's grammar settings as
JSON, the same objects a config writes, with worked examples to start from. The
**Color by** and **Group by** menus write the same `encoding.color` and `facet`
objects, so an edit made from a menu reads back in Edit plot, is kept across a
reload and included in a share link.

## For plugin developers

A display joins this vocabulary by reading these objects through the shared
code.
[The grammar, stage by stage](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GRAMMAR_STAGES.md)
names the code behind each object, and
[the grammar of graphics spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GRAMMAR_OF_GRAPHICS.md)
the features declined so far.
