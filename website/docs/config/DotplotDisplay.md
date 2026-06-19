---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/DotplotDisplay.md)

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

### DotplotDisplay - Identifier

Every DotplotDisplay has a unique `displayId`, a required top-level field that
identifies it (not one of the config slots below).
