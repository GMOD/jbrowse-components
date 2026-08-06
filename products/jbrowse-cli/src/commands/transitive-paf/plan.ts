import { panSNSample } from './paf.ts'

import type { PafRow } from './paf.ts'

/**
 * What one streaming pass over the PAF observed: which PanSN samples it holds
 * and how many rows align each pair of them. Symmetric — a pair is recorded
 * under both of its samples — because "does A align to B" has no direction.
 */
export interface Census {
  samples: Set<string>
  pairs: Map<string, Map<string, number>>
  rows: number
  // Whether ANY sequence name carries a PanSN separator. Without one every name
  // is its own "sample", so a plain pairwise PAF looks like a two-sample file
  // that happens to state its only pair — and this command would report success
  // having done nothing. A sample name never contains the separator (that is
  // what splits it off), so its presence anywhere is the test.
  anyPanSN: boolean
}

export function emptyCensus(): Census {
  return { samples: new Set(), pairs: new Map(), rows: 0, anyPanSN: false }
}

function bump(pairs: Census['pairs'], from: string, to: string) {
  let row = pairs.get(from)
  if (!row) {
    row = new Map()
    pairs.set(from, row)
  }
  row.set(to, (row.get(to) ?? 0) + 1)
}

export function censusRow(census: Census, row: PafRow) {
  const q = panSNSample(row.qname)
  const t = panSNSample(row.tname)
  census.anyPanSN ||= row.qname.includes('#') || row.tname.includes('#')
  census.samples.add(q)
  census.samples.add(t)
  census.rows++
  bump(census.pairs, q, t)
  if (q !== t) {
    bump(census.pairs, t, q)
  }
}

/** One sample pair to fill in, and the sample to route it through. */
export interface Task {
  a: string
  b: string
  via: string
}

/**
 * Which sample pairs the file does not state directly, and what to compose each
 * of them through.
 *
 * An "all-vs-all" PAF very often isn't: wfmash with a `-p` threshold drops
 * distant pairs, and plenty of real files are a star — everything mapped to one
 * reference. Those files load fine and then draw an empty band for any pair the
 * aligner never emitted, which is indistinguishable from a locus with no
 * homology. Each such pair gets exactly ONE intermediate (the one with the most
 * rows to both ends, name as the tiebreak) rather than every viable one:
 * composing through several restates the same homology once per route, which is
 * the doubled-ribbon problem the adapters already have to undo.
 */
export function planCompositions(census: Census, via?: string): Task[] {
  const samples = [...census.samples].sort()
  const count = (x: string, y: string) => census.pairs.get(x)?.get(y) ?? 0
  const tasks: Task[] = []
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const a = samples[i]!
      const b = samples[j]!
      if (count(a, b) > 0) {
        continue
      }
      const usable = (
        via === undefined ? [...(census.pairs.get(a)?.keys() ?? [])] : [via]
      ).filter(v => v !== a && v !== b && count(a, v) > 0 && count(b, v) > 0)
      if (usable.length === 0) {
        continue
      }
      usable.sort(
        (x, y) =>
          count(a, y) + count(b, y) - (count(a, x) + count(b, x)) ||
          (x < y ? -1 : 1),
      )
      tasks.push({ a, b, via: usable[0]! })
    }
  }
  return tasks
}

/**
 * The sample pairs pass 2 has to keep in memory: the two legs of every task.
 * Anything else in the file streams past.
 */
export function neededLegs(tasks: Task[]) {
  const legs = new Set<string>()
  for (const { a, b, via } of tasks) {
    legs.add(legKey(a, via))
    legs.add(legKey(b, via))
  }
  return legs
}

/** Order-independent key for the pair of samples a row aligns. */
export function legKey(x: string, y: string) {
  // NUL joiner, written as an escape: a PAF sequence name can contain any
  // printable character, so a visible separator could collide with a real name.
  return x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`
}
