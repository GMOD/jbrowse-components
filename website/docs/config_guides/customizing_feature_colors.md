---
id: customizing_feature_colors
title: Customizing feature colors with callbacks and plugins
---

If you have a color callback that has a lot of logic in it, then using jexl to
express all that logic may be hard. Instead, you can make a small plugin which
adds a function to the jexl language, and call that function in your jexl
callback.

For example, create a file named "myplugin.js" (see also Footnote 1)

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
        "type": "Gff3TabixAdapter",
        "gffLocation": {
          "uri": "volvox.filtered.gff"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "mytrack-LinearBasicDisplay",
          "renderer": {
            "type": "SvgFeatureRenderer",
            "color1": "jexl:colorFeature(feature)"
          }
        }
      ]
    }
  ]
}
```

The feature is a `SimpleFeature` — use `feature.get('start')`,
`feature.get('refName')`, `feature.get('other_attribute')`, etc.

See the [no-build plugin tutorial](/docs/developer_guides/no_build_plugin/) for
a full walkthrough.

:::note

`myplugin.js` doesn't need the jbrowse-plugin-template if it's self-contained
and has no external imports. If it does import other modules, use the template.
For embedded components, see the
[storybook example](https://jbrowse.org/storybook/lgv/main/?path=/story/using-plugins--page).

:::
