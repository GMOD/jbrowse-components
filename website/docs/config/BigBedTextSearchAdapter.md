---
id: bigbedtextsearchadapter
title: BigBedTextSearchAdapter
sidebar_label: Adapter -> BigBedTextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BigBedTextSearchAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'BigBedTextSearchAdapter',
  bigBedLocation: { uri: 'bbi/ncbiRefSeq.bb' },
  ixFilePath: { uri: 'ixIxx/ncbiRefSeq.ix' },
  ixxFilePath: { uri: 'ixIxx/ncbiRefSeq.ixx' },
}
```

_See the **Config slots** section below for all available configuration fields._

Finds features by the names a BigBed was built to look up, its
`bedToBigBed -extraIndex` columns, which a UCSC hub declares with
`searchIndex`. The hub's `searchTrix` index, when given, adds prefix and
case-insensitive matching. A UCSC track hub connection configures one for
its first gene track declaring a `searchIndex`, GenArk's `ncbiRefSeq`.

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BigBedTextSearchAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bigbedlocation">**bigBedLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bb', locationType: 'UriLocation' }</code> | the BigBed whose extra indexes resolve a name to its features |
| <span id="slot-ixfilepath">**ixFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '', locationType: 'UriLocation' }</code> | a UCSC `searchTrix` `.ix`, whose records are the names the extra indexes hold. Unset, a search matches a name exactly as typed |
| <span id="slot-ixxfilepath">**ixxFilePath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '', locationType: 'UriLocation' }</code> | the `.ixx` beside `ixFilePath` |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | List of assemblies covered by text search adapter |
