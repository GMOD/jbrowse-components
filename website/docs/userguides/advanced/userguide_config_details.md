---
id: userguide_config_details
title: Customizing the feature details panel
toplevel: true
---

import Figure from '../../figure'

Every track has a configuration called `formatDetails`.

Here is an example track with a formatter:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "assemblyNames": ["hg19"],
  "name": "Genes",
  "formatDetails": {
    "feature": "jexl:{name:'<a href=https://google.com/?q='+feature.name+'>'+feature.name+'</a>',newfield:'Custom contents here: '+feature.name,type:undefined }"
  },
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": {
      "uri": "volvox.sort.gff3.gz"
    },
    "index": {
      "location": {
        "uri": "volvox.sort.gff3.gz.tbi"
      }
    }
  }
}
```

<Figure src="/img/customized_feature_details.png" caption="Example screenshot showing customized feature detail panel with links"/>

This feature formatter changes the `"name"` field in the feature detail panel
to have a link to a google search for that feature's name. This can be used to
link to gene pages for example as well.

In addition, this example also adds a custom field called `"newfield"` and
removes e.g. `"type"` from being displayed.

The schema for `formatDetails` is:

- `feature` - customizes the top-level feature
- `subfeatures` - customizes the subfeatures, recursively up to `depth`
- `depth` - depth to customize the subfeatures to, default 1

The general way this is done is by making a jexl callback either or both of
`feature` and `subfeatures` (if you want both feature and subfeatures, you can copy the same thing to both config slots).

The callback returns an object where the keys of the object are what you want to replace.

In the example above we return an object with:

- `name` - customizes the name field with a link in the feature details
- `type` - we make this undefined, which removes it from the feature details
- `newfield` - this generates a new field in the feature details

### Making sophisticated customizations to feature detail panels

If your feature detail panel customization is complex, you can create a custom javascript function in a plugin that is registered with the jexl system e.g.

```js
class MyPlugin {
  install() {}
  configure(pluginManager: PluginManager) {
    pluginManager.jexl.addFunction('formatName', feature => {
      return `<a href="${feature.name}">${feature.name}</a>`
    })
  }
}
```

Then you can use the custom jexl function in your config callbacks as follows:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "assemblyNames": ["hg19"],
  "name": "Genes",
  "formatDetails": {
    "feature": "jexl:{name:formatName(feature)}"
  },
   ...
}
```

See our developer guides for more information regarding plugin development.
