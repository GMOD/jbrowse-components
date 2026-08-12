---
id: jbrowse1textsearchadapter
title: JBrowse1TextSearchAdapter
sidebar_label: Adapter -> JBrowse1TextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts).

## Example usage

An entry in `aggregateTextSearchAdapters`, pointing at the `names/` directory
JBrowse 1's `generate-names.pl` wrote — so an existing instance's search index
is reused rather than rebuilt with `jbrowse text-index`:

```js
{
  type: 'TextSearchAdapter',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'JBrowse1TextSearchAdapter',
    textSearchAdapterId: 'jbrowse1-names',
    namesIndexLocation: { uri: 'https://example.com/jbrowse1/data/names/' },
    assemblyNames: ['hg19'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

note: metadata about tracks and assemblies covered by text search adapter

### JBrowse1TextSearchAdapter - Identifier

Every JBrowse1TextSearchAdapter has a unique `textSearchAdapterId`, a required
top-level field that identifies it (not one of the config slots below).

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "JBrowse1TextSearchAdapter", ... }`. This adapter has no
`uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it
the location slots below. Slot types (`fileLocation`, `frozen`, ...) are
explained in the [config slot types reference](/docs/config_guides/slot_types).
Slots a base configuration contributes are listed here too, so this table is the
whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-namesindexlocation">**namesIndexLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/volvox/names', locationType: 'UriLocation' }</code> | the location of the JBrowse1 names index data directory |
| <span id="slot-tracks">**tracks**</span><br>`stringArray` = <code>[]</code> | List of tracks covered by text search adapter |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | List of assemblies covered by text search adapter |
