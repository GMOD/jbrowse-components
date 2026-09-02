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

The `<a>` markup is needed only because the link text differs from the URL; a
value that is nothing but a URL is [linked for you](#bare-urls). The slots
(`feature`, `subfeatures`, `depth`, `maxDepth`) are on the
[formatDetails config docs](/docs/config/formatdetails/).

## How the returned object is applied

The callback's object is shallow-merged onto the feature, and the result drives
the panel:

- **A new key** adds a row.
- **An existing key** replaces that row's value, core fields included:
  `{type: undefined}` removes the Type row, `{name: ...}` rewrites the Name row.
  `length` counts as one even though the panel computes it from `start`/`end`.
- **`undefined` or `null`** hides the row. `null` survives a serialization
  round-trip (saving a session turns `undefined` into `null` anyway).
- **A non-object return drops the tier.** `"jexl:feature.name"` where
  `"jexl:{name:feature.name}"` was meant produces no rows.

### Values are HTML, and bare URLs become links {#bare-urls}

Every value passes through an HTML sanitizer, so `<b>`, `<a>` and `<table>`
render as markup, and a value that is not recognizable HTML is escaped (a VCF
`<TRA>` allele still reads as `<TRA>`). A value that is just a URL becomes a
link on its own; the
[cookbook's details recipe](/docs/cookbook#labels-tooltips-details) links a gene
to NCBI that way.

### Static fields, depth and maxDepth

Only a string starting with `jexl:` is evaluated, so a field that is the same on
every feature is written as a plain object. A GFF3 gene nests three levels deep
(gene, mRNA, then exon and CDS), and two slots bound how far the panel goes:

- **`depth`** bounds the `subfeatures` callback. At `1` it reformats only the
  transcript rows.
- **`maxDepth`** bounds the panel. At `1` it shows the transcript cards but not
  the exon and CDS cards inside them, formatted or not.

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
    "feature": {
      "Source": "GENCODE v44",
      "Contact": "helpdesk@example.org",
      "phase": null
    },
    "subfeatures": "jexl:{Transcript:feature.name, phase:undefined}",
    "depth": 1,
    "maxDepth": 1
  }
}
```

## Session-wide `formatDetails`

The same four slots exist under
[`configuration.formatDetails`](/docs/config/formatdetails/), applied to every
track:

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

Where a track sets the same slot, `feature` and `subfeatures` objects are
**merged** (the track's keys over the session's) and `depth`/`maxDepth`
**override** (the track's value wins).

## Complex logic goes in a jexl function

Register a function from a small plugin, as the
[no-build plugin tutorial](/docs/developer_guides/no_build_plugin#adding-a-jexl-callback)
shows, and call it from the slot:
`"feature": "jexl:{name:formatName(feature)}"`. The function can return a whole
object (many attributes relabeled at once) or one value (a `dbxref` turned into
a link).

The feature a `formatDetails` callback receives is a plain object read from the
serialized session, so use property access (`feature.start`);
`feature.get('start')` fails here. See
[property access vs `get()`](/docs/config_guides/jexl#property-access-vs-get).

## The About track dialog

`formatAbout` reshapes the "About track" dialog the same way, on the track or
session-wide as [`configuration.formatAbout`](/docs/config/formatabout/). The
callback's variable is `config`, the track's own configuration:

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

- [`hideUris`](/docs/config/formatabout/#slot-formatabouthideuris) drops every
  file location from the dialog only; `config.json` still carries them. A
  session-wide `true` cannot be turned back on by a track.
- [`config`](/docs/config/formatabout/#slot-formataboutconfig) merges over the
  config shown, exactly as `formatDetails.feature` does.

## Adding a panel or replacing the widget

To add a section of your own or replace the widget wholesale, a plugin uses two
[extension points](/docs/developer_guides/extension_points/):

- `Core-extraFeaturePanel` appends a React component below the built-in sections
- `Core-replaceWidget` wraps or replaces the whole feature-details widget

## See also

- [](/docs/config_guides/jexl)
- [](/docs/config_guides/customizing_feature_colors)
- [](/docs/developer_guides/extension_points)
