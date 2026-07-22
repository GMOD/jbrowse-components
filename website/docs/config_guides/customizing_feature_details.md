---
title: Customizing feature details
description: Customizing feature detail panels with the formatDetails slot
guide_category: Callbacks and customization
---

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

<Figure src="/img/customized_feature_details.png" caption="A feature detail panel reshaped by the formatDetails callback above. The red callout marks the name field, which the callback rewrote into an HTML hyperlink (here, a Google search for the gene name) instead of plain text. The same callback also injects the extra 'newfield' row and drops the default 'type' row."/>

This formatter links the `name` field to a Google search, useful for linking to
gene pages. It also adds a custom `newfield` and removes `type` from the
display.

The schema for `formatDetails` is:

- `feature` - customizes the top-level feature
- `subfeatures` - customizes the subfeatures, recursively up to `depth`
- [`depth`](/docs/config/formatdetails/#slot-configurationformatdetailsdepth) -
  depth to customize the subfeatures to

Use a jexl callback for `feature`, `subfeatures`, or both. The callback returns
an object with the fields to replace.

In the example above we return an object with:

- `name` - customizes the name field with a link in the feature details
- `type` - we make this undefined, which removes it from the feature details
- `newfield` - this generates a new field in the feature details

## How the returned object is applied

The object you return is shallow-merged onto the feature (any keys you don't
mention are left untouched), and the result drives what the panel shows:

- a **new key** adds a field
- an **existing key** overrides that field's value (the raw value is replaced,
  not shown alongside)
- a key set to **`undefined` or `null`** hides the field. The panel filters out
  null-ish values, so either works. `null` is the more robust choice if you
  build the object in JavaScript, since a serialization round-trip (e.g. saving
  a session) turns hidden fields into `null` anyway.

This applies to core fields too: returning `{type: undefined}` removes the Type
row, `{name: ...}` rewrites the Name row, and so on.

## Making sophisticated customizations to feature detail panels

For complex customizations, register a jexl function in a plugin.

Create a small plugin file, `myplugin.js`:

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

Put `myplugin.js` in the same directory as your config file, then use the custom
`jexl` function in your config callbacks:

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

## More jexl function examples

The remaining examples are all bodies for `pluginManager.jexl.addFunction(...)`
in the same plugin file above. Only the function changes.

**Rename many attributes at once.** A jexl function can return a whole object
rather than one field, which scales better than inline jexl when a GFF3 has
several attributes to relabel. New keys with spaces or custom capitalization are
added as-is:

```js
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
```

Call it with `"feature": "jexl:formatFeature(feature)"`.

**Link out to dbxrefs.** Turn each `dbxref` into a link, falling back to plain
text for prefixes you don't handle:

```js
pluginManager.jexl.addFunction('linkout', feature => {
  if (!feature.dbxref) {
    return ''
  }
  const dbxrefs = Array.isArray(feature.dbxref)
    ? feature.dbxref
    : [feature.dbxref]
  return dbxrefs.map(dbxref => {
    const [prefix, ref] = dbxref.split(':')
    return prefix === 'Genbank' || prefix === 'GeneID'
      ? `<a href="https://www.ncbi.nlm.nih.gov/gene/?term=${ref}">${dbxref}</a>`
      : dbxref
  })
})
```

Call it on both levels so subfeatures get the links too:

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
      "name": "Genes",
      "assemblyNames": ["hg19"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "volvox.sort.gff3.gz"
      },
      "formatDetails": {
        "feature": "jexl:{dbxref:linkout(feature)}",
        "subfeatures": "jexl:{dbxref:linkout(feature)}"
      }
    }
  ]
}
```

The feature in `formatDetails` callbacks is a plain JS object, not a
`SimpleFeature`, because the detail panel reads from the serialized session. Use
property access (`feature.start`); `feature.get('start')` does **not** work
here. See
[property access vs `get()`](/docs/config_guides/jexl#property-access-vs-get)
for how this differs across callback types.

## Going beyond field formatting

`formatDetails` callbacks reshape the fields of an existing feature. To add an
entirely new section, or to replace the widget wholesale, use a plugin with
these extension points (see
[extension points](/docs/developer_guides/extension_points/)):

- `Core-extraFeaturePanel` - append a custom panel (your own React component)
  below the built-in sections
- `Core-replaceWidget` - wrap or replace the whole feature-details widget

## See also

- [Using jexl callbacks](/docs/config_guides/jexl)
- [Customizing feature colors](/docs/config_guides/customizing_feature_colors)
- [Extension points](/docs/developer_guides/extension_points)
