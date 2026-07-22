---
title: Customizing feature colors
description: Per-feature color callbacks using jexl or plugin code
guide_category: Callbacks and customization
---

If a color callback has too much logic to express cleanly in
[jexl](/docs/config_guides/jexl), add a function to the jexl language with a
small plugin and call it from your jexl callback.

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
        "gffLocation": {
          "uri": "volvox.filtered.gff"
        }
      },
      "displayDefaults": { "color": "jexl:colorFeature(feature)" }
    }
  ]
}
```

The `color` is set with the
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays)
and works as a plain CSS color (`"displayDefaults": { "color": "green" }`) or,
as here, a `jexl:` expression evaluated per feature.

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

For color this rarely matters: a BED that carries its own colors needs no
callback, since an unset
[`color`](/docs/config/linearcanvasbasedisplay/#slot-color) slot paints each
feature from them under whichever of those names they land. Write a callback to
override that, or to read a color from some other column.

`myplugin.js` doesn't need the jbrowse-plugin-template if it's self-contained
and has no external imports. If it does import other modules, use the template.
For embedded components, see the
[inline plugins example](https://jbrowse.org/storybook/lgv/with-inline-plugins/).

## See also

- [Using jexl callbacks](/docs/config_guides/jexl)
- [Customizing feature details](/docs/config_guides/customizing_feature_details)
- [No-build plugin tutorial](/docs/developer_guides/no_build_plugin)
