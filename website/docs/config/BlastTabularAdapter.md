---
id: blasttabularadapter
title: BlastTabularAdapter
sidebar_label: Adapter -> BlastTabularAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts).

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BlastTabularAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | Query assembly is the first value in the array, target assembly is the second |
| <span id="slot-targetassembly">**targetAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames array: the target assembly |
| <span id="slot-queryassembly">**queryAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames array: the query assembly |
| <span id="slot-blasttablelocation">**blastTableLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/blastTable.tsv', locationType: 'UriLocation' }</code> |  |
| <span id="slot-columns">**columns**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'qseqid sseqid pident length mismatch gapopen qstart qend sstar…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore'</code></pre></dialog></span> | Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required |
