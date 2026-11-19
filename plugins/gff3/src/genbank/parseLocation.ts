export interface Span {
  start: number
  end: number
  strand: 1 | -1
}

const OPERATOR = /(complement|join|order|bond)\(/y
const GAP = /gap\([^)]*\)/y
const SPAN = /([\w.]+:)?[<>]?(\d+)(?:(\.\.|\^|\.)[<>]?(\d+))?/y

function matchAt(regex: RegExp, text: string, pos: number) {
  regex.lastIndex = pos
  return regex.exec(text)
}

/**
 * The spans an INSDC location string names, 0-based half-open, in the order
 * the feature is transcribed: `complement(join(a,b))` and
 * `join(complement(b),complement(a))` both answer b then a on strand -1.
 *
 * `<`/`>` partial markers are dropped, a span on another entry (`ACC:1..9`)
 * and a `gap()` are skipped, and the site between two bases (`n^n+1`) covers
 * both of them. `order` and `bond` read as `join`.
 */
export function parseLocation(location: string) {
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
      return remote
        ? []
        : [{ start, end: to === undefined ? start + 1 : Number(to), strand: 1 }]
    } else {
      return []
    }
  }

  return expression()
}

/**
 * Spans placed on a sequence `length` long. On a circular one, a span that
 * starts before the one written ahead of it, as `join(a..L,1..b)` does, and a
 * span whose end comes before its start, as `L^1` does, continue past the
 * origin in "virtual" coordinates, the form GFF3 writes such a feature in and
 * `cutAtOrigin` cuts; the two spans meeting at the origin become one. Mixed-
 * strand joins (trans-splicing) are left as written.
 */
export function placeSpans(spans: Span[], length: number, circular: boolean) {
  const minus = spans.every(s => s.strand === -1)
  const sameStrand = minus || spans.every(s => s.strand === 1)
  if (!circular || !sameStrand) {
    return spans
  }
  const written = minus ? spans.toReversed() : spans
  const placed: Span[] = []
  let offset = 0
  for (const s of written) {
    const previous = placed.at(-1)
    if (previous && s.start + offset < previous.start) {
      offset += length
    }
    const start = s.start + offset
    const end = s.end + offset
    if (previous?.end === start) {
      previous.end = end
    } else {
      placed.push({ ...s, start, end: end <= start ? end + length : end })
    }
  }
  return minus ? placed.toReversed() : placed
}
