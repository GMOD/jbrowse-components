---
id: jbrowse1textsearchadapter
title: JBrowse1TextSearchAdapter
description: "Searches a names index written by JBrowse 1's generate-names.pl. The tracks and assemblyNames slots list the tracks and assemblies the index covers."
sidebar_label: Adapter -> JBrowse1TextSearchAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `legacy-jbrowse` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts).

## Example usage

An entry in `aggregateTextSearchAdapters`, pointing at the `names/`
directory JBrowse 1's `generate-names.pl` wrote — so an existing instance's
search index is reused rather than rebuilt with `jbrowse text-index`:

```js
{
  type: 'JBrowse1TextSearchAdapter',
  namesIndexLocation: { uri: 'https://example.com/jbrowse1/data/names/' },
  assemblyNames: ['hg19'],
}
```

Searches a names index written by JBrowse 1's `generate-names.pl`. The
`tracks` and `assemblyNames` slots list the tracks and assemblies the index
covers.

## Config slots

`JBrowse1TextSearchAdapter` has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-namesindexlocation">**namesIndexLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/volvox/names', locationType: 'UriLocation' }</code> | the location of the JBrowse1 names index data directory |
| <span id="slot-tracks">**tracks**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | List of tracks covered by text search adapter |
| <span id="slot-assemblynames">**assemblyNames**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | List of assemblies covered by text search adapter |
