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

## DEFAULT_GAP_BREAK_MULTIPLE

Default `multiple` for the wiggle interpolated line — the `maxGapMultiple`
config slot's default, so a track can override or disable it with 0.

Deliberately far out. A hole worth breaking on runs orders of magnitude past the
mean, not a couple of multiples, so this only has to sit clear of ordinary
spacing variation rather than track it closely. BigWig data makes that easy:
bbi's reduced zoom levels emit fixed-width summary bins, so the series tiles.
Measured on volvox_microarray.bw over the range its docs figure renders, at
three zooms: 500 bins, every gap exactly 1.0x the mean, no break at any
threshold. What is left to catch is a stretch bbi emitted no bin for at all
(unmappable, uncovered), which is hundreds of times the bin width.

Not shared with the LD recombination curve, which calibrates its own — see
RECOMBINATION_GAP_MULTIPLE there. The two callers plot different kinds of series
(tiled bins vs an irregular point process), so one number serving both meant
retuning for one silently retuned the other.

```js
// type signature
20
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/gapBreak.ts)

## domainFromStats

Converts score stats into a `[min, max]` domain, applying std-dev expansion for
the `localsd` autoscale type.

```js
// type signature
(stats: ScoreStats, autoscaleType: string, numStdDev: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## gapBreakLimit

How far apart two consecutive points of an interpolated (point-to-point) line
may be before the span between them counts as a hole rather than a segment to
draw. Returns `Infinity` when there is nothing to decide, so a caller can always
compare against it unguarded.

The limit is a multiple of the series' own _mean_ spacing rather than an
absolute distance, which is what makes one number work across zoom levels and
data types: reduced BigWig bins get wider as you zoom out, so any fixed bp
threshold would be either useless at one end or destructive at the other. It
also lets the same rule serve a bp axis (wiggle's linecenter) and a px one (the
LD recombination curve) — the caller picks the space, this only cares that the
units are consistent.

Mean, not median: it is O(1) from the endpoints, and it errs the safe way. A
series' holes inflate their own mean, which raises the limit and so breaks
_less_ — a line that stays connected is the status quo, whereas a spuriously
broken one destroys data the user can see nowhere else. Sorting for a true
median would cost O(n log n) per source per region on the encode path, for a
threshold this coarse.

`count < 3` returns Infinity: two points have no "typical" spacing to be unusual
against, so there is nothing to call a hole.

```js
// type signature
({ first, last, count, multiple, }: { first: number; last: number; count: number; multiple: number; }) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/gapBreak.ts)

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
(scaleType: string) => 1 | 0
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getScale

Builds a d3 scale (linear/log/quantize) from a `ScaleOpts`, nicing the domain
unless `nice: false` says it is already the one being drawn with.

```js
// type signature
({ domain, range, scaleType, nice }: ScaleOpts) => Scale
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
