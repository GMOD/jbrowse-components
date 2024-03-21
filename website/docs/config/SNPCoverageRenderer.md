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
      defaultValue: 'red',
      description: 'the color of the clipping marker',
      type: 'color',
    }
```

#### slot: drawArcs

```js
drawArcs: {
      defaultValue: true,
      description: 'Draw sashimi-style arcs for intron features',
      type: 'boolean',
    }
```

#### slot: drawIndicators

```js
drawIndicators: {
      defaultValue: true,
      description:
        'draw a triangular indicator where an event has been detected',
      type: 'boolean',
    }
```

#### slot: drawInterbaseCounts

```js
drawInterbaseCounts: {
      defaultValue: true,
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      type: 'boolean',
    }
```

#### slot: indicatorThreshold

```js
indicatorThreshold: {
      defaultValue: 0.4,
      description:
        'the proportion of reads containing a insertion/clip indicator',
      type: 'number',
    }
```
