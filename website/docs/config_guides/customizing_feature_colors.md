---
title: Customizing feature colors
description: Per-feature color callbacks using jexl or plugin code
guide_category: Callbacks
---

**TL;DR:** set a track's `color` in `displayDefaults`, either as a plain CSS
color or a `jexl:` expression. When the logic outgrows one jexl line, add a
function to the jexl language with a small plugin and call it from your
callback.

The one-line forms (a solid color, a lookup table keyed on `feature.type`, a
threshold, a gradient) are in the [cookbook](/docs/cookbook#colors). Past that,
a plugin file registers a function and the callback calls it:

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
feature from the colors a BED carries, under whichever of those names they land,
so a callback is only needed to override that.

## Reading the type list off the file

A lookup table keyed on `feature.type` is only as good as its keys, so read the
types off the file. The `/^##FASTA/{exit}` stops before any inline sequence,
whose lines carry no `#` and would otherwise count as types:

```bash
awk -F'\t' '/^##FASTA/{exit} !/^#/{print $3}' annotations.gff |
  sort | uniq -c | sort -rn
```

Any type missing from the table falls through to `|| 'gray'`, so gray on screen
is the signal to go back to that list. A worked case: the
[EBI mobilome annotation pipeline](https://github.com/EBI-Metagenomics/mobilome-annotation-pipeline)
writes a GFF whose column 3 carries mobile element types (published per genome
under MGnify's
[`mgnify_genomes`](https://ftp.ebi.ac.uk/pub/databases/metagenomics/mgnify_genomes/)
as `<accession>_mobilome.gff`), so with no callback the whole mobilome paints
one color. One table separates the element classes and greys the passenger CDSs
back:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "mobilome",
  "name": "Mobilome",
  "assemblyNames": ["MGYG000000001"],
  "adapter": {
    "type": "Gff3Adapter",
    "uri": "MGYG000000001_mobilome.gff"
  },
  "displayDefaults": {
    "color": "jexl:{prophage:'#8e44ad',viral_sequence:'#9b59b6',plasmid:'#2980b9',insertion_sequence:'#e67e22',terminal_inverted_repeat_element:'#d35400',inverted_repeat_element:'#d35400',integron:'#16a085',conjugative_integron:'#1abc9c',attC_site:'#0e6655',compositional_outlier:'#c0392b',direct_repeat:'#7f8c8d',CDS:'#bdc3c7'}[feature.type] || 'gray'"
  }
}
```

- **Two names for the repeat flanks** because the pipeline renamed the type
  across releases, and a file carries whichever name its release used. A renamed
  type is the usual reason a key is missing.
- **The sequence is inline after `##FASTA`.** `Gff3Adapter` stops at that
  marker, so the whole file loads as-is. For a `bgzip`/`tabix` track, cut the
  file there first: the sequence lines are not tab-delimited and tabix cannot
  skip them.

## See also

- [](/docs/config_guides/jexl)
- [](/docs/config_guides/customizing_feature_details)
- [No-build plugin tutorial](/docs/developer_guides/no_build_plugin)
