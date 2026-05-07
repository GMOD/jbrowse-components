---
id: customizing_feature_details
title: Customizing feature details with callbacks and plugins
---

import Figure from '../figure'

Every track has a configuration slot called `formatDetails`.

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

This formatter links the `name` field to a Google search — useful for linking
to gene pages. It also adds a custom `newfield` and removes `type` from the
display.

The schema for `formatDetails` is:

- `feature` - customizes the top-level feature
- `subfeatures` - customizes the subfeatures, recursively up to `depth`
- `depth` - depth to customize the subfeatures to, default 1

Use a jexl callback for `feature`, `subfeatures`, or both. The callback returns
an object with the fields to replace.

In the example above we return an object with:

- `name` - customizes the name field with a link in the feature details
- `type` - we make this undefined, which removes it from the feature details
- `newfield` - this generates a new field in the feature details

### Making sophisticated customizations to feature detail panels

If your feature detail panel customization is complex, you can create a custom
javascript function in a plugin that is registered with the jexl system.

You can make a small plugin file "myplugin.js"

```js
// myplugin.js
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0.0'
  install() {}
  configure(pluginManager) {
    pluginManager.jexl.addFunction('formatName', feature => {
      return `<a href="https://google.com/?q=${feature.name}">${feature.name}</a>`
    })
  }
}
```

Then you can put myplugin.js in the same directory as your config file, and can
use the custom `jexl` function in your config callbacks as follows:

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
      "trackId": "genes",
      "assemblyNames": ["hg19"],
      "name": "Genes",
      "formatDetails": {
        "feature": "jexl:{name:formatName(feature)}"
      }
    }
  ]
}
```

See [our no-build plugin tutorial](/docs/developer_guides/no_build_plugin/) for
more info on setting up a simple plugin for doing these customizations.

### Example: Renaming multiple GFF3 attributes with a single function

The `formatName` example above returns a single value for one field. You can
also return an entire object from your jexl function to rename, add, or remove
multiple fields at once. This is useful if your GFF3 file has attributes like
`gc_content` or `avg_read_depth` and you want them to display with proper
spacing and capitalization in the feature detail panel.

```js
// myplugin.js
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0.0'
  install() {}
  configure(pluginManager) {
    pluginManager.jexl.addFunction('formatFeature', feature => {
      const ret = {}
      if (feature.gc_content !== undefined) {
        ret.gc_content = undefined
        ret['GC Content'] = feature.gc_content
      }
      if (feature.avg_read_depth !== undefined) {
        ret.avg_read_depth = undefined
        ret['Average Read Depth'] = feature.avg_read_depth
      }
      return ret
    })
  }
}
```

Then in your config.json, the `formatDetails` callback is simply:

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
      "trackId": "genes",
      "assemblyNames": ["hg19"],
      "name": "Genes",
      "formatDetails": {
        "feature": "jexl:formatFeature(feature)"
      }
    }
  ]
}
```

The returned object is spread over the original feature attributes, so any keys
you don't include are left unchanged. Setting a key to `undefined` hides it, and
new keys with spaces or custom capitalization are added as-is. This approach
scales better than the inline jexl syntax when you have many attributes to
rename.

### Example: A generalized solution to dbxrefs

If you wanted to always link out to different websites mentioned in the dbxrefs
of your data file, you could make a jexl function such as the following

```js
// myplugin.js
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0.0'
  install() {}
  configure(pluginManager) {
    pluginManager.jexl.addFunction('linkout', feature => {
      // no dbxref found, so return empty string
      if (!feature.dbxref) {
        return ''
      }
      const dbxrefs = Array.isArray(feature.dbxref)
        ? feature.dbxref
        : [feature.dbxref]
      return dbxrefs.map(dbxref => {
        // customized link for Genbank dbxref
        if (dbxref.startsWith('Genbank:')) {
          const ref = dbxref.replace('Genbank:', '')
          return `<a href="https://www.ncbi.nlm.nih.gov/gene/?term=${ref}">${dbxref}</a>`
        }
        // customized link for GeneID dbxref
        else if (dbxref.startsWith('GeneID:')) {
          const ref = dbxref.replace('GeneID:', '')
          return `<a href="https://www.ncbi.nlm.nih.gov/gene/?term=${ref}">${dbxref}</a>`
        }
        // no link, just plaintext returned
        return dbxref
      })
    })
  }
}
```

And then in your config.json

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
      "trackId": "mytrack",
      "name":"My track",
      "adapter": {...},
      "formatDetails": {
        "feature": "jexl:{dbxref:linkout(feature)}",
        "subfeatures": "jexl:{dbxref:linkout(feature)}"
      }
    }
  ]
}
```

:::note

The feature in `formatDetails` callbacks is a plain JS object (not a
`SimpleFeature`), so use `feature.start` instead of `feature.get('start')`.
This is because the feature detail panel reads from the serialized session.
Alignment features are not fully serialized for performance reasons, which is
why color callbacks use `feature.get(...)` while detail callbacks use
`feature.*` directly.

:::
