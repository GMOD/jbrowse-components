---
id: nclistadapter
title: NCListAdapter
sidebar_label: Adapter -> NCListAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts).

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "NCListAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-rooturltemplate">**rootUrlTemplate**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/my/{refseq}/trackData.json', locationType: 'Ur…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: '/path/to/my/{refseq}/trackData.json',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> |  |
| <span id="slot-refnames">**refNames**</span><br>`stringArray` = <code>[]</code> | List of refNames used by the NCList used for aliasing |
