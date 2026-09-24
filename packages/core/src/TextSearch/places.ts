import { assembleLocString, parseLocString } from '../util/index.ts'

import type { Assembly } from '../assemblyManager/assembly.ts'
import type BaseResult from './BaseResults.ts'

// One spelling of a locstring, so two indexes that answer `chr1:1-100` and
// `1:1..100` are recognised as one place. An unparseable string is compared
// raw, which can only split a group that would otherwise have merged.
export function canonicalLocString(locString: string, assembly: Assembly) {
  try {
    const loc = parseLocString(locString, refName =>
      assembly.isValidRefName(refName),
    )
    return assembleLocString({
      ...loc,
      refName: assembly.getCanonicalRefName2(loc.refName),
    })
  } catch (e) {
    console.warn('failed to parse location string', locString, e)
    return locString
  }
}

function spanOf(locString: string, assembly: Assembly) {
  try {
    const { refName, start, end } = parseLocString(locString, r =>
      assembly.isValidRefName(r),
    )
    return start === undefined || end === undefined
      ? undefined
      : { refName: assembly.getCanonicalRefName2(refName), start, end }
  } catch {
    return undefined
  }
}

/**
 * Hits grouped by the place they go, groups and members in the order given.
 * Hits are one place when they carry one name and either the same location or
 * overlapping spans on one sequence: two gene tracks drawing one gene with
 * slightly different ends answer one place, not a choice. A hit with no
 * location, or one the assembly cannot yet resolve into a span, joins only an
 * identical locstring.
 */
export function groupByPlace(results: BaseResult[], assembly?: Assembly) {
  const root = results.map((_, i) => i)
  const find = (i: number): number =>
    root[i] === i ? i : (root[i] = find(root[i]!))
  const join = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    root[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const resolved = !!assembly?.initialized
  const firstAt = new Map<string, number>()
  const spans = []
  for (const [i, result] of results.entries()) {
    const locString = result.getLocation()
    if (locString) {
      const name = result.getDisplayString()
      const key = [
        name,
        resolved ? canonicalLocString(locString, assembly) : locString,
      ].join('\u0000')
      const seen = firstAt.get(key)
      if (seen === undefined) {
        firstAt.set(key, i)
      } else {
        join(seen, i)
      }
      const span = resolved ? spanOf(locString, assembly) : undefined
      if (span) {
        spans.push({ i, seq: [name, span.refName].join('\u0000'), ...span })
      }
    }
  }

  spans.sort((a, b) =>
    a.seq === b.seq ? a.start - b.start : a.seq < b.seq ? -1 : 1,
  )
  let run: (typeof spans)[number] | undefined
  let runEnd = 0
  for (const span of spans) {
    if (run?.seq === span.seq && span.start < runEnd) {
      join(run.i, span.i)
      runEnd = Math.max(runEnd, span.end)
    } else {
      run = span
      runEnd = span.end
    }
  }

  const groups = new Map<number, BaseResult[]>()
  for (const [i, result] of results.entries()) {
    const r = find(i)
    const group = groups.get(r)
    if (group) {
      group.push(result)
    } else {
      groups.set(r, [result])
    }
  }
  return [...groups.values()]
}
