---
id: multipairwisesyntenyadapter
title: MultiPairwiseSyntenyAdapter
sidebar_label: Adapter -> MultiPairwiseSyntenyAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MultiPairwiseSyntenyAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['panTro6', 'hg38', 'gorGor6'],
  adapter: {
    type: 'MultiPairwiseSyntenyAdapter',
    adapters: [
      {
        type: 'PairwiseIndexedPAFAdapter',
        uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz',
        csi: true,
        assemblyNames: ['panTro6', 'hg38'],
      },
      {
        type: 'PairwiseIndexedPAFAdapter',
        uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToGorGor6.over.pif.gz',
        csi: true,
        assemblyNames: ['gorGor6', 'hg38'],
      },
    ],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Composes pairwise synteny adapters that all name one assembly — the anchor —
into the star an N-genome view draws from one track: hg38 against each UCSC
genome's liftOver PIF, say. A query on the anchor fans out to every child and
concatenates; a query naming one mate reaches only the child holding that
pair, which a PIF answers from the mate's own perspective; a mate pair no
child aligns is empty rather than an error, since a star has no such edge.

The anchor is inferred as the one assembly every child names, so it is never
written twice. Each child is any pairwise synteny adapter config with its own
`assemblyNames` (PairwiseIndexedPAFAdapter, PAFAdapter, ChainAdapter, ...).

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MultiPairwiseSyntenyAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapters">**adapters**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | the pairwise adapter configs, each naming its own pair in `assemblyNames` (or `queryAssembly`/`targetAssembly`); exactly one assembly must be common to all of them |
| <span id="slot-coarsebpperpxthreshold">**coarseBpPerPxThreshold**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | bpPerPx threshold at which a view on "Level of detail: automatic" switches the children from their fine tier to their coarse tier. The coarse tier is offered only when every child carries one, and the threshold is raised to the largest `--coarse` bound any child's `#pif` header states.<br>_advanced_ |
