---
id: blasttabularadapter
title: BlastTabularAdapter
sidebar_label: Adapter -> BlastTabularAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts).

## Example usage

The default `columns` are BLAST's own `-outfmt 6` order, so a file produced
without custom columns needs only the two assemblies naming which side is
which:
```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach'],
  adapter: {
    type: 'BlastTabularAdapter',
    blastTableLocation: { uri: 'https://example.com/hits.tsv' },
    assemblyNames: ['grape', 'peach'],
    queryAssembly: 'grape',
    targetAssembly: 'peach',
  },
}
```

### Example: custom outfmt

If you passed your own column list to `-outfmt`, repeat it here exactly.
`qseqid sseqid qstart qend sstart send` must be among them; the rest are read
where present:
```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach'],
  adapter: {
    type: 'BlastTabularAdapter',
    blastTableLocation: { uri: 'https://example.com/hits.tsv' },
    assemblyNames: ['grape', 'peach'],
    columns: 'qseqid sseqid qstart qend sstart send evalue',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BlastTabularAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-blasttablelocation">**blastTableLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/blastTable.tsv', locationType: 'UriLocation' }</code> | location of the BLAST tabular output (`-outfmt 6` or `7`). Set `columns` to match if the run used a custom column list. |
| <span id="slot-columns">**columns**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'qseqid sseqid pident length mismatch gapopen qstart qend sstar…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore'</code></pre></dialog></span> | Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second |
| <span id="slot-targetassembly">**targetAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the target assembly name |
| <span id="slot-queryassembly">**queryAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the query assembly name |
