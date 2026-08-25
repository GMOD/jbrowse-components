---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts).

## Example usage

An entry in the config's `connections`, pointing at a JBrowse 1 data directory —
the one holding `trackList.json` and `seq/`. Its tracks are translated to
JBrowse 2 equivalents on connect, which is the path for serving an existing
JBrowse 1 instance's data without re-processing it.

```js
{
  type: 'JBrowse1Connection',
  connectionId: 'jbrowse1_example',
  name: 'Legacy JBrowse 1 data',
  assemblyNames: ['hg19'],
  dataDirLocation: { uri: 'https://example.com/jbrowse1/data/' },
}
```

_See the **Config slots** section below for all available configuration fields._

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
| Slot | Description |
| --- | --- |
| <span id="slot-datadirlocation">**dataDirLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLocation' }</code></pre></dialog></span> | the location of the JBrowse 1 data directory, often something like https://mysite.com/jbrowse/data/ |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | name of the assembly the connection belongs to, should be a single entry |
| <span class="slot-group">Inherited from [BaseConnection](../baseconnection)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection |
