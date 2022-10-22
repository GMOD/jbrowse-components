---
id: snpcoveragerenderer
title: SNPCoverageRenderer
toplevel: true
---

### Slots

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
