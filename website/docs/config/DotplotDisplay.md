---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `dotplot-view`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/configSchema.ts).

## Example usage

The dot-plot rendering of a `SyntenyTrack`, for use inside a `DotplotView`
(rather than the two-row `LinearSyntenyDisplay` or the plain-LGV
`LGVSyntenyDisplay`) — same track config, different display type:

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
  displays: [
    {
      type: 'DotplotDisplay',
      displayId: 'hg38_vs_mm10-DotplotDisplay',
    },
  ],
}
```

## Overview

### DotplotDisplay - Compatible adapters

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

### DotplotDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/dotplotdisplay).

### DotplotDisplay - Identifier

Every DotplotDisplay has a unique `displayId`, a required top-level field that
identifies it (not one of the config slots below).
