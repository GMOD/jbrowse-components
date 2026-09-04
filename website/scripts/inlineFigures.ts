// Re-resolving the `<!--m:<ref>-->` markers in one doc's text, for
// `sync-inline-figures.ts`.
//
// Its own module so a test can import it. The script walks three doc trees and
// exits at import time, so anything importing it to test one function runs the
// whole sync instead.
import { resolveReference } from './measurements.ts'

import type { Measurement } from './measurements.ts'

// Every marker, whatever follows `m:`. A reference this cannot parse is
// `resolveReference`'s error to report; a marker this pattern skipped would be
// one nothing judges at all, which is the failure below.
const MARKER = /<!--m:([^\n>]*)-->/g

// The value a marker refreshes: a digit and then anything that is not a space
// or a `<`. Deliberately narrower than `\S+`, which would swallow an opening
// bracket or quote sitting against the figure and then delete it on the next
// regeneration.
const VALUE = /\d[^\s<]*$/

export interface InlineFigures {
  text: string
  problems: string[]
  count: number
}

/**
 * `text` with every marker's value re-resolved from `records`.
 *
 * A marker that does not follow a figure is a problem rather than a no-op, and
 * both spellings of that used to be silent. One is a marker written on its own.
 * The other is a value with a space in it — `1.4 MB<!--m:…-->`, where the
 * marker follows `MB` and nothing figure-shaped touches it — where the pair
 * looks maintained and neither half is checked by anything.
 */
export function spliceInlineFigures(
  text: string,
  records: Map<string, Measurement>,
): InlineFigures {
  const problems: string[] = []
  let out = ''
  let at = 0
  let count = 0
  for (const marker of text.matchAll(MARKER)) {
    const ref = marker[1]!
    const before = text.slice(at, marker.index)
    const value = VALUE.exec(before)?.[0]
    if (value === undefined) {
      const precedes = /\S+$/.exec(before)?.[0]
      problems.push(
        precedes === undefined
          ? `<!--m:${ref}--> has no figure in front of it — write the value, then the marker, with no space between`
          : `<!--m:${ref}--> follows "${precedes}", which is not a figure — the pair is one token, so the value carries no space either (\`1.4MB\`)`,
      )
      out += before + marker[0]
    } else {
      count++
      try {
        const resolved = resolveReference(records, ref)
        out += before.slice(0, before.length - value.length) + resolved
        out += marker[0]
      } catch (e) {
        problems.push((e as Error).message)
        out += before + marker[0]
      }
    }
    at = marker.index + marker[0].length
  }
  return { text: out + text.slice(at), problems, count }
}
