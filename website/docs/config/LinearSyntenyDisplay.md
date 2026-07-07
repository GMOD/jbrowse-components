---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
sidebar_label: Display -> LinearSyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts).

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

## Overview

### LinearSyntenyDisplay - Compatible adapters

Data adapters that can supply the [SyntenyTrack](../syntenytrack):

- [AllVsAllIndexedPAFAdapter](../allvsallindexedpafadapter)
- [AllVsAllPAFAdapter](../allvsallpafadapter)
- [ChainAdapter](../chainadapter)
- [DeltaAdapter](../deltaadapter)
- [MCScanAnchorsAdapter](../mcscananchorsadapter)
- [MCScanBlocksAdapter](../mcscanblocksadapter)
- [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- [MashMapAdapter](../mashmapadapter)
- [PAFAdapter](../pafadapter)
- [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)

### LinearSyntenyDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearsyntenydisplay).
