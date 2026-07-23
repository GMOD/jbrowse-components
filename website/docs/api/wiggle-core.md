---
id: wiggle-core
title: wiggle-core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## computeAutoscaleDomain

Computes a score domain from the visible feature arrays for the `local` /
`localsd` / `localpercentile` autoscale types.

```js
// type signature
(autoscaleType: string, summaryScoreMode: string, numStdDev: number, visibleEntries: {…}[], numQuantile?: number) => [...] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## computeScoreExtent

The true `[min, max]` score extent of the visible features for a summary mode,
before any autoscale clipping. Comparing it against the displayed domain flags
when the domain clips real signal (e.g. localpercentile clamping copy-number
gains that sit above the diploid baseline).

```js
// type signature
(summaryScoreMode: string, visibleEntries: { data: FeatureArrays; visStart: number; visEnd: number; }[]) => [number, number] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## domainFromStats

Converts score stats into a `[min, max]` domain, applying std-dev expansion for
the `localsd` autoscale type.

```js
// type signature
(stats: ScoreStats, autoscaleType: string, numStdDev: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## getEffectiveScores

Per-feature scalar score array for a summary mode: the min/max summary array for
`'min'`/`'max'`, otherwise the average score.

```js
// type signature
(data: { featureScores: Float32Array<…>; featureMinScores: Float32Array<ArrayBufferLike>; featureMaxScores: Float32Array<...>; }, summaryScoreMode: string) => Float32Array<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## getNiceDomain

Rounds a domain to "nice" endpoints, clamped to the origin and overridden by any
explicit `bounds`.

```js
// type signature
({ scaleType, domain, bounds, }: { scaleType: string; domain: readonly [number, number]; bounds: readonly [number | undefined, number | undefined]; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getNiceScale

Returns a niced `{min, max}` domain for a maximum score value. Uses log base-2
when `useLogScale` is true (domain is clamped to [1, max]).

```js
// type signature
(maxScore: number, useLogScale?: boolean | undefined) => { min: number; max: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getOrigin

The axis-origin baseline: `1` for log, `0` otherwise.

```js
// type signature
(scaleType: string) => 0 | 1
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getScale

Builds a niced d3 scale (linear/log/quantize) from a `ScaleOpts`.

```js
// type signature
({ domain, range, scaleType }: ScaleOpts) => Scale
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## makeScoreNormalizer

Returns a loop-hoistable function normalizing a score to [0,1].

```js
// type signature
(min: number, max: number, isLog: boolean) => (score: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/normalize.ts)

## scaleTypeFromString

Maps the `'log'`/`'linear'` string to the numeric `WiggleScaleType`.

```js
// type signature
(scaleType: string) => WiggleScaleType
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/normalize.ts)
