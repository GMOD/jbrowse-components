import { parseModHeader } from './consts.ts'
import { getModPositions } from './getModPositions.ts'
import { isSingleModType } from './getModTypes.ts'

// A differential fuzz against an independently written reference.
//
// `getModPositions` accumulated three optimizations — one positions array shared
// between same-base groups, a forward walk that jumps with `indexOf` instead of
// stepping, and an end-of-sequence clamp — and the evidence for them is two BAM
// fixtures. Those agree on 21.81M calls and say nothing about the inputs they
// happen not to contain: an empty read, a group with no deltas, a tag whose
// deltas run off the end, `U`, `N`, a ChEBI code, an uppercase ambiguity code, or
// two groups on one base that differ in their last delta only.
//
// The reference below is deliberately NOT the shipped algorithm written twice.
// It enumerates every index the group's base occupies, in the order the walk
// would visit them, and then indexes into that list — no cursor, no do-while, no
// sharing. If the two agree across a few thousand random tags, the cursor
// arithmetic and the sharing are doing what the simple formulation says.
//
// Seeded, so a failure is reproducible: the seed is printed with any mismatch.

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  N: 'N',
}

interface RefMod {
  type: string
  base: string
  positions: number[]
  probStart: number
  probStride: number
}

function reference(mm: string, fseq: string, fstrand: number): RefMod[] {
  const len = fseq.length
  const isRev = fstrand === -1
  const out: RefMod[] = []
  let mlBase = 0

  for (const group of mm.split(';')) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const { base, typestr } = parseModHeader(split[0]!, group)
    const isSingle = isSingleModType(typestr)
    const nTypes = isSingle ? 1 : typestr.length
    const nPositions = split.length - 1

    // Every index this group's base occupies, in visit order. Reverse reads are
    // visited from the back and match the complement, which is what the shipped
    // walk does by reading fseq backwards rather than reverse-complementing it.
    const target = isRev ? (COMPLEMENT[base] ?? base) : base
    const isN = base === 'N'
    const hits: number[] = []
    for (let k = 0; k < len; k++) {
      const idx = isRev ? len - 1 - k : k
      if (isN || fseq[idx] === target) {
        hits.push(idx)
      }
    }

    // A delta of d means "skip d of them, take the next", so the call sits at
    // hits[cursor + d]. Once there are not enough left, this call and every call
    // after it clamp to the nearest valid index.
    const clamp = isRev ? 0 : Math.max(0, len - 1)
    const positions: number[] = []
    let cursor = 0
    let exhausted = false
    for (let i = 1; i < split.length; i++) {
      const d = +split[i]!
      if (!exhausted && cursor + d < hits.length) {
        positions.push(hits[cursor + d]!)
        cursor += d + 1
      } else {
        exhausted = true
        positions.push(clamp)
      }
    }
    if (isRev) {
      positions.reverse()
    }

    if (isSingle) {
      out.push({
        type: typestr,
        base,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0; j < typestr.length; j++) {
        out.push({
          type: typestr[j]!,
          base,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }
  return out
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASES = ['A', 'C', 'G', 'T', 'U', 'N']
const TYPES = ['m', 'h', 'a', 'mh', 'mhfc', 'C', 'T', '16061', '76792']
const FLAGS = ['', '.', '?']

function choose<T>(xs: T[], rnd: () => number): T {
  return xs[Math.floor(rnd() * xs.length)]!
}

function makeCase(rnd: () => number) {
  const pick = (xs: string[]) => choose(xs, rnd)
  // Include 0 and 1 so the degenerate reads are actually generated.
  const len = Math.floor(rnd() * rnd() * 60)
  let fseq = ''
  for (let i = 0; i < len; i++) {
    // Skewed alphabet so some bases are absent from some reads, which is what
    // makes a delta list run off the end.
    fseq += pick(['A', 'C', 'G', 'T', 'A', 'C', 'N', 'U'])
  }
  const fstrand = rnd() < 0.5 ? 1 : -1

  const nGroups = 1 + Math.floor(rnd() * 4)
  const groups: string[] = []
  for (let g = 0; g < nGroups; g++) {
    // Repeat a previous group verbatim sometimes, so the same-base merge fires;
    // and repeat it with one delta changed, so the near-miss is exercised too.
    if (groups.length > 0 && rnd() < 0.35) {
      const src = pick(groups)
      if (rnd() < 0.5) {
        groups.push(src)
        continue
      }
      const parts = src.split(',')
      if (parts.length > 1) {
        const at = 1 + Math.floor(rnd() * (parts.length - 1))
        parts[at] = String(Math.floor(rnd() * 8))
        groups.push(parts.join(','))
        continue
      }
    }
    const base = pick(BASES)
    const strand = rnd() < 0.8 ? '+' : '-'
    const header = `${base}${strand}${pick(TYPES)}${pick(FLAGS)}`
    const nDeltas = Math.floor(rnd() * 8)
    const deltas: number[] = []
    for (let d = 0; d < nDeltas; d++) {
      // Mostly small, occasionally larger than the read can satisfy.
      deltas.push(rnd() < 0.15 ? Math.floor(rnd() * 90) : Math.floor(rnd() * 4))
    }
    groups.push([header, ...deltas].join(','))
  }
  // Trailing ';' is what real tags carry; sometimes omit it.
  const mm = groups.join(';') + (rnd() < 0.7 ? ';' : '')
  return { mm, fseq, fstrand }
}

// **A fuzz that generates none of the interesting shapes passes anyway**, which
// is the failure this whole thread keeps meeting — `multiGroupParse.bench.ts`
// reported "output identical" for as long as it existed because no read in any
// fixture overran. So the generator's coverage is asserted, not assumed. The
// floors are set well below what it currently produces; they exist to fail if a
// change to `makeCase` quietly stops producing one of these.
test('the fuzz generator covers the shapes that matter', () => {
  const rnd = mulberry32(0x5eed)
  const seen = {
    reverse: 0,
    clamped: 0,
    merged: 0,
    baseN: 0,
    baseU: 0,
    combined: 0,
    chebi: 0,
    emptyRead: 0,
    emptyGroup: 0,
  }
  for (let iter = 0; iter < 4000; iter++) {
    const { mm, fseq, fstrand } = makeCase(rnd)
    if (fstrand === -1) {
      seen.reverse++
    }
    if (fseq.length === 0) {
      seen.emptyRead++
    }
    const mods = getModPositions(mm, fseq, fstrand)
    const hi = Math.max(0, fseq.length - 1)
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i]!
      if (m.base === 'N') {
        seen.baseN++
      }
      if (m.base === 'U') {
        seen.baseU++
      }
      if (m.positions.length === 0) {
        seen.emptyGroup++
      }
      // A clamped tail shows as two calls resting on the same boundary index.
      const p = m.positions
      const edge = fstrand === -1 ? 0 : hi
      if (p.length > 1 && p.filter(v => v === edge).length > 1) {
        seen.clamped++
      }
      for (let j = i + 1; j < mods.length; j++) {
        if (
          mods[j]!.positions === p &&
          mods[j]!.probStride === 1 &&
          m.probStride === 1
        ) {
          seen.merged++
        }
      }
    }
    for (const group of mm.split(';')) {
      if (group === '') {
        continue
      }
      const t = /[ACGTUN][-+]([a-z]+|[A-Z]|[0-9]+)/.exec(group)?.[1] ?? ''
      if (t.length > 1 && t.charCodeAt(0) >= 97) {
        seen.combined++
      }
      if (t.charCodeAt(0) < 65) {
        seen.chebi++
      }
    }
  }
  // Measured 2026-08-14: reverse 2002, clamped 9242, merged 958, N 2412,
  // U 2428, combined 2187, chebi 2227, emptyRead 328, emptyGroup 1645.
  const floors = {
    reverse: 500,
    clamped: 200,
    merged: 100,
    baseN: 200,
    baseU: 200,
    combined: 200,
    chebi: 200,
    emptyRead: 10,
    emptyGroup: 200,
  }
  for (const k of Object.keys(floors) as (keyof typeof floors)[]) {
    expect(`${k} >= ${floors[k]} :: ${seen[k] >= floors[k]}`).toBe(
      `${k} >= ${floors[k]} :: true`,
    )
  }
})

test('getModPositions matches a reference implementation on random tags', () => {
  const rnd = mulberry32(0x5eed)
  for (let iter = 0; iter < 4000; iter++) {
    const { mm, fseq, fstrand } = makeCase(rnd)
    const where = `iter ${iter}: mm="${mm}" seq="${fseq}" strand=${fstrand}`

    const got = getModPositions(mm, fseq, fstrand)
    const want = reference(mm, fseq, fstrand)

    expect(`${where} :: ${got.length}`).toBe(`${where} :: ${want.length}`)
    for (let i = 0; i < want.length; i++) {
      const a = got[i]!
      const b = want[i]!
      expect(`${where} entry ${i} type :: ${a.type} ${a.base}`).toBe(
        `${where} entry ${i} type :: ${b.type} ${b.base}`,
      )
      expect(`${where} entry ${i} ml :: ${a.probStart}/${a.probStride}`).toBe(
        `${where} entry ${i} ml :: ${b.probStart}/${b.probStride}`,
      )
      expect(`${where} entry ${i} pos :: ${a.positions.join(',')}`).toBe(
        `${where} entry ${i} pos :: ${b.positions.join(',')}`,
      )
    }
  }
})

// Three properties every consumer relies on, asserted directly rather than via
// the reference — a reference that shared a bug would agree with the code.
test('getModPositions emits in-range, ascending positions on random tags', () => {
  const rnd = mulberry32(0xd1ce)
  for (let iter = 0; iter < 4000; iter++) {
    const { mm, fseq, fstrand } = makeCase(rnd)
    const where = `iter ${iter}: mm="${mm}" seq="${fseq}" strand=${fstrand}`
    const mods = getModPositions(mm, fseq, fstrand)
    const hi = Math.max(0, fseq.length - 1)

    for (const mod of mods) {
      const p = mod.positions
      // In range: these index the read (`getMethBins` reads the sequence at
      // them), so an out-of-range one is a wrong answer, not a dropped one.
      const bad = p.find(v => !Number.isInteger(v) || v < 0 || v > hi)
      expect(`${where} out-of-range :: ${bad ?? 'none'}`).toBe(
        `${where} out-of-range :: none`,
      )
      // Ascending: the CIGAR walk consumes them with a single forward cursor,
      // so an out-of-order one is silently skipped or mapped against the wrong
      // op. Equal values are legal — that is what a clamped tail looks like.
      let descent = -1
      for (let i = 1; i < p.length; i++) {
        if (p[i]! < p[i - 1]!) {
          descent = i
          break
        }
      }
      expect(`${where} descent-at :: ${descent}`).toBe(
        `${where} descent-at :: -1`,
      )
      // Dense: a hole would read as `undefined` in the CIGAR walk's comparison.
      expect(`${where} holes :: ${p.length === [...p].length}`).toBe(
        `${where} holes :: true`,
      )
    }
  }
})

// The sharing is a contract, not an implementation detail: `forEachMaxProbMod`
// groups entries by positions-array IDENTITY to walk the CIGAR once for them.
// Two groups that resolve to the same positions must therefore be the same
// object, and two that do not must not be.
test('getModPositions shares an array exactly when the walks coincide', () => {
  const rnd = mulberry32(0xf00d)
  for (let iter = 0; iter < 4000; iter++) {
    const { mm, fseq, fstrand } = makeCase(rnd)
    const where = `iter ${iter}: mm="${mm}" seq="${fseq}" strand=${fstrand}`
    const mods = getModPositions(mm, fseq, fstrand)

    for (let i = 0; i < mods.length; i++) {
      for (let j = i + 1; j < mods.length; j++) {
        const a = mods[i]!
        const b = mods[j]!
        const sameObject = a.positions === b.positions
        if (sameObject) {
          // Sharing must never be wrong about the values.
          expect(`${where} shared ${i},${j} :: ${a.positions.join(',')}`).toBe(
            `${where} shared ${i},${j} :: ${b.positions.join(',')}`,
          )
        }
      }
    }
  }
})
