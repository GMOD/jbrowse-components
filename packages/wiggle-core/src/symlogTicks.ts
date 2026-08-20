import { linearTicks } from './vendor/d3-scale.ts'

// Tick VALUES for a symlog axis, which d3 does not have and this axis needs.
//
// d3's scaleSymlog is `linearish`, so `ticks()` hands back evenly spaced values
// in SCORE space while the axis places them in TRANSFORMED space. The two
// disagree by exactly the amount symlog exists to provide: on a [0, 1000] domain
// with the resolved constant, d3's 0, 200, 400, 600, 800, 1000 land at 100%,
// 23%, 13%, 7%, 3% and 0% of the plot height — five 10px labels stacked in the
// top quarter, and two thirds of the axis carrying one tick. The plot is right
// and the axis over it is unreadable.
//
// So the values are chosen in transformed space instead — evenly spaced there,
// which is evenly spaced on screen — and each is then rounded to the nearest
// 1/2/5 × 10^k so the labels read as numbers a person would have picked. A
// [0, 1000] domain comes out 0, 5, 20, 200, 1000: five labels spread down the
// whole axis.
//
// `vendor/d3-scale.ts` stays d3's arithmetic unchanged, and `scaleTicks` there
// still answers what d3 answers — `scaleParity.test.ts` pins it. This is
// `getScale`'s own choice, applied where a scale is built for drawing.

const symlog = (x: number, c: number) =>
  Math.sign(x) * Math.log1p(Math.abs(x / c))

const symexp = (t: number, c: number) =>
  Math.sign(t) * c * Math.expm1(Math.abs(t))

// Nearest 1/2/5/10 × 10^k, compared in log space so the choice doesn't depend on
// which decade the value happens to sit in. `toPrecision(15)` drops the binary
// residue off `f * 10 ** k` (5e-5 comes out 0.00005000000000000001 otherwise),
// which matters because these are rendered as label text.
function niceMagnitude(x: number) {
  const magnitude = Math.abs(x)
  const decade = 10 ** Math.floor(Math.log10(magnitude))
  let best = decade
  for (const factor of [2, 5, 10]) {
    const candidate = factor * decade
    if (
      Math.abs(Math.log(candidate / magnitude)) <
      Math.abs(Math.log(best / magnitude))
    ) {
      best = candidate
    }
  }
  return Math.sign(x) * Number(best.toPrecision(15))
}

/**
 * Tick values for a symlog domain, spaced evenly down the axis rather than
 * evenly across the scores.
 *
 * The domain endpoints are always ticks: symlog's whole point is that the small
 * end stays legible, and both ends of an autoscaled domain are what tell a
 * reader what the plot's extent is. Zero joins them when the domain crosses it —
 * on a log-ratio track that is the one score with an absolute meaning, and
 * rounding never lands on it.
 *
 * Rounding can put an interior tick on top of a neighbour (a domain crossing
 * zero rounds its smallest magnitudes to something a pixel from the zero line),
 * so a candidate closer than half a slot to a tick already kept is dropped
 * rather than drawn over it. Endpoints and zero are kept in preference to any
 * rounded value, which is the same order they are stated in above.
 */
export function symlogTicks(
  domain: readonly [number, number],
  constant: number,
  count = 10,
): number[] {
  const [domainMin, domainMax] = domain
  const descending = domainMax < domainMin
  const min = descending ? domainMax : domainMin
  const max = descending ? domainMin : domainMax
  const tMin = symlog(min, constant)
  const tMax = symlog(max, constant)
  const slots = Math.max(1, Math.floor(count))
  if (!(constant > 0) || !(tMax - tMin > 0)) {
    // A constant that isn't positive makes the transform undefined, and a
    // transformed span of zero (a flat domain) has nothing to space out. Neither
    // is this function's call to make, so hand both back to the linear ticks the
    // rest of the module uses.
    return linearTicks(domainMin, domainMax, count)
  }

  const normalized = (v: number) => (symlog(v, constant) - tMin) / (tMax - tMin)
  const minGap = 0.5 / slots
  // Anchors first so a rounded value never displaces one of them, then the
  // rounded candidates in ascending order; `kept` stays sorted because the
  // anchors are the extremes and zero is between them.
  const anchors = min < 0 && max > 0 ? [min, 0, max] : [min, max]
  const candidates: number[] = []
  for (let i = 1; i < slots; i++) {
    const value = niceMagnitude(
      symexp(tMin + ((tMax - tMin) * i) / slots, constant),
    )
    if (value > min && value < max) {
      candidates.push(value)
    }
  }

  const kept = [...anchors]
  for (const value of candidates) {
    if (
      kept.every(k => Math.abs(normalized(value) - normalized(k)) >= minGap)
    ) {
      kept.push(value)
    }
  }
  kept.sort((a, b) => a - b)
  return descending ? kept.reverse() : kept
}
