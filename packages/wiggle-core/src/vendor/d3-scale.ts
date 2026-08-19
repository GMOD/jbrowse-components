// Derived from d3-scale 4.0.2 and d3-array 3.2.4, ISC License —
// https://github.com/d3/d3-scale/blob/main/LICENSE
//
// Three scales, because `scaleType` is a stringEnum of exactly linear, log and
// symlog. What d3 offers beyond them, and what these three offered beyond
// `getScale`'s use of them — clamp, invert, interpolate, rangeRound, unknown,
// tickFormat, copy, piecewise domains, quantize — is not here.
//
// **Pure functions over a spec**, rather than d3's chainable callable objects:
// nothing here holds state, so a scale is a value you can compare, log and
// build in a worker, and `scale.ts` assembles the one callable the public
// `getScale` still returns.
//
// **The tick and nice arithmetic is d3's, unchanged**, and deliberately so:
// `yScaleTicksParity.test.ts` pins the axis against what the renderer draws,
// and a tick sequence differing in the last decimal moves a labelled line off
// the bar it belongs to. `scaleParity.test.ts` holds it to that.

export type ScaleKind = 'linear' | 'log' | 'symlog'

export interface ScaleSpec {
  kind: ScaleKind
  domain: readonly [number, number]
  range: readonly [number, number]
  /** log only; 10 when unset, and every caller here passes 2 */
  base?: number
  /** symlog only; the half-width of the linear region around zero */
  constant?: number
}

const e10 = Math.sqrt(50)
const e5 = Math.sqrt(10)
const e2 = Math.sqrt(2)

function tickSpec(
  start: number,
  stop: number,
  count: number,
): [number, number, number] {
  const step = (stop - start) / Math.max(0, count)
  const power = Math.floor(Math.log10(step))
  const error = step / 10 ** power
  const factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1
  let i1: number
  let i2: number
  let inc: number
  if (power < 0) {
    inc = 10 ** -power / factor
    i1 = Math.round(start * inc)
    i2 = Math.round(stop * inc)
    if (i1 / inc < start) {
      ++i1
    }
    if (i2 / inc > stop) {
      --i2
    }
    inc = -inc
  } else {
    inc = 10 ** power * factor
    i1 = Math.round(start / inc)
    i2 = Math.round(stop / inc)
    if (i1 * inc < start) {
      ++i1
    }
    if (i2 * inc > stop) {
      --i2
    }
  }
  if (i2 < i1 && count >= 0.5 && count < 2) {
    return tickSpec(start, stop, count * 2)
  }
  return [i1, i2, inc]
}

/** d3-array's `ticks`: round values inside [start, stop], about `count` of them. */
export function linearTicks(
  start: number,
  stop: number,
  count: number,
): number[] {
  if (!(count > 0)) {
    return []
  }
  if (start === stop) {
    return [start]
  }
  const reverse = stop < start
  const [i1, i2, inc] = reverse
    ? tickSpec(stop, start, count)
    : tickSpec(start, stop, count)
  if (!(i2 >= i1)) {
    return []
  }
  // Multiply or divide by `inc` as its sign says, rather than always
  // multiplying: for a fractional step d3 carries the reciprocal as a negative
  // integer so the ticks land on exact decimals.
  const at = (i: number) => (inc < 0 ? i / -inc : i * inc)
  return Array.from({ length: i2 - i1 + 1 }, (_, i) =>
    reverse ? at(i2 - i) : at(i1 + i),
  )
}

const tickIncrement = (start: number, stop: number, count: number) =>
  tickSpec(start, stop, count)[2]

// Exact for the bases anyone uses. `Math.log(8) / Math.log(2)` is
// 2.9999999999999996, and the log `nice` floors that logarithm — so the generic
// form would round a domain endpoint down a whole decade.
const logp = (base: number) =>
  base === Math.E
    ? Math.log
    : base === 10
      ? Math.log10
      : base === 2
        ? Math.log2
        : (x: number) => Math.log(x) / Math.log(base)

const powp = (base: number) =>
  base === 10
    ? (x: number) => (Number.isFinite(x) ? +`1e${x}` : Math.max(x, 0))
    : base === Math.E
      ? Math.exp
      : (x: number) => base ** x

// sign(x) * log1p(|x / c|). Unlike a log scale it is defined at 0 — and either
// side of it — which is the whole reason it is here: coverage that touches
// zero, and log-ratio data that crosses it, have no log domain at all.
//
// `constant` is not decoration. At c = 1 this IS log(x + 1), which flattens any
// data living below 1 (p-values, fractions) into the linear part of the curve
// and throws away exactly the resolution such a track is read for. Shrinking c
// moves the linear knee down to where the interesting values are.
const symlog = (c: number) => (x: number) =>
  Math.sign(x) * Math.log1p(Math.abs(x / c))

/**
 * The spec's transform. A wholly negative log domain maps through -log(-x),
 * which is what lets a log scale run from -100 to -1; `getNiceDomain` floors
 * its own log domains above zero, so that branch is for callers reaching
 * `getScale` directly.
 */
function transformFor(spec: ScaleSpec): (x: number) => number {
  if (spec.kind === 'symlog') {
    return symlog(spec.constant ?? 1)
  }
  if (spec.kind === 'log') {
    return spec.domain[0] < 0 ? x => -Math.log(-x) : logp(spec.base ?? 10)
  }
  return x => x
}

/**
 * Where `x` lands in the range.
 *
 * A zero-width domain returns the range's midpoint rather than dividing by
 * zero, which is d3's behaviour and the one a flat track wants: every score
 * equal means every bar at the same height, not every bar at NaN.
 */
export function scaleValue(spec: ScaleSpec, x: number): number {
  const transform = transformFor(spec)
  const [d0, d1] = [transform(spec.domain[0]), transform(spec.domain[1])]
  const [r0, r1] = spec.range
  const span = d1 - d0
  if (!span) {
    return Number.isNaN(span) ? NaN : (r0 + r1) / 2
  }
  return r0 + ((transform(x) - d0) / span) * (r1 - r0)
}

/** The domain rounded out to tick boundaries — d3's `nice`. */
export function niceDomain(spec: ScaleSpec, count = 10): [number, number] {
  if (spec.kind === 'log') {
    const logs = logp(spec.base ?? 10)
    const pows = powp(spec.base ?? 10)
    return [
      pows(Math.floor(logs(spec.domain[0]))),
      pows(Math.ceil(logs(spec.domain[1]))),
    ]
  }
  // d3's linearish.nice, which symlog composes too: widen to the tick step,
  // then re-derive the step from the widened domain until it stops moving,
  // because widening can change which step tickIncrement picks.
  let [start, stop] = spec.domain
  const flip = stop < start
  if (flip) {
    ;[start, stop] = [stop, start]
  }
  // The widened endpoints are COMMITTED only where the step converges, which
  // is d3's own control flow and not a detail: a degenerate domain — [5, 5],
  // what a flat coverage track hands over — drives the step to -Infinity and
  // the endpoints to NaN on the first pass. d3 leaves such a domain alone;
  // returning the intermediate values instead gives the axis a NaN domain.
  let prestep: number | undefined
  for (let iter = 0; iter < 10; iter++) {
    const step = tickIncrement(start, stop, count)
    if (step === prestep) {
      return flip ? [stop, start] : [start, stop]
    }
    if (step > 0) {
      start = Math.floor(start / step) * step
      stop = Math.ceil(stop / step) * step
    } else if (step < 0) {
      start = Math.ceil(start * step) / step
      stop = Math.floor(stop * step) / step
    } else {
      break
    }
    prestep = step
  }
  return [spec.domain[0], spec.domain[1]]
}

/**
 * Tick values inside the domain. Log ticks sit at every k×base^i — 2, 4, 8 for
 * base 2 — falling back to linear ticks when the domain spans too many powers
 * to enumerate, or too few to fill the count.
 */
export function scaleTicks(spec: ScaleSpec, count = 10): number[] {
  if (spec.kind !== 'log') {
    return linearTicks(spec.domain[0], spec.domain[1], count)
  }
  const base = spec.base ?? 10
  const logs = logp(base)
  const pows = powp(base)
  let [u, v] = spec.domain
  const reverse = v < u
  if (reverse) {
    ;[u, v] = [v, u]
  }
  let i = logs(u)
  const j0 = logs(v)
  // `!(j0 - i < count)`, not `>= count`: a negative domain makes both
  // logarithms NaN, and every comparison against NaN is false — so the `>=`
  // spelling falls through to the enumeration below and invents linear ticks
  // for a domain d3 declines to tick at all.
  if (base % 1 || !(j0 - i < count)) {
    return linearTicks(i, j0, Math.min(j0 - i, count)).map(pows)
  }
  const j = Math.ceil(j0)
  i = Math.floor(i)
  // Ascending multipliers for a positive domain, descending for a negative one,
  // so the ticks come out in increasing order either way.
  const ks = Array.from({ length: base - 1 }, (_, k) =>
    u > 0 ? k + 1 : base - 1 - k,
  )
  const out: number[] = []
  for (; i <= j; ++i) {
    for (const k of ks) {
      const t = (u > 0 ? i < 0 : i > 0) ? k / pows(-i) : k * pows(i)
      if (t < u) {
        continue
      }
      if (t > v) {
        break
      }
      out.push(t)
    }
  }
  if (out.length * 2 < count) {
    return linearTicks(u, v, count)
  }
  return reverse ? out.reverse() : out
}
