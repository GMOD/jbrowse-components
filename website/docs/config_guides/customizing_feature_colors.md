---
title: Customizing feature colors
description: Per-feature color callbacks using jexl or plugin code
guide_category: Callbacks
---

**TL;DR:** set a track's `color` in `displayDefaults`, either as a plain CSS
color or a `jexl:` expression. When the logic outgrows one jexl line, add a
function to the jexl language with a small plugin and call it from your
callback.

For example, create a file named `myplugin.js`:

```js
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0.0'
  install() {}
  configure(pluginManager) {
    pluginManager.jexl.addFunction('colorFeature', feature => {
      let type = feature.get('type')
      if (type === 'CDS') {
        return 'red'
      } else if (type === 'exon') {
        return 'green'
      } else {
        return 'purple'
      }
    })
  }
}
```

Put `myplugin.js` in the same directory as your config file and reference it:

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
      "displayDefaults": { "color": "jexl:colorFeature(feature)" }
    }
  ]
}
```

The `color` is set with the
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays):
a plain CSS color (`"color": "green"`) or, as here, a `jexl:` expression
evaluated per feature.

The feature is a `SimpleFeature`. In jexl color callbacks, read attributes as
plain properties, e.g. `feature.start`, `feature.refName`,
`feature.other_attribute`. In JavaScript plugin code (as above), the
`SimpleFeature` API is `feature.get('start')`. See
[property access vs `get()`](/docs/config_guides/jexl#property-access-vs-get).

See the [no-build plugin tutorial](/docs/developer_guides/no_build_plugin/) for
a full walkthrough.

<!-- GOTCHA BedAdapter START -->

:::caution Gotcha

Named BED columns past `name`/`score`/`strand` (`itemRgb`, `thickStart`, ...)
are only guaranteed for BED12 or a track with an `autoSql`/`columnNames`. For a
BED7-BED11 file JBrowse cannot know what the extra columns mean, so it exposes
them generically as `field6`, `field7`, ... and a jexl callback reading
`feature.itemRgb` gets `undefined`. Set `columnNames` to refer to them by name.

:::

<!-- GOTCHA BedAdapter END -->

For color this rarely matters: an unset
[`color`](/docs/config/linearcanvasbasedisplay/#slot-color) slot paints each
feature from the colors a BED carries, under whichever of those names they land.
Write a callback to override that, or to read a color from some other column.

`myplugin.js` works as-is when it is self-contained; use the
jbrowse-plugin-template if it imports other modules. For embedded components,
see the
[inline plugins example](https://jbrowse.org/storybook/lgv/plugins/#with-inline-plugins).

## Reading the type list off the file

A lookup-table callback keyed on `feature.type` is only as good as its keys, so
read the types off the file. The [cookbook](/docs/cookbook#colors) has the `awk`
one-liner that counts the types in a GFF3; this section works one file through
end to end.

The
[EBI mobilome annotation pipeline](https://github.com/EBI-Metagenomics/mobilome-annotation-pipeline)
emits a flat GFF whose column 3 carries mobile element types rather than genes,
so with no callback the whole mobilome paints in one default color. MGnify
publishes one per representative genome, alongside the genome FASTA and its
`.fai`, under
[`mgnify_genomes`](https://ftp.ebi.ac.uk/pub/databases/metagenomics/mgnify_genomes/)
(`<accession>_mobilome.gff`). A single table separates the element classes and
greys the passenger CDSs back so the elements read first:

```json
{
  "color": "jexl:{prophage:'#8e44ad',viral_sequence:'#9b59b6',plasmid:'#2980b9',insertion_sequence:'#e67e22',terminal_inverted_repeat_element:'#d35400',inverted_repeat_element:'#d35400',integron:'#16a085',conjugative_integron:'#1abc9c',attC_site:'#0e6655',compositional_outlier:'#c0392b',direct_repeat:'#7f8c8d',CDS:'#bdc3c7'}[feature.type] || 'gray'"
}
```

The repeat flanks appear under two names because that pipeline renamed the type
across releases, and a file carries whichever name the release that produced it
used. That is the usual reason a key is missing.

These GFFs carry their sequence inline after a `##FASTA` marker, which is most
of their size. `Gff3Adapter` reads them as-is and stops at the sequence, so a
whole-file track loads directly. For a `bgzip`/`tabix` indexed track, cut the
file at that marker first: the sequence lines are not tab-delimited and tabix
has no way to skip them.

## See also

- [](/docs/config_guides/jexl)
- [](/docs/config_guides/customizing_feature_details)
- [No-build plugin tutorial](/docs/developer_guides/no_build_plugin)
