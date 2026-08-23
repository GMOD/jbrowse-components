import {
  INSTANCE_STRIDE_WORDS,
  getInstancePosition,
  setInstanceCount,
  setInstancePosition,
} from './components/shaders/hic.iface.generated.ts'
import { findContactAt } from './contactLookup.ts'

import type { RegionPairRun } from '../HicAdapter/HicAdapter.ts'
import type { HicDataResult } from '../RenderHicDataRPC/types.ts'

const W = 4 // binWidth in pre-rotation px

/**
 * Build an `HicDataResult` directly, inverting the worker's own position math
 * (`positions[i*2] = (bin + regions[r].combinedOffset) * binWidth`) so a hover at
 * a known cell center must land on a known contact. `reversedMirror.test.ts`
 * already drives the real worker for the orientation/mirror cases; this fixture
 * exists to stress the lookup table itself — collisions at scale, misses, and
 * the region component of the key.
 *
 * Region r hosts bins `[binBase[r], binBase[r] + span)` and occupies data-x
 * `[r*span*W, (r+1)*span*W)`, so `findRegion` buckets each cell into its own
 * region.
 */
function makeData(
  contacts: { r1: number; r2: number; bin1: number; bin2: number }[],
  {
    binBase,
    span,
    reversed = binBase.map(() => false),
  }: { binBase: number[]; span: number; reversed?: boolean[] },
) {
  const n = contacts.length
  const offsets = binBase.map((base, r) => r * span - base)
  const regions = binBase.map((_, r) => ({
    refName: `chr${r + 1}`,
    dataXStart: r * span * W,
    dataXEnd: (r + 1) * span * W,
    combinedOffset: offsets[r]!,
    reversed: reversed[r]!,
  }))
  // the worker's own pack: reflect inside the region, then re-canonicalize, so
  // a reversed region's stored x is the endpoint that ends up leftmost
  function pack(bin: number, r: number) {
    const region = regions[r]!
    const u = (bin + offsets[r]!) * W
    return region.reversed ? region.dataXStart + region.dataXEnd - W - u : u
  }
  const instances = new Float32Array(n * INSTANCE_STRIDE_WORDS)
  // region membership as runs, cut wherever the pair changes — the shape the
  // adapter emits and the worker forwards. There are no per-contact bin columns
  // to fill: the lookup recovers each bin from the position below, which is the
  // round trip this suite is now also covering.
  const pairRuns: RegionPairRun[] = []
  contacts.forEach(({ r1, r2, bin1, bin2 }, i) => {
    const m1 = pack(bin1, r1)
    const m2 = pack(bin2, r2)
    setInstancePosition(instances, i, Math.min(m1, m2), Math.max(m1, m2))
    // unique, so a hover identifies exactly one contact
    setInstanceCount(instances, i, i + 1)
    const open = pairRuns.at(-1)
    if (open && open.region1Idx === r1 && open.region2Idx === r2) {
      open.end = i + 1
    } else {
      pairRuns.push({ region1Idx: r1, region2Idx: r2, start: i, end: i + 1 })
    }
  })
  return {
    instances,
    numContacts: n,
    maxScore: n,
    percentile95: n,
    binWidth: W,
    originBp: 0,
    resolution: 1000,
    appliedNormalization: 'KR',
    regions,
    pairRuns,
  } satisfies HicDataResult
}

// Hover the center of contact i's cell, in the pre-rotation space the packed
// positions live in — the same coordinates model.hitTest hands findContactAt.
function hoverCenter(d: HicDataResult, i: number) {
  return findContactAt(
    d,
    getInstancePosition(d.instances, i, 0) + W / 2,
    getInstancePosition(d.instances, i, 1) + W / 2,
  )
}

describe('contact lookup table', () => {
  // The triangle is the shape that stresses a hash: bin1 and bin2 are close
  // together and the absolute indices are large (a fine binsize on a real
  // chromosome), which is exactly where a weak mix clusters.
  test('every contact in a large triangle resolves to itself', () => {
    const base = 120_000
    const span = 100
    const contacts = []
    for (let a = 0; a < span; a++) {
      for (let b = a; b < span; b++) {
        contacts.push({ r1: 0, r2: 0, bin1: base + a, bin2: base + b })
      }
    }
    const d = makeData(contacts, { binBase: [base], span })
    expect(d.numContacts).toBe((span * (span + 1)) / 2)
    for (let i = 0; i < d.numContacts; i++) {
      // counts is unique per contact, so this pins the exact index, not just a
      // cell with matching coordinates
      expect(hoverCenter(d, i)).toEqual({
        bin1: contacts[i]!.bin1,
        bin2: contacts[i]!.bin2,
        region1Idx: 0,
        region2Idx: 0,
        counts: i + 1,
      })
    }
  })

  test('an empty cell reports no contact', () => {
    const base = 120_000
    const d = makeData(
      [
        { r1: 0, r2: 0, bin1: base, bin2: base },
        { r1: 0, r2: 0, bin1: base + 5, bin2: base + 9 },
      ],
      { binBase: [base], span: 100 },
    )
    // bin (base+2, base+3) carries no contact
    expect(findContactAt(d, (2 + 0.5) * W, (3 + 0.5) * W)).toBeUndefined()
  })

  test('the same bin pair in two region pairs stays distinct', () => {
    const span = 50
    const binBase = [1000, 2000]
    // identical bin *offsets* within each region, so only the region part of
    // the key separates them
    const d = makeData(
      [
        { r1: 0, r2: 0, bin1: 1010, bin2: 1020 },
        { r1: 1, r2: 1, bin1: 2010, bin2: 2020 },
        { r1: 0, r2: 1, bin1: 1010, bin2: 2020 },
      ],
      { binBase, span },
    )
    expect(hoverCenter(d, 0)).toMatchObject({ region1Idx: 0, region2Idx: 0 })
    expect(hoverCenter(d, 1)).toMatchObject({ region1Idx: 1, region2Idx: 1 })
    expect(hoverCenter(d, 2)).toMatchObject({ region1Idx: 0, region2Idx: 1 })
    expect(new Set([0, 1, 2].map(i => hoverCenter(d, i)!.counts)).size).toBe(3)
  })

  test('a reversed region hovers back to the bins it was packed from', () => {
    const base = 120_000
    const span = 40
    const contacts = []
    for (let a = 0; a < span; a++) {
      for (let b = a; b < span; b++) {
        contacts.push({ r1: 0, r2: 0, bin1: base + a, bin2: base + b })
      }
    }
    const d = makeData(contacts, {
      binBase: [base],
      span,
      reversed: [true],
    })
    for (let i = 0; i < d.numContacts; i++) {
      expect(hoverCenter(d, i)).toEqual({
        bin1: contacts[i]!.bin1,
        bin2: contacts[i]!.bin2,
        region1Idx: 0,
        region2Idx: 0,
        counts: i + 1,
      })
    }
  })

  test('one reversed region beside a forward one keeps the pairs apart', () => {
    const span = 50
    const binBase = [1000, 2000]
    const contacts = [
      { r1: 0, r2: 0, bin1: 1010, bin2: 1020 },
      { r1: 1, r2: 1, bin1: 2010, bin2: 2020 },
      { r1: 0, r2: 1, bin1: 1010, bin2: 2020 },
      { r1: 0, r2: 1, bin1: 1049, bin2: 2000 },
    ]
    // only the second region is mirrored, so the cross-region pair has one
    // reflected endpoint and one that is not
    const d = makeData(contacts, { binBase, span, reversed: [false, true] })
    contacts.forEach(({ r1, r2, bin1, bin2 }, i) => {
      expect(hoverCenter(d, i)).toEqual({
        bin1,
        bin2,
        region1Idx: r1,
        region2Idx: r2,
        counts: i + 1,
      })
    })
  })

  test('a bin adjacent to a contact in a reversed region reports nothing', () => {
    const d = makeData(
      [
        { r1: 0, r2: 0, bin1: 1010, bin2: 1020 },
        { r1: 0, r2: 0, bin1: 1012, bin2: 1022 },
      ],
      { binBase: [1000], span: 50, reversed: [true] },
    )
    const hit = hoverCenter(d, 0)!
    // one cell along the x axis from a contact that does exist
    const ux = getInstancePosition(d.instances, 0, 0) + W + W / 2
    const uy = getInstancePosition(d.instances, 0, 1) + W / 2
    expect(hit.counts).toBe(1)
    expect(findContactAt(d, ux, uy)).toBeUndefined()
  })

  test('a single contact works, so the smallest table is still probed', () => {
    const d = makeData([{ r1: 0, r2: 0, bin1: 7, bin2: 7 }], {
      binBase: [7],
      span: 4,
    })
    expect(hoverCenter(d, 0)).toMatchObject({ bin1: 7, bin2: 7, counts: 1 })
  })
})
