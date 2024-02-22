---
id: snpcoveragerenderer
title: SNPCoverageRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/SNPCoverageRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/SNPCoverageRenderer/configSchema.ts)

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

#### slot: drawArcs

```js
drawArcs: {
      type: 'boolean',
      description: 'Draw sashimi-style arcs for intron features',
      defaultValue: true,
    }
```

#### slot: drawInterbaseCounts

```js
drawInterbaseCounts: {
      type: 'boolean',
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      defaultValue: true,
    }
```

#### slot: drawIndicators

```js
drawIndicators: {
      type: 'boolean',
      description:
        'draw a triangular indicator where an event has been detected',
      defaultValue: true,
    }
```
