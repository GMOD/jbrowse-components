---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
sidebar_label: Adapter -> TrixTextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `trix` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts).

## Example usage

`jbrowse text-index` writes this entry into `aggregateTextSearchAdapters` for
you. The `uri` shorthand points at the `.ix`; the sibling `.ixx` and
`_meta.json` are derived from it, so all three only need spelling out when
they are named against convention.
```js
{
  type: 'TextSearchAdapter',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: 'hg38-index',
    uri: 'trix/hg38.ix',
    assemblyNames: ['hg38'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

### TrixTextSearchAdapter - Identifier

Every TrixTextSearchAdapter has a unique `textSearchAdapterId`, a top-level field (not one of the config slots below) that identifies it; it is auto-generated when omitted.

an explicit `textSearchAdapterId` is still honored when given

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "TrixTextSearchAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ixfilepath">**ixFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ix', locationType: 'UriLocation' }</code> | location of the Trix `.ix` index written by `jbrowse text-index`: the sorted term-to-feature table the search box reads. |
| <span id="slot-ixxfilepath">**ixxFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ixx', locationType: 'UriLocation' }</code> | location of the `.ixx` prefix index, which records where in the `.ix` each prefix begins. It is what makes a lookup a couple of range requests instead of a download of the whole index. |
| <span id="slot-metafilepath">**metaFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'meta.json', locationType: 'UriLocation' }</code> | location of the `_meta.json` written beside the index, recording which tracks and assemblies it covers and the attributes it was built from. |
| <span id="slot-tracks">**tracks**</span><br>`stringArray` = <code>[]</code> | List of tracks covered by text search adapter |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | List of assemblies covered by text search adapter |
