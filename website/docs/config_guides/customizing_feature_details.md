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

This feature formatter changes the `"name"` field in the feature detail panel to
have a link to a google search for that feature's name. This can be used to link
to gene pages for example as well.

In addition, this example also adds a custom field called `"newfield"` and
removes e.g. `"type"` from being displayed.

The schema for `formatDetails` is:

- `feature` - customizes the top-level feature
- `subfeatures` - customizes the subfeatures, recursively up to `depth`
- `depth` - depth to customize the subfeatures to, default 1

The general way this is done is by making a jexl callback either or both of
`feature` and `subfeatures` (if you want both feature and subfeatures, you can
copy the same thing to both config slots).

The callback returns an object where the keys of the object are what you want to
replace.

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
;(function () {
  class MyPlugin {
    install() {}
    configure(pluginManager) {
      pluginManager.jexl.addFunction('formatName', feature => {
        return `<a href="${feature.name}">${feature.name}</a>`
      })
    }
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginMyPlugin = {
    default: MyPlugin,
  }
})()
```

Then you can put myplugin.js in the same directory as your config file, and can
use the custom `jexl` function in your config callbacks as follows:

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "umdLoc": { "uri": "myplugin.js" }
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

See [our no-build plugin tutorial](/docs/tutorials/no_build_plugin_tutorial/)
for more info on setting up a simple plugin for doing these customizations.

### Example: A generalized solution to dbxrefs

If you wanted to always link out to different websites mentioned in the dbxrefs
of your data file, you could make a jexl function such as the following

```js
// myplugin.js
;(function () {
  class MyPlugin {
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

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginMyPlugin = {
    default: MyPlugin,
  }
})()
```

And then in your config.json

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "umdLoc": { "uri": "myplugin.js" }
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

#### Footnote 1 - the feature details are serialized to plain JSON objects

Note that the feature for feature detail panels is different from that in the
color callback: it is a plain JS object. So instead of `feature.get('start')`,
you can say just `feature.start`. The reason it is different for the feature
details callbacks (compared with e.g. the color callbacks) is that the feature
is serialized into the session.

#### Footnote 2 - why are feature details plain JSON objects when other usages aren't?

You might also ask why aren't all features serialized or plain JSON objects
normally? Well, some feature types like alignments features benefit from only
being partially serialized e.g. getting only a couple attributes via
`feature.get('attribute')` (completely converting them to a raw JSON expression
is expensive). It is a little confusing, but that is why in the feature details,
you can access the plain JS object e.g. `feature.start` while in color callbacks
you use e.g. `feature.get('start')`.
