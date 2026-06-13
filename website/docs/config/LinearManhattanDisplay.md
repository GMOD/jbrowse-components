---
id: linearmanhattandisplay
title: LinearManhattanDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearManhattanDisplay.md)

## Overview

configuration for the Manhattan plot display used by GWAS tracks

### LinearManhattanDisplay - Slots

#### slot: color

```js
color: {
        type: 'color',
        defaultValue: '#0068d1',
        description: 'CSS color or jexl callback for Manhattan points',
      }
```

#### slot: colorBy

LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its
r² to the index SNP, read from `ldAdapter`.

```js
colorBy: {
        type: 'stringEnum',
        model: types.enumeration('GwasColorBy', ['normal', 'ld']),
        defaultValue: 'normal',
        description: 'How to color Manhattan points',
      }
```

#### slot: ldAdapter

PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r²
used when colorBy is 'ld'.

```js
ldAdapter: {
        type: 'frozen',
        defaultValue: null,
        description: 'Adapter config for PLINK .ld pairwise r² data',
      }
```

### LinearManhattanDisplay - Derives from

```js
baseConfiguration: linearWiggleDisplayConfigSchema
```
