---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
sidebar_label: Adapter -> TrixTextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `trix` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts).

## Example usage

`jbrowse text-index` writes this entry into `aggregateTextSearchAdapters` for
you. The `uri` shorthand points at the `.ix` and the sibling `.ixx` is derived
from it, so the pair only needs spelling out when they are named against
convention. Written by hand, `{ uri: 'trix/hg38.ix' }` is the whole entry: a
`.ix` implies this type, and `assemblyNames` defaults to
the track's own for a per-track index or to the config's one assembly.

```js
{
  type: 'TrixTextSearchAdapter',
  uri: 'trix/hg38.ix',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "TrixTextSearchAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ixfilepath">**ixFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ix', locationType: 'UriLocation' }</code> | location of the Trix `.ix` index written by `jbrowse text-index`: the sorted term-to-feature table the search box reads. |
| <span id="slot-ixxfilepath">**ixxFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: 'out.ixx', locationType: 'UriLocation' }</code> | location of the `.ixx` prefix index, which records where in the `.ix` each prefix begins, so a lookup takes a couple of range requests instead of a download of the whole index. |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | List of assemblies covered by text search adapter |
