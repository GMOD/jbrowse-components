# @jbrowse/wiggle-core

Score-axis scale, autoscale, config mixins and plot chrome shared by wiggle,
Manhattan, mark and coverage displays

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### autoscaleDomainFromSpans

The domain the visible instances autoscale to: at a `quantile` of 1 their
extremes, `stats`; below it those extremes fenced by `quantileExtent`'s ends
(`fenceOutliers`), the bottom read off the `low`s and the top off the `high`s
less the zeros where any is positive, so whiskers open to their spread, a sparse
window's empty bins lower no top, and a window of nothing above 0 keeps the top
it has.

```js
// type signature
({ stats, quantile, zero, spans, }: { stats: ScoreStats; quantile: number; zero: boolean; spans: ScoreSpan[]; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

### computeAutoscaleDomain

The score domain of the visible feature arrays, following `quantile` as
`scales.y.domainQuantile` says, its outliers fenced for an axis that reaches 0
under `zero`.

```js
// type signature
(quantile: number, aggregate: string, visibleEntries: { data: FeatureArrays; visStart: number; visEnd: number; }[], zero: boolean) => [number, number] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

### DEFAULT_GAP_BREAK_MULTIPLE

Default `multiple` for the wiggle interpolated line — the `maxGapMultiple`
config slot's default. 0 means the line never breaks: one connected polyline
across every hole, which is how the interpolated line behaved before gap
breaking existed.

OFF BY DEFAULT, deliberately and after having been on. It shipped at 20 and the
calibration behind that number still holds — a hole worth breaking on runs
orders of magnitude past the mean, and bbi's reduced zoom levels emit
fixed-width bins so the series tiles (measured on volvox_microarray.bw at three
zooms: 500 bins, every gap exactly 1.0x the mean, no break at any threshold).
What changed is the call about whether a reader wants the break at all: "we
added this feature awhile back but i dont think i like it now. might consider
going back to not skipping". A broken line reads as missing data whether or not
data is missing there, and the chord across a hole is at least continuous with
what the neighbouring points say.

The mechanism stays, whole, because it is the only way to get the other behavior
back: set `maxGapMultiple` on the track, 20 being the calibrated value. Nothing
about `gapBreakLimit` itself changes — a caller passing a positive multiple gets
exactly what it always got.

```js
// type signature
0
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/gapBreak.ts)

### gapBreakLimit

How far apart two consecutive points of an interpolated (point-to-point) line
may be before the span between them counts as a hole rather than a segment to
draw. Returns `Infinity` when there is nothing to decide, so a caller can always
compare against it unguarded.

The limit is a multiple of the series' _mean_ spacing rather than an absolute
distance, so one number works across zoom levels and data types: reduced BigWig
bins get wider as you zoom out, so any fixed bp threshold would be either
useless at one end or destructive at the other. It also lets the same rule serve
a bp axis (wiggle's linecenter) and a px one — the caller picks the space, this
only cares that the units are consistent.

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

### getEffectiveScores

Per-feature scalar score array for an aggregate: the min/max summary array for
`'min'`/`'max'`, otherwise the average score.

```js
// type signature
(data: { featureScores: Float32Array<ArrayBufferLike>; featureMinScores: Float32Array<ArrayBufferLike>; featureMaxScores: Float32Array<ArrayBufferLike>; }, aggregate: string) => Float32Array<ArrayBufferLike>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

### getNiceDomain

Rounds a domain to "nice" endpoints. `zero` reaches a linear or symlog domain to
0 (`scales.y.zero`, ADR-182); a log domain has no 0, so a min at or below it
floors to a positive value and a positive min stays where the data put it. An
end given an explicit `bounds` value keeps that value exactly — only an
autoscaled end is rounded. A log scale's floor still outranks a bound it cannot
hold, which the `log-floor` rule reports.

The result never descends and never collapses: a bound that would put `min`
above `max` widens the other end instead, and one value in view widens away from
itself, so no consumer has to guess what a backwards or a flat domain means.

```js
// type signature
({ scaleType, domain, bounds, zero, }: { scaleType: string; domain: readonly [number, number]; bounds: readonly [number | undefined, number | undefined]; zero: boolean; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

### getNiceScale

Returns a niced `{min, max}` domain for a maximum score value. Uses log base-2
when `useLogScale` is true (domain is clamped to [1, max]).

```js
// type signature
(maxScore: number, useLogScale?: boolean | undefined) => { min: number; max: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

### getScale

Builds a d3 scale (linear/log/symlog) from a `ScaleOpts`, nicing the domain
unless `nice: false` says it is already the one being drawn with.

```js
// type signature
({ domain, range, scaleType, symlogConstant, nice, }: ScaleOpts) => Scale
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scale.ts)

### registerScoreAxisWidget

Registers the drawer widget the quantitative tracks' "Y axis..." row opens. The
wiggle plugin calls it once; alignments and the mark display open it by name.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreAxisWidget/index.ts)

### resolveSymlogConstant

The symlog constant actually used for a domain. `0` (the config default) means
"pick one from the domain": a thousandth of its largest magnitude, so the
log-ish part of the curve covers the top three decades of whatever the track
holds and the linear knee sits below the data rather than through it.

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

### scoreRuleMarks

Screen y for each rule that falls inside the plotted domain, dropping the rest.

Out-of-domain is a real case rather than a guard: the domain is whatever
autoscale resolved for the visible data, so panning to a quiet stretch can put a
rule above everything on screen, and a rule pinned to the top edge there reads
as "the whole view is over the line".

`normalize` is the display's OWN score normalizer — the same one the renderer
draws with. It is a parameter rather than a linear interpolation of the domain
because the axis need not be linear: on a log or symlog track, placing a rule at
`(value - min) / (max - min)` puts the line somewhere the data it is meant to be
read against is not.

`box` is likewise the caller's own — hand it the same `{yTop, yBottom}` the
display's ticks were built with (a `YScaleTicks` satisfies it). A box recomputed
here would place rules off the ticks of any band that lays its axis out
differently, and the alignments coverage band does.

```js
// type signature
({ rules, domain, box, normalize, }: { rules: readonly ValueScaleRule[]; domain: [number, number] | undefined; box: { yTop: number; yBottom: number; }; normalize: (score: number) => number; }) => ScoreRuleMark[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)

### ScoreSpan

One block's worth of values to fold into a domain, whatever packed them: a
wiggle source's interleaved `featurePositions` and its summary arrays, or a mark
layer's separate `x`/`x2` and its one `y` lane. `starts[i * stride]` and
`ends[i * stride + endOffset]` give instance `i`'s span, and `low` and `high`
the two ends of its value, one array where the packer ships a single scalar.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/autoscale.ts)

### visibleStatsDomain

visibleStatsRange nice-rounded inside the configured bounds: the domain of a
display whose range is its own alone.

```js
// type signature
<Payload, Item, Stats>({ bounds, scaleType, zero, ...spec }: VisibleStatsDomainSpec<Payload, Item, Stats>) => [number, number] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/visibleStatsDomain.ts)

### visibleStatsRange

The raw autoscaled range the displays with a value scale derive identically:
walk the settled blocks, accumulate the stats of what each one shows, and reduce
them to `[min, max]` before any bound or nice-rounding. `undefined` while there
is nothing to scale against — no data, a hidden band, or a view that has not
initialized — which every caller distinguishes from a range.

```js
// type signature
<Payload, Item, Stats>({ active, view, payloadFor, itemsFor, accumulate, range, }: VisibleStatsRangeSpec<Payload, Item, Stats>) => [number, number] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/visibleStatsDomain.ts)

### widenRangeToRules

Widens an autoscaled range so every configured rule stays on the axis.

Without this a rule is dropped from the plot in the views where it is most
useful. Autoscale follows the visible data, so over a homozygous deletion a
coverage domain collapses to about `[0, 1]` and a rule at the diploid depth
falls outside it, though the rule's position above the data is the most
informative mark in that view, and a rule that vanishes leaves nothing behind to
notice.

Applied to the raw range, before `getNiceDomain` takes the `scales.y` domain
bounds. Those still win: a rule outside an explicitly bounded axis is one the
config asked not to be shown, and it drops as before.

```js
// type signature
(range: [number, number], ruleValues: readonly number[]) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/scoreRuleMarks.ts)

<!-- API_DOCS_END -->
