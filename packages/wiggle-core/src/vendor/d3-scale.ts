// Vendored from d3-scale 4.0.2 + d3-array 3.2.4
// ISC License — https://github.com/d3/d3-scale/blob/main/LICENSE
// Only scaleLinear, scaleLog, scaleQuantize are included.
// Unused d3-scale features (clamp, invert, interpolate, rangeRound, unknown,
// tickFormat, copy) are omitted.

// ── d3-array: ticks, tickIncrement ────────────────────────────────────────────

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

function d3ticks(start: number, stop: number, count: number): number[] {
  stop = +stop
  start = +start
  count = +count
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
  const n = i2 - i1 + 1
  const result: number[] = new Array(n)
  if (reverse) {
    if (inc < 0) {
      for (let i = 0; i < n; ++i) {
        result[i] = (i2 - i) / -inc
      }
    } else {
      for (let i = 0; i < n; ++i) {
        result[i] = (i2 - i) * inc
      }
    }
  } else {
    if (inc < 0) {
      for (let i = 0; i < n; ++i) {
        result[i] = (i1 + i) / -inc
      }
    } else {
      for (let i = 0; i < n; ++i) {
        result[i] = (i1 + i) * inc
      }
    }
  }
  return result
}

function tickIncrement(start: number, stop: number, count: number): number {
  return tickSpec(+start, +stop, +count)[2]
}

// bisectRight for sorted ascending number arrays (subset of d3-array bisector)
function bisectRight(a: number[], x: number, lo = 0, hi = a.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (a[mid]! <= x) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(a: number, b: number) {
  b -= a = +a
  return b ? (x: number) => (x - a) / b : () => (isNaN(b) ? NaN : 0.5)
}

function interpolateNum(a: number, b: number) {
  return (t: number) => a * (1 - t) + b * t
}

// domain is already transform-mapped; returns a function of transformed x
function bimap(domain: number[], range: number[]): (x: number) => number {
  const [d0, d1, r0, r1] = [domain[0]!, domain[1]!, range[0]!, range[1]!]
  const dn = d1 < d0 ? normalize(d1, d0) : normalize(d0, d1)
  const rn = d1 < d0 ? interpolateNum(r1, r0) : interpolateNum(r0, r1)
  return x => rn(dn(x))
}

function polymap(domain: number[], range: number[]): (x: number) => number {
  const j = Math.min(domain.length, range.length) - 1
  let d = domain.slice()
  let r = range.slice()
  if (d[j]! < d[0]!) {
    d = d.reverse()
    r = r.reverse()
  }
  const dn: ((x: number) => number)[] = []
  const rn: ((t: number) => number)[] = []
  for (let i = 0; i < j; i++) {
    dn[i] = normalize(d[i]!, d[i + 1]!)
    rn[i] = interpolateNum(r[i]!, r[i + 1]!)
  }
  return x => {
    const i = bisectRight(d, x, 1, j) - 1
    return rn[i]!(dn[i]!(x))
  }
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface Scale {
  (x: number): number
  domain(): number[]
  domain(d: number[]): this
  range(): number[]
  range(r: number[]): this
  nice(count?: number): this
  ticks(count?: number): number[]
}

export interface LogScale extends Scale {
  base(): number
  base(b: number): this
}

// ── continuous (shared base for linear + log) ─────────────────────────────────

interface InternalScale extends Scale {
  _setXform(t: (x: number) => number): this
}

function continuous(xform: (x: number) => number = x => x): InternalScale {
  let _domain = [0, 1]
  let _range = [0, 1]
  let _transform = xform
  let _output: (x: number) => number

  function rescale() {
    const mapped = _domain.map(_transform)
    _output =
      _domain.length > 2 ? polymap(mapped, _range) : bimap(mapped, _range)
    return scale
  }

  const scale = Object.assign((x: number) => _output(_transform(x)), {
    domain(d?: number[]): any {
      if (!d) {
        return _domain.slice()
      }
      _domain = Array.from(d, Number)
      return rescale()
    },

    range(r?: number[]): any {
      if (!r) {
        return _range.slice()
      }
      _range = Array.from(r)
      return rescale()
    },

    // linearish.nice from d3-scale
    nice(count = 10): any {
      const d = _domain.slice()
      let i0 = 0
      let i1 = d.length - 1
      let start = d[i0]!
      let stop = d[i1]!
      if (stop < start) {
        ;[i0, i1] = [i1, i0]
        ;[start, stop] = [stop, start]
      }
      let prestep: number | undefined
      let step: number
      let maxIter = 10
      while (maxIter-- > 0) {
        step = tickIncrement(start, stop, count)
        if (step === prestep) {
          d[i0] = start
          d[i1] = stop
          _domain = d
          return rescale()
        } else if (step > 0) {
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
      return scale
    },

    ticks(count = 10): number[] {
      return d3ticks(_domain[0]!, _domain[_domain.length - 1]!, count)
    },

    _setXform(t: (x: number) => number): any {
      _transform = t
      return rescale()
    },
  })

  rescale()
  return scale
}

// ── scaleLinear ───────────────────────────────────────────────────────────────

export function scaleLinear(): Scale {
  return continuous()
}

// ── scaleLog ──────────────────────────────────────────────────────────────────

function logp(base: number) {
  return base === Math.E
    ? Math.log
    : base === 10
      ? Math.log10
      : base === 2
        ? Math.log2
        : (x: number) => Math.log(x) / Math.log(base)
}

function powp(base: number) {
  return base === 10
    ? (x: number) => (isFinite(x) ? +`1e${x}` : Math.max(x, 0))
    : base === Math.E
      ? Math.exp
      : (x: number) => Math.pow(base, x)
}

export function scaleLog(): LogScale {
  let base = 10
  let logs = logp(base)
  let pows = powp(base)

  // Start with log transform; loggish rescale will flip sign for negative domains
  const inner = continuous(Math.log)

  function rescaleLog() {
    logs = logp(base)
    pows = powp(base)
    const d = inner.domain()
    const xform =
      d[0]! < 0
        ? (x: number) => -Math.log(-x)
        : base === Math.E
          ? Math.log
          : base === 10
            ? Math.log10
            : base === 2
              ? Math.log2
              : (x: number) => Math.log(x) / Math.log(base)
    inner._setXform(xform)
    return scale
  }

  const scale = Object.assign((x: number) => inner(x), {
    base(b?: number): any {
      if (b === undefined) {
        return base
      }
      base = +b
      return rescaleLog()
    },

    domain(d?: number[]): any {
      if (!d) {
        return inner.domain()
      }
      inner.domain(d)
      return rescaleLog()
    },

    range(r?: number[]): any {
      if (!r) {
        return inner.range()
      }
      inner.range(r)
      return scale
    },

    nice(): any {
      const d = inner.domain()
      d[0] = pows(Math.floor(logs(d[0]!)))
      d[d.length - 1] = pows(Math.ceil(logs(d[d.length - 1]!)))
      inner.domain(d)
      return rescaleLog()
    },

    ticks(count = 10): number[] {
      const d = inner.domain()
      let u = d[0]!
      let v = d[d.length - 1]!
      const r = v < u
      if (r) {
        ;[u, v] = [v, u]
      }
      let i = logs(u)
      let j = logs(v)
      const n = count
      const z: number[] = []
      if (!(base % 1) && j - i < n) {
        i = Math.floor(i)
        j = Math.ceil(j)
        if (u > 0) {
          for (; i <= j; ++i) {
            for (let k = 1; k < base; ++k) {
              const t = i < 0 ? k / pows(-i) : k * pows(i)
              if (t < u) {
                continue
              }
              if (t > v) {
                break
              }
              z.push(t)
            }
          }
        } else {
          for (; i <= j; ++i) {
            for (let k = base - 1; k >= 1; --k) {
              const t = i > 0 ? k / pows(-i) : k * pows(i)
              if (t < u) {
                continue
              }
              if (t > v) {
                break
              }
              z.push(t)
            }
          }
        }
        if (z.length * 2 < n) {
          return d3ticks(u, v, n)
        }
      } else {
        z.push(...d3ticks(i, j, Math.min(j - i, n)).map(pows))
      }
      return r ? z.reverse() : z
    },
  })

  scale.domain([1, 10])
  return scale
}

// ── scaleQuantize ─────────────────────────────────────────────────────────────

export function scaleQuantize(): Scale {
  let x0 = 0
  let x1 = 1
  let n = 1
  let thresholds = [0.5]
  let range = [0, 1]

  function rescale() {
    thresholds = new Array(n)
    for (let i = 0; i < n; ++i) {
      thresholds[i] = ((i + 1) * x1 - (i - n) * x0) / (n + 1)
    }
    return scale
  }

  const scale = Object.assign(
    (x: number) => range[bisectRight(thresholds, x, 0, n)]!,
    {
      domain(d?: number[]): any {
        if (!d) {
          return [x0, x1]
        }
        ;[x0, x1] = [+d[0]!, +d[1]!]
        return rescale()
      },

      range(r?: number[]): any {
        if (!r) {
          return range.slice()
        }
        n = (range = Array.from(r)).length - 1
        return rescale()
      },

      // linearish.nice reused: quantize uses same linear nice logic
      nice(count = 10): any {
        const step = tickIncrement(x0, x1, count)
        if (step > 0) {
          x0 = Math.floor(x0 / step) * step
          x1 = Math.ceil(x1 / step) * step
        } else if (step < 0) {
          x0 = Math.ceil(x0 * step) / step
          x1 = Math.floor(x1 * step) / step
        }
        return rescale()
      },

      ticks(count = 10): number[] {
        return d3ticks(x0, x1, count)
      },
    },
  )

  rescale()
  return scale
}
