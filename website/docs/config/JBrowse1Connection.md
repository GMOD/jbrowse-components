---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts).

## Related links

- **State model:** [runtime API](../../models/jbrowse1connection)
- **Base config:** [BaseConnection](../baseconnection)

## Config slots

These slots are top-level fields of the connection's entry in `connections`.
Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-datadirlocation">**dataDirLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLocation' }</code></pre></dialog></span> | the location of the JBrowse 1 data directory, often something like https://mysite.com/jbrowse/data/ |  |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | name of the assembly the connection belongs to, should be a single entry |  |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection | [BaseConnection](../baseconnection) |
