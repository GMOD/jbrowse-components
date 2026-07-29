---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
sidebar_label: Adapter -> TrixTextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `trix` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts).

## Overview

### TrixTextSearchAdapter - Pre-processor / simplified config

preprocessor to allow minimal config: `uri` points at the `.ix` file and the
sibling `.ixx` and `_meta.json` are derived from it (the `jbrowse text-index`
naming convention):

```json
{
  "type": "TrixTextSearchAdapter",
  "uri": "file.ix",
  "assemblyNames": ["hg19"],
  "textSearchAdapterId": "hg19SearchIndex"
}
```

### TrixTextSearchAdapter - Identifier

Every TrixTextSearchAdapter has a unique `textSearchAdapterId`, a top-level
field (not one of the config slots below) that identifies it; it is
auto-generated when omitted.

an explicit `textSearchAdapterId` is still honored when given

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "TrixTextSearchAdapter", ... }`. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ixfilepath">**ixFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ix', locationType: 'UriLocation' }</code> |  |
| <span id="slot-ixxfilepath">**ixxFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ixx', locationType: 'UriLocation' }</code> |  |
| <span id="slot-metafilepath">**metaFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'meta.json', locationType: 'UriLocation' }</code> |  |
| <span id="slot-tracks">**tracks**</span><br>`stringArray` = <code>[]</code> | List of tracks covered by text search adapter |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | List of assemblies covered by text search adapter |
