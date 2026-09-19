---
id: wiggle-core
title: wiggle-core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## autoscaleDomainFromSpans

Already-computed stats to the displayed domain, for the `local` / `localsd` /
`localpercentile` autoscale modes. `localpercentile` re-walks the spans to
build its histogram; the other modes read the stats alone.

```js
// type signature
({…}: { stats: ScoreStats; autoscaleType: string | undefined; numStdDev: number; numQuantile?: number | undefined; spans: ScoreSpan[]; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## computeAutoscaleDomain

Computes a score domain from the visible feature arrays for the `local` /
`localsd` / `localpercentile` autoscale types.

```js
// type signature
(autoscaleType: string | undefined, summaryScoreMode: string, numStdDev: number, visibleEntries: {…}[], numQuantile?: number) => [...] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## DEFAULT_GAP_BREAK_MULTIPLE

Default `multiple` for the wiggle interpolated line — the `maxGapMultiple`
config slot's default. 0 means the line never breaks: one connected polyline
across every hole, which is how the interpolated line behaved before gap
breaking existed.

OFF BY DEFAULT, deliberately and after having been on. It shipped at 20 and
the calibration behind that number still holds — a hole worth breaking on runs
orders of magnitude past the mean, and bbi's reduced zoom levels emit
fixed-width bins so the series tiles (measured on volvox_microarray.bw at
three zooms: 500 bins, every gap exactly 1.0x the mean, no break at any
threshold). What changed is the call about whether a reader wants the break at
all: "we added this feature awhile back but i dont think i like it now. might
consider going back to not skipping". A broken line reads as missing data
whether or not
data is missing there, and the chord across a hole is at least continuous with
what the neighbouring points say.

The mechanism stays, whole, because it is the only way to get the other
behavior back: set `maxGapMultiple` on the track, 20 being the calibrated
value. Nothing about `gapBreakLimit` itself changes — a caller passing a
positive multiple gets exactly what it always got.

```js
// type signature
0
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/gapBreak.ts)

## domainFromStats

Converts score stats into a `[min, max]` domain, applying std-dev expansion
for the `localsd` autoscale type. An `undefined` mode is a display whose
scale declares none, and takes the plain extremes.

```js
// type signature
(stats: ScoreStats, autoscaleType: string | undefined, numStdDev: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## gapBreakLimit

How far apart two consecutive points of an interpolated (point-to-point) line
may be before the span between them counts as a hole rather than a segment to
draw. Returns `Infinity` when there is nothing to decide, so a caller can
always compare against it unguarded.

The limit is a multiple of the series' *mean* spacing rather than an
absolute distance, so one number works across zoom levels and data types: reduced BigWig bins get wider as you zoom out, so any fixed bp
threshold would be either useless at one end or destructive at the other. It
also lets the same rule serve a bp axis (wiggle's linecenter) and a px one —
the caller picks the space, this only cares that the units are consistent.

Mean, not median: it is O(1) from the endpoints, and it errs the safe way. A
series' holes inflate their own mean, which raises the limit and so breaks
*less* — a line that stays connected is the status quo, whereas a spuriously
broken one destroys data the user can see nowhere else. Sorting for a true
median would cost O(n log n) per source per region on the encode path, for a
threshold this coarse.

`count < 3` returns Infinity: two points have no "typical" spacing to be
unusual against, so there is nothing to call a hole.

```js
// type signature
({ first, last, count, multiple, }: { first: number; last: number; count: number; multiple: number; }) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/gapBreak.ts)

## getEffectiveScores

Per-feature scalar score array for a summary mode: the min/max summary array
for `'min'`/`'max'`, otherwise the average score.

```js
// type signature
(data: { featureScores: Float32Array<…>; featureMinScores: Float32Array<ArrayBufferLike>; featureMaxScores: Float32Array<...>; }, summaryScoreMode: string) => Float32Array<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## getNiceDomain

Rounds a domain to "nice" endpoints, clamped to the origin. An end given an
explicit `bounds` value keeps that value exactly — only an autoscaled end is
rounded. A log scale's floor still outranks a bound it cannot hold.

The result never descends: a bound that would put `min` above `max` widens
the other end instead, so no consumer has to guess what a backwards domain
means.

```js
// type signature
({ scaleType, domain, bounds, }: { scaleType: string; domain: readonly [number, number]; bounds: readonly [number | undefined, number | undefined]; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getNiceScale

Returns a niced `{min, max}` domain for a maximum score value.
Uses log base-2 when `useLogScale` is true (domain is clamped to [1, max]).

```js
// type signature
(maxScore: number, useLogScale?: boolean | undefined) => { min: number; max: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## getScale

Builds a d3 scale (linear/log/symlog) from a `ScaleOpts`, nicing the domain
unless `nice: false` says it is already the one being drawn with.

```js
// type signature
({ domain, range, scaleType, symlogConstant, nice, }: ScaleOpts) => Scale
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

## parseScoreRules

Normalizes whatever a `scoreRules` config slot holds into `ScoreRule`s,
dropping entries that are not usable. Config is user-authored JSON, so a bare
number, a missing value or a non-numeric one all have to survive being read.

```js
// type signature
(value: unknown) => ScoreRule[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)

## resolveSymlogConstant

The symlog constant actually used for a domain. `0` (the config default)
means "pick one from the domain": a thousandth of its largest magnitude, so
the log-ish part of the curve covers the top three decades of whatever the
track holds and the linear knee sits below the data rather than through it.

The alternative — d3's default of 1 — is `log(x + 1)`, which is fine for read
depth and useless for anything living below 1, because the entire domain then
falls in the linear part of the curve. A p-value track configured that way is
just a linear track wearing a log label, which is the reason this is resolved
rather than hard-coded.

```js
// type signature
(min: number, max: number, configured: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/normalize.ts)

## ScoreRule

One horizontal rule across a score plot, at a score the user chose.

`label` is free text and carries no meaning this package assigns. That is
deliberate: the obvious use is reading a coverage or CNV track against copy
number, and there is no ploidy JBrowse could assume on the user's behalf. A
whole-genome triplication is not diploid, plenty of genomes are not diploid to
begin with, and a cancer sample can be neither — so "2 copies" is a claim only
the person looking at the track can make.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)

## scoreRuleMarks

Screen y for each rule that falls inside the plotted domain, dropping the
rest.

Out-of-domain is a real case rather than a guard: the domain is whatever
autoscale resolved for the visible data, so panning to a quiet stretch can put
a rule above everything on screen, and a rule pinned to the top edge there
reads as "the whole view is over the line".

`normalize` is the display's OWN score normalizer — the same one the renderer
draws with. It is a parameter rather than a linear interpolation of the domain
because the axis need not be linear: on a log or symlog track, placing a rule
at `(value - min) / (max - min)` puts the line somewhere the data it is meant
to be read against is not.

`box` is likewise the caller's own — hand it the same `{yTop, yBottom}` the
display's ticks were built with (a `YScaleTicks` satisfies it). A box
recomputed here would place rules off the ticks of any band that lays its
axis out differently, and the alignments coverage band does.

```js
// type signature
({…}: { rules: readonly ScoreRule[]; domain: [number, number] | undefined; box: { yTop: number; yBottom: number; }; normalize: (score: number) => number; }) => ScoreRuleMark[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)

## ScoreSpan

One block's worth of values to fold into a domain, whatever packed them: a
wiggle source's interleaved `featurePositions` and its three summary arrays,
or a mark layer's separate `x`/`x2` and its one `y` lane. `starts[i * stride]`
and `ends[i * stride + endOffset]` give instance `i`'s span; `low`, `high` and
`avg` give the two ends of its value and the one the mean is taken over, which
are the same array wherever the packer ships a single scalar.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

## visibleStatsDomain

The visible score domain four displays derive identically: walk the settled
blocks, accumulate the stats of what each one shows, and nice-round the
autoscaled range inside the configured bounds. `undefined` while there is
nothing to scale against — no data, a hidden band, or a view that has not
initialized — which every caller distinguishes from a domain.

```js
// type signature
<Payload, Item, Stats>({ active, view, payloadFor, itemsFor, accumulate, range, bounds, scaleType, }: VisibleStatsDomainSpec<Payload, Item, Stats>) => [number, number] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/visibleStatsDomain.ts)

## widenRangeToRules

Widens an autoscaled range so every configured rule stays on the axis.

Without this a rule is dropped from the plot in the views where it is most
useful. Autoscale follows the visible data, so over a homozygous deletion a
coverage domain collapses to about `[0, 1]` and a rule at the diploid depth
falls outside it, though the rule's position above the data is the most
informative mark in that view. The reader has no menu to check either:
`scoreRules` is set by whoever wrote the config, so a rule that vanishes
leaves nothing behind to notice.

Applied to the raw range, before `getNiceDomain` takes the `scales.y`
domain bounds. Those still win: a rule outside an explicitly bounded axis
is one the config asked not to be shown, and it drops as before.

```js
// type signature
(range: [number, number], ruleValues: readonly number[]) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)
