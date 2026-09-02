import { nextGateState } from './regionTooLargeUtils.ts'

import type { GateEvent, GateState } from './regionTooLargeUtils.ts'

// The half `gateTruthTable.test.ts` says it cannot see. That one enumerates the
// derived getters over every combination of leaves — a cross-product of *states*
// — and every rule in `nextGateState` is instead about an *order*: which of two
// measurements wins, what a clear leaves behind, what an approval outlives. The
// 2026-08 tier-key bug lived there, and the example test pinning it could only
// be written once somebody had thought of the interleaving.
//
// So: named cases for the four rules, then a seeded walk over event sequences
// against a model written the way the rules are stated rather than the way they
// are implemented. The walk is what finds an interleaving nobody named.

const TIER_A = 'adapterA'
const TIER_B = 'adapterB'

const EMPTY: GateState = {
  byteEstimate: undefined,
  gateMeasuredViewportKey: undefined,
  forceLoadTrack: false,
}

function viewport(key: string, spanBp = 1000) {
  return { key, spanBp }
}

function measured(
  opts: {
    key?: string
    spanBp?: number
    gated?: boolean
    tierKey?: string
    currentTierKey?: string
    bytes?: number
  } = {},
): GateEvent {
  return {
    kind: 'measurement',
    issued: {
      viewport: viewport(opts.key ?? 'chr1:0-100', opts.spanBp),
      gated: opts.gated ?? true,
      tierKey: opts.tierKey,
    },
    currentTierKey: opts.currentTierKey,
    bytes: opts.bytes,
  }
}

describe('the four rules, named', () => {
  // The bug this branch fixed: a fetch still in flight when the tier swaps
  // would re-instate the old tier's bytes right behind the clear that dropped
  // them, and the banner quoted megabytes against a summary read.
  it('drops a measurement issued against a tier that is no longer live', () => {
    const loaded = nextGateState(
      EMPTY,
      measured({ tierKey: TIER_A, currentTierKey: TIER_A, bytes: 500 }),
    )
    const swapped = nextGateState(loaded, { kind: 'invalidated' })
    const late = nextGateState(
      swapped,
      measured({ tierKey: TIER_A, currentTierKey: TIER_B, bytes: 900_000 }),
    )
    expect(late).toBe(swapped)
    expect(late.byteEstimate).toBeUndefined()
  })

  // An ungated display has no tier to disagree about, so the guard must not
  // silently swallow its measurements.
  it('accepts a measurement from a display that never gates', () => {
    const next = nextGateState(
      EMPTY,
      measured({ tierKey: undefined, currentTierKey: TIER_B, bytes: 500 }),
    )
    expect(next.byteEstimate?.bytes).toBe(500)
  })

  it('stamps no viewport for a fetch the gate sat out', () => {
    const next = nextGateState(EMPTY, measured({ gated: false, bytes: 500 }))
    expect(next.gateMeasuredViewportKey).toBeUndefined()
    // it still measured, though — the two halves are independent
    expect(next.byteEstimate?.bytes).toBe(500)
  })

  it('leaves a stored estimate alone when the fetch measured no bytes', () => {
    const loaded = nextGateState(EMPTY, measured({ bytes: 500 }))
    const density = nextGateState(loaded, measured({ key: 'chr1:0-200' }))
    expect(density.byteEstimate?.bytes).toBe(500)
    // and the viewport is still stamped: it asked, whatever it learned
    expect(density.gateMeasuredViewportKey).toBe('chr1:0-200')
  })

  it('keeps a force-load approval across an invalidation', () => {
    const approved = nextGateState(EMPTY, {
      kind: 'forceLoad',
      approved: true,
    })
    const loaded = nextGateState(approved, measured({ bytes: 500 }))
    const cleared = nextGateState(loaded, { kind: 'invalidated' })
    expect(cleared.forceLoadTrack).toBe(true)
    expect(cleared.byteEstimate).toBeUndefined()
  })
})

// A seeded LCG, so a failure is reproducible from the seed printed with it.
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const TIERS = [TIER_A, TIER_B]

/**
 * The model, written the way the rules are *stated* rather than the way
 * `nextGateState` implements them: what a reader would answer, asked "after
 * this sequence, what does the gate hold?". Its disagreeing with the reducer is
 * the finding.
 */
interface Model {
  bytes: number | undefined
  key: string | undefined
  approved: boolean
}

function applyToModel(model: Model, event: GateEvent, liveTier: string) {
  if (event.kind === 'forceLoad') {
    model.approved = event.approved
  } else if (event.kind === 'invalidated') {
    model.bytes = undefined
    model.key = undefined
  } else {
    const { issued, bytes } = event
    // a measurement counts only if it was issued against the file we are still
    // asking about
    if (issued.tierKey === undefined || issued.tierKey === liveTier) {
      if (issued.gated && issued.viewport) {
        model.key = issued.viewport.key
      }
      if (bytes !== undefined) {
        model.bytes = bytes
      }
    }
  }
}

describe('a seeded walk over event sequences agrees with the rules as stated', () => {
  test.each([1, 7, 42, 1337, 90_210])('seed %i', seed => {
    const rand = random(seed)
    // a declaration, not `const pick = <T>(…) =>`: babel parses this file with
    // the JSX plugin on, and reads that opening angle bracket as an element
    function pick<T>(xs: T[]): T {
      return xs[Math.floor(rand() * xs.length)]!
    }
    let liveTier = TIER_A
    let state = EMPTY
    const model: Model = { bytes: undefined, key: undefined, approved: false }
    const trail: string[] = []

    for (let step = 0; step < 200; step++) {
      const roll = rand()
      let event: GateEvent
      if (roll < 0.55) {
        event = measured({
          key: `chr1:0-${pick([100, 200, 400])}`,
          spanBp: pick([100, 1000, 10_000]),
          gated: rand() < 0.8,
          tierKey: rand() < 0.85 ? liveTier : pick(TIERS),
          currentTierKey: liveTier,
          bytes: rand() < 0.75 ? Math.floor(rand() * 1_000_000) : undefined,
        })
      } else if (roll < 0.85) {
        event = { kind: 'invalidated' }
      } else {
        event = { kind: 'forceLoad', approved: rand() < 0.5 }
      }

      // A tier swap is the live tier moving AND the clear that fires with it
      // (`ClearByteEstimateOnNavOrTierSwap`), which is what puts a fetch issued
      // against the old one in flight across the boundary.
      const swapping = event.kind === 'invalidated' && rand() < 0.5
      if (swapping) {
        liveTier = liveTier === TIER_A ? TIER_B : TIER_A
      }

      state = nextGateState(state, event)
      applyToModel(model, event, liveTier)
      trail.push(
        `${step}:${event.kind}${swapping ? '+tierSwap' : ''}${
          event.kind === 'measurement'
            ? `(tier=${event.issued.tierKey} gated=${event.issued.gated} bytes=${event.bytes})`
            : ''
        }`,
      )

      const where = `seed ${seed}\n${trail.slice(-6).join('\n')}`
      expect({
        where,
        bytes: state.byteEstimate?.bytes,
        key: state.gateMeasuredViewportKey,
        approved: state.forceLoadTrack,
      }).toEqual({
        where,
        bytes: model.bytes,
        key: model.key,
        approved: model.approved,
      })
    }
  })
})
