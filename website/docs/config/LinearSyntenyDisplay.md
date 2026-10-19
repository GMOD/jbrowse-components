---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
description: "Draws a SyntenyTrack in a LinearSyntenyView, as ribbons joining the aligned regions of two stacked linear genome views."
sidebar_label: Display -> LinearSyntenyDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts).

Draws a `SyntenyTrack` in a `LinearSyntenyView`, as ribbons joining the
aligned regions of two stacked linear genome views.

## Example usage

A `SyntenyTrack` config to paste into `tracks`. The adapter needs the query
(first) and target (second) assembly names, matched by the track's
`assemblyNames`. See the
[synteny track guide](/docs/config_guides/synteny_track) for all options:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
}
```

## Related links

- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [MultiGenomeIndexedPAFAdapter](../multigenomeindexedpafadapter)
- **Adapter:** [MultiGenomePAFAdapter](../multigenomepafadapter)
- **Adapter:** [MultiPairwiseSyntenyAdapter](../multipairwisesyntenyadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/linearsyntenydisplay)

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `renderer` | ignored |
| `middle` | ignored |
