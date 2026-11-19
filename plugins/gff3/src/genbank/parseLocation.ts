export interface Span {
  start: number
  end: number
  strand: 1 | -1
}

const OPERATOR = /(complement|join|order|bond)\(/y
const GAP = /gap\([^)]*\)/y
const SPAN = /([\w.]+:)?[<>]?(\d+)(?:(\.\.|\^|\.)[<>]?(\d+))?/y

function isOwn(accession: string, refName: string) {
  return accession === refName || accession === refName.replace(/\.\d+$/, '')
}

function matchAt(regex: RegExp, text: string, pos: number) {
  regex.lastIndex = pos
  return regex.exec(text)
}

/**
 * The spans an INSDC location string names, 0-based half-open, in the order
 * the feature is transcribed: `complement(join(a,b))` and
 * `join(complement(b),complement(a))` both answer b then a on strand -1.
 *
 * `<`/`>` partial markers are dropped, a span on another entry (`ACC:1..9`,
 * unless ACC is `refName`'s own) and a `gap()` are skipped, and the site between two bases (`n^n+1`) covers
 * both of them. `order` and `bond` read as `join`.
 */
export function parseLocation(location: string, refName = '') {
  const text = location.replaceAll(/\s/g, '')
  let pos = 0

  function expression(): Span[] {
    const operator = matchAt(OPERATOR, text, pos)
    const gap = operator ? undefined : matchAt(GAP, text, pos)
    const span = operator || gap ? undefined : matchAt(SPAN, text, pos)
    if (operator) {
      pos = OPERATOR.lastIndex
      const spans = expression()
      while (text[pos] === ',') {
        pos++
        spans.push(...expression())
      }
      pos++
      return operator[1] === 'complement'
        ? spans
            .toReversed()
            .map(s => ({ ...s, strand: s.strand === 1 ? -1 : 1 }))
        : spans
    } else if (gap) {
      pos = GAP.lastIndex
      return []
    } else if (span) {
      pos = SPAN.lastIndex
      const [, remote, from, , to] = span
      const start = Number(from) - 1
      return remote && !isOwn(remote.slice(0, -1), refName)
        ? []
        : [{ start, end: to === undefined ? start + 1 : Number(to), strand: 1 }]
    } else {
      return []
    }
  }

  return expression()
}

function extent(spans: Span[]) {
  return (
    Math.max(...spans.map(s => s.end)) - Math.min(...spans.map(s => s.start))
  )
}

function merged(spans: Span[]) {
  const out: Span[] = []
  for (const s of spans) {
    const last = out.at(-1)
    if (last?.end === s.start) {
      last.end = s.end
    } else {
      out.push({ ...s })
    }
  }
  return out
}

function wrappedOnce(written: Span[], length: number) {
  const closed = written.map(s =>
    s.end <= s.start ? { ...s, end: s.end + length } : s,
  )
  const descent = closed.findIndex(
    (s, i) => s.start < (closed[i - 1]?.start ?? -Infinity),
  )
  const shifted = closed.map((s, i) =>
    descent > 0 && i >= descent
      ? { ...s, start: s.start + length, end: s.end + length }
      : s,
  )
  return extent(shifted) < extent(closed) ? shifted : closed
}

/**
 * Same-strand spans with abutting ones merged. When `wraps`, a span starting
 * before the one ahead of it crosses the origin into virtual coordinates
 * (`join(a..L,1..b)` is one span a..L+b), once, and only if that shortens the
 * feature.
 */
export function placeSpans(spans: Span[], length: number, wraps: boolean) {
  const minus = spans.every(s => s.strand === -1)
  const written = minus ? spans.toReversed() : spans
  const placed = merged(wraps ? wrappedOnce(written, length) : written)
  return !minus && !spans.every(s => s.strand === 1)
    ? spans
    : minus
      ? placed.toReversed()
      : placed
}
