---
id: pairwiseindexedpafadapter
title: PairwiseIndexedPAFAdapter
sidebar_label: Adapter -> PairwiseIndexedPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'PairwiseIndexedPAFAdapter',
    uri: 'https://example.com/aln.pif.gz',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

a tabix-indexed PAF (PIF) for large synteny datasets. The `uri` shorthand
auto-resolves the `.tbi` index (pass `csi: true` for a `.csi` index).

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "PairwiseIndexedPAFAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-pifgzlocation">**pifGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/data/file.pif.gz', locationType: 'UriLocation'…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/data/file.pif.gz', locationType: 'UriLocation' }</code></pre></dialog></span> | location of pairwise tabix indexed PAF (pif) |
| <span id="slot-coarsebpperpxthreshold">**coarseBpPerPxThreshold**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | bpPerPx threshold at which a view on "Level of detail: automatic" switches from the per-row CIGAR tier (lowercase t/q prefix) to the coarse tier (uppercase T/Q prefix), whose CIGAR is folded to its large indels. The file has the last word: one with no coarse tier (make-pif --no-coarse) serves the fine tier at every zoom, and a threshold below the `--coarse` bound its `#pif` header states is raised to that bound, since below it the coarse tier is served at zooms where the indels it folded away are wide enough to see.<br>_advanced_ |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second |
| <span id="slot-targetassembly">**targetAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the target assembly name |
| <span id="slot-queryassembly">**queryAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the query assembly name |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi`, which is what the `uri` shorthand assumes — a `.csi` beside the file is reached with `csi: true` rather than by spelling this out. |
