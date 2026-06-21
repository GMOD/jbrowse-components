---
title: Customizing feature colors with callbacks and plugins
description: Per-feature color callbacks using jexl or plugin code
guide_category: Callbacks and customization
---

If you have a color callback that has a lot of logic in it, then using jexl to
express all that logic may be hard. Instead, you can make a small plugin which
adds a function to the jexl language, and call that function in your jexl
callback.

For example, create a file named "myplugin.js" (see also the note below)

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

Put `myplugin.js` in the same folder as your config file and reference it:

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
      "displays": { "color": "jexl:colorFeature(feature)" }
    }
  ]
}
```

The `color` is set with the `displays` shorthand: put appearance settings in a
`displays` object and JBrowse applies each one for you, so you don't have to
know the display's name (`LinearBasicDisplay`) or write the `displays` array.
The same `color` works as a plain CSS color (`"displays": { "color": "green" }`)
or, as here, a `jexl:` expression evaluated per feature. For per-display control
you can still use the array form — see the
[track config guide](/docs/config_guides/tracks/#configuring-displays).

The feature is a `SimpleFeature` — use `feature.get('start')`,
`feature.get('refName')`, `feature.get('other_attribute')`, etc.

See the [no-build plugin tutorial](/docs/developer_guides/no_build_plugin/) for
a full walkthrough.

:::note BED column names in callbacks

Named BED columns such as `itemRgb` or `thickStart` (e.g.
`jexl:get(feature,'itemRgb')`) are only guaranteed for **BED12**, **bigBed**, or
any track configured with an `autoSql` or `columnNames`. For plaintext BED files
with fewer columns (BED7–BED11), JBrowse can't safely assume what each extra
column means, so columns past `name`/`score`/`strand` are exposed generically as
`field6`, `field7`, `field8`, … — `get(feature,'itemRgb')` returns `undefined`
there. To reference columns by stable name, add `columnNames` (or a full
`autoSql`) to the adapter config.

:::

:::note

`myplugin.js` doesn't need the jbrowse-plugin-template if it's self-contained
and has no external imports. If it does import other modules, use the template.
For embedded components, see the
[inline plugins example](https://jbrowse.org/storybook/lgv/with-inline-plugins/).

:::
