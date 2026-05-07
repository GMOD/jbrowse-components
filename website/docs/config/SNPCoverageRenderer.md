---
id: snpcoveragerenderer
title: SNPCoverageRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/SNPCoverageRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SNPCoverageRenderer.md)

## Docs

### SNPCoverageRenderer - Slots

#### slot: clipColor

```js
clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    }
```

#### slot: indicatorThreshold

```js
indicatorThreshold: {
      type: 'number',
      description:
        'the proportion of reads containing a insertion/clip indicator',
      defaultValue: 0.4,
    }
```

#### slot: showArcs

```js
showArcs: {
      type: 'boolean',
      description: 'Draw sashimi-style arcs for intron features',
      defaultValue: true,
    }
```

#### slot: showInterbaseCounts

```js
showInterbaseCounts: {
      type: 'boolean',
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      defaultValue: true,
    }
```

#### slot: showInterbaseIndicators

```js
showInterbaseIndicators: {
      type: 'boolean',
      description:
        'draw a triangular indicator where an event has been detected',
      defaultValue: true,
    }
```
