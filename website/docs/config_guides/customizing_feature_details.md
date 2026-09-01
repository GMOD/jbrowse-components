---
title: Customizing feature details
description:
  Customizing feature detail panels and the About track dialog with the
  formatDetails and formatAbout slots
guide_category: Callbacks
---

**TL;DR:** the track slot `formatDetails` takes jexl callbacks that return an
object of fields to merge onto a feature: a new key adds a row, an existing key
overrides it, and `undefined`/`null` hides it. `formatAbout` does the same for
the About track dialog. For complex logic, register a jexl function in a small
plugin.

Here is an example track with a formatter:

```json addtrack
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
    "uri": "volvox.sort.gff3.gz"
  }
}
```

<Figure src="/img/customized_feature_details.png" caption="A feature detail panel reshaped by the formatDetails callback above. The red callout marks the name field, which the callback rewrote into an HTML hyperlink (here, a Google search for the gene name) instead of plain text. The same callback also injects the extra 'newfield' row and drops the default 'type' row."/>

This formatter links the `name` field to a Google search (useful for linking to
gene pages), adds a custom `newfield`, and removes `type` by setting it to
`undefined`. The `<a>` markup is needed here only because the link text (the
gene name) differs from the URL. A value that is nothing but a URL is
[linked for you](#bare-urls).

The `formatDetails` slots are:

- [`feature`](/docs/config/formatdetails/#slot-formatdetailsfeature) -
  customizes the top-level feature
- [`subfeatures`](/docs/config/formatdetails/#slot-formatdetailssubfeatures) -
  customizes the subfeatures, recursively up to `depth`
- [`depth`](/docs/config/formatdetails/#slot-formatdetailsdepth) - how many
  levels of subfeature `subfeatures` runs on
- [`maxDepth`](/docs/config/formatdetails/#slot-formatdetailsmaxdepth) - how
  many levels of subfeature card the panel renders at all, which is a separate
  question from how deep `subfeatures` formats

Use a jexl callback for `feature`, `subfeatures`, or both. Each returns an
object with the fields to replace.

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
row, `{name: ...}` rewrites the Name row, and so on. `length` counts as one,
even though the panel computes it from `start`/`end` rather than reading it off
the feature: name it and your value is shown, set it null and the row is gone.

If the callback returns something that is not an object, the tier is dropped
rather than merged. `"jexl:feature.name"` where `"jexl:{name:feature.name}"` was
meant produces no rows.

### Values are HTML, and bare URLs become links {#bare-urls}

Every value is run through an HTML sanitizer before it is shown, so `<b>`,
`<a>`, `<table>` and friends render as markup. A value that is not recognizable
HTML is escaped instead, which is why a VCF `<TRA>` allele still reads as
`<TRA>`.

**A value that is just a URL is turned into a link for you**:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_ncbi_link",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "volvox.sort.gff3.gz"
  },
  "formatDetails": {
    "feature": "jexl:{NCBI:'https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name}"
  }
}
```

Write the anchor by hand only when the link text has to differ from the URL.

### Static fields as a plain object

The slot holds any JSON value, and only a string starting with `jexl:` is
evaluated. For fields that are the same on every feature, write the object
directly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_static_fields",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "volvox.sort.gff3.gz"
  },
  "formatDetails": {
    "feature": {
      "Source": "GENCODE v44",
      "Contact": "helpdesk@example.org",
      "phase": null
    }
  }
}
```

## Session-wide `formatDetails`

The same four slots exist session-wide under
[`configuration.formatDetails`](/docs/config/formatdetails/), which applies to
every track at once:

```json
{
  "configuration": {
    "formatDetails": {
      "feature": "jexl:{Assembly:'hg19', score:undefined}",
      "subfeatures": "jexl:{Assembly:'hg19'}",
      "maxDepth": 2
    }
  }
}
```

Where both tiers are set:

- `feature` and `subfeatures` are **merged**, the track's object over the
  session's, so a track can rewrite individual keys the global callback added
  and leave the rest.
- `depth` and `maxDepth` **override**: a track's value wins, and the
  session-wide one applies to every track that doesn't set its own.

`formatAbout` works the same way, except that `hideUris` is OR'd rather than
overridden, so a session-wide `true` cannot be turned back on by a track.

### depth and maxDepth

Take a GFF3 gene, which nests three levels deep: gene, then mRNA, then exon and
CDS.

- `depth` bounds the **callback**. It defaults to 2, so `subfeatures` runs on
  the mRNAs and their exons and CDSs, but not deeper. Set it to 1 to reformat
  only the transcript rows.
- `maxDepth` bounds the **panel**. Unset there is no limit. Set it to 1 and the
  panel shows the transcript cards but not the exon and CDS cards inside them,
  whether or not anything reformatted them.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes_transcripts_only",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "volvox.sort.gff3.gz"
  },
  "formatDetails": {
    "subfeatures": "jexl:{Transcript:feature.name, phase:undefined}",
    "depth": 1,
    "maxDepth": 1
  }
}
```

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
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "volvox.sort.gff3.gz"
      },
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
rather than one field, which suits a GFF3 with several attributes to relabel.
New keys with spaces or custom capitalization are added as-is:

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

## The About track dialog

`formatAbout` is the same idea for the "About track" dialog, which shows a
track's own configuration rather than a feature. It has two slots, on the track
or session-wide as [`configuration.formatAbout`](/docs/config/formatabout/):

- [`hideUris`](/docs/config/formatabout/#slot-formatabouthideuris) drops every
  file location from the dialog. Session-wide and per-track are OR'd, so a
  session-wide `true` cannot be turned back on by a track. It hides the URLs
  from the dialog only, not from `config.json`, which the browser downloads
  either way.
- [`config`](/docs/config/formatabout/#slot-formataboutconfig) is a jexl
  callback returning an object merged over the config shown, applied exactly as
  `formatDetails.feature` is: a new key adds a row, an existing one overrides,
  `undefined`/`null` hides. Where both are set, the track's object is merged
  over the session's.

The callback's variable is `config`, not `feature`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "volvox.sort.gff3.gz"
  },
  "formatAbout": {
    "hideUris": true,
    "config": "jexl:{Source:'GENCODE v44',adapter:undefined}"
  }
}
```

`jbrowse add-assembly` and `add-track` accept the same thing through `--config`,
so a generated config can set it without a post-processing step; see
[](/docs/cli#jbrowse-add-assembly).

## Adding a panel or replacing the widget

`formatDetails` callbacks reshape the fields of an existing feature. To add an
entirely new section, or to replace the widget wholesale, use a plugin with
these extension points (see
[extension points](/docs/developer_guides/extension_points/)):

- `Core-extraFeaturePanel` - append a custom panel (your own React component)
  below the built-in sections
- `Core-replaceWidget` - wrap or replace the whole feature-details widget

## See also

- [](/docs/config_guides/jexl)
- [](/docs/config_guides/customizing_feature_colors)
- [](/docs/developer_guides/extension_points)
