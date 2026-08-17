// Pulling `<number><unit>` figures out of prose, for `check-quoted-figures.ts`.
//
// Its own module so a test can import it. The checker walks the docs tree and
// exits at import time, so anything importing it to test one function runs the
// whole check instead.

// A number with a unit, and nothing else. The unit list is deliberately closed:
// an open one ("any word") matches "5 workers" and "3 rows", which are counts
// the prose owns rather than figures it quotes.
export const UNITS = [
  'x',
  '%',
  'ms',
  's',
  'KB',
  'MB',
  'GB',
  'KiB',
  'MiB',
  'GiB',
  'kb',
  'Mb',
  'Gb',
  'bp',
  'Gbp',
  'Mbp',
  'kbp',
]

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`

// A range shares one unit across two numbers — `70-90%` is two figures, and the
// lower one is the half a re-measurement moves first.
//
// The dash is unspaced on purpose. Allowing `\s?[-–]\s?` makes "four workers -
// 1.95x" parse as a range and invents a `4x` nobody wrote; every range the house
// style writes (`70-90%`, `2.6-3.5x`, `1.13-1.24x`) is unspaced.
export const FIGURE = new RegExp(
  String.raw`(?<![\w.])(?:(${NUMBER})[-–])?(${NUMBER})\s?(${UNITS.join('|')})(?![\w])`,
  'g',
)

/** `1,234.5 MB` and `1234.5MB` are the same figure written twice. */
export function normalize(value: string, unit: string) {
  return `${value.replaceAll(',', '')}${unit.toLowerCase()}`
}

/**
 * Every figure in `text`, normalized value → the text as written.
 *
 * Both ends of a range are returned. That is the property worth testing: the
 * first number of `70-90%` is followed by `-` rather than a unit, so a pattern
 * written without the optional range prefix matches only `90%` and reports the
 * page clean while its lower bound says anything at all.
 */
export function figuresIn(text: string) {
  const found = new Map<string, string>()
  for (const m of text.matchAll(FIGURE)) {
    // The `\s?` between number and unit matches the newline a wrapped paragraph
    // puts there, so the text as written can span two lines. Collapse it for the
    // report — a failure quoting `"80\nKiB"` reads as a checker bug.
    const written = m[0].replaceAll(/\s+/g, ' ')
    const [, low, high, unit] = m
    found.set(normalize(high!, unit!), written)
    if (low !== undefined) {
      // Name the end that failed, not the range it came from: a reader told
      // `"70-90%"` is unrecorded searches for that string and finds it right
      // where the report said it was.
      found.set(normalize(low, unit!), `${low}${unit} (from "${written}")`)
    }
  }
  return found
}
