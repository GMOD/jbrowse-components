---
title: Customizing feature colors
description: Per-feature color callbacks using jexl or plugin code
guide_category: Callbacks
---

Set a track's `color` in `displayDefaults` as a plain CSS color, an object that
paints each value of a field with a key, or a `jexl:` expression. When the logic
outgrows one jexl line, add a function to the jexl language with a small plugin
and call it from your callback.

The object forms (a color per `type`, chosen colors, a threshold, a gradient)
are in the [cookbook](/docs/cookbook#colors). Past those, a plugin file
registers a function and the callback calls it:

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "esmLoc": { "uri": "myplugin.js" }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "my_track",
      "name": "my track",
      "assemblyNames": ["hg19"],
      "adapter": {
        "type": "Gff3Adapter",
        "uri": "volvox.filtered.gff"
      },
      "displayDefaults": { "color": "jexl:customColor(feature)" }
    }
  ]
}
```

The
[no-build plugin tutorial](/docs/developer_guides/no_build_plugin#adding-a-jexl-callback)
is the `myplugin.js` that defines `customColor`: a single file beside the
config, no build step. In a jexl expression the feature's attributes are plain
properties (`feature.type`); in the plugin's JavaScript the same feature is a
`SimpleFeature`, read with `feature.get('type')`
([property access vs `get()`](/docs/config_guides/jexl#property-access-vs-get)).

<!-- GOTCHA BedAdapter START -->

:::caution Gotcha

Named BED columns past `name`/`score`/`strand` (`itemRgb`, `thickStart`, ...)
are only guaranteed for BED12 or a track with an `autoSql`/`columnNames`. For a
BED7-BED11 file JBrowse cannot know what the extra columns mean, so it exposes
them generically as `field6`, `field7`, ... and a jexl callback reading
`feature.itemRgb` gets `undefined`. Set `columnNames` to refer to them by name.

:::

<!-- GOTCHA BedAdapter END -->

An unset [`color`](/docs/config/linearcanvasbasedisplay/#slot-color) paints each
feature from the colors a BED has, under whichever of those names they land, so
a callback is only needed to override that.

## Reading the type list off the file

A `color` object with chosen colors per `type` is only as good as its `domain`,
so read the types off the file. The `/^##FASTA/{exit}` stops before any inline
sequence, whose lines have no `#` and would otherwise count as types:

```bash
awk -F'\t' '/^##FASTA/{exit} !/^#/{print $3}' annotations.gff |
  sort | uniq -c | sort -rn
```

A type the `domain` does not list takes the next palette color and its own row
in the key, so an unexpected row there is the signal to go back to that list. A
worked case: the
[EBI mobilome annotation pipeline](https://github.com/EBI-Metagenomics/mobilome-annotation-pipeline)
writes a GFF whose column 3 holds mobile element types (published per genome
under MGnify's
[`mgnify_genomes`](https://ftp.ebi.ac.uk/pub/databases/metagenomics/mgnify_genomes/)
as `<accession>_mobilome.gff`), so with no `color` the whole mobilome paints one
color. One `color` object separates the element classes and greys the passenger
CDSs back:

```json addtrack
{
  "trackId": "mobilome",
  "name": "Mobilome",
  "uri": "MGYG000000001_mobilome.gff",
  "assemblyNames": ["MGYG000000001"],
  "displayDefaults": {
    "color": {
      "field": "type",
      "domain": [
        "prophage",
        "viral_sequence",
        "plasmid",
        "insertion_sequence",
        "terminal_inverted_repeat_element",
        "inverted_repeat_element",
        "integron",
        "conjugative_integron",
        "attC_site",
        "compositional_outlier",
        "direct_repeat",
        "CDS"
      ],
      "range": [
        "#8e44ad",
        "#9b59b6",
        "#2980b9",
        "#e67e22",
        "#d35400",
        "#d35400",
        "#16a085",
        "#1abc9c",
        "#0e6655",
        "#c0392b",
        "#7f8c8d",
        "#bdc3c7"
      ]
    }
  }
}
```

- **Two names for the repeat flanks** because the pipeline renamed the type
  across releases, and a file uses whichever name its release used. A renamed
  type is the usual reason a key is missing.
- **The sequence is inline after `##FASTA`.** `Gff3Adapter` stops at that
  marker, so the whole file loads as-is. For a `bgzip`/`tabix` track, cut the
  file there first: the sequence lines are not tab-delimited and tabix cannot
  skip them.

## See also

- [](/docs/config_guides/jexl)
- [](/docs/config_guides/customizing_feature_details)
- [No-build plugin tutorial](/docs/developer_guides/no_build_plugin)
