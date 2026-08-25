// deliberately across the eager/lazy split documented in
// components/overlayGeometry.ts: computeOverlayX lives on the overlay side now,
// and pairing it here with this file's computeOverlayY and makeOffscreenLayout
// is what fails if the two duplicated OFFSCREEN_Y_SENTINELs ever drift apart
import { computeOverlayX } from './components/overlayGeometry.ts'
import {
  OFFSCREEN_Y_SENTINEL,
  computeOverlayY,
  findFeatureViewLevel,
  isOffscreenLayout,
  layoutUnknown,
  makeOffscreenLayout,
} from './util.ts'

import type { LayoutRecord } from './types.ts'
import type { OverlayDisplay, OverlayTrack } from './util.ts'

function trackWith(display: OverlayDisplay) {
  return { displays: [display] } as OverlayTrack
}

// Compile-time half of the contract. This used to typecheck, and a missing
// layoutReady reads as falsy — precisely the "no layout" verdict — so every
// overlay curve silently vanished.
test('declaring searchFeatureByID without layoutReady is a type error', () => {
  // @ts-expect-error searchFeatureByID requires layoutReady alongside it
  const bad: OverlayDisplay = {
    height: 100,
    searchFeatureByID: () => undefined,
  }
  expect(bad).toBeDefined()
})

describe('layoutUnknown', () => {
  test('a display with a populated layout knows off-display from missing', () => {
    expect(
      layoutUnknown(
        trackWith({
          height: 100,
          searchFeatureByID: () => undefined,
          layoutReady: true,
        }),
      ),
    ).toBe(false)
  })

  test('a display whose data is cleared cannot place anything', () => {
    expect(
      layoutUnknown(
        trackWith({
          height: 100,
          searchFeatureByID: () => undefined,
          layoutReady: false,
        }),
      ),
    ).toBe(true)
  })

  test('a display that keeps no layout at all keeps the bottom-edge behavior', () => {
    expect(layoutUnknown(trackWith({ height: 100 }))).toBe(false)
  })
})

describe('makeOffscreenLayout / isOffscreenLayout', () => {
  test('round-trips through the predicate', () => {
    const c = makeOffscreenLayout(100, 200)
    expect(isOffscreenLayout(c)).toBe(true)
    expect(c[0]).toBe(100)
    expect(c[2]).toBe(200)
    expect(c[1]).toBe(OFFSCREEN_Y_SENTINEL)
    expect(c[3]).toBe(OFFSCREEN_Y_SENTINEL)
  })

  test('a real layout with finite y is not offscreen', () => {
    expect(isOffscreenLayout([100, 0, 200, 8])).toBe(false)
    expect(isOffscreenLayout([100, 1199, 200, 1200])).toBe(false)
  })
})

describe('computeOverlayY', () => {
  const base = { yOffset: 1000, height: 200, coverageOffset: 40, scrollTop: 0 }

  test('off-display features snap to the track bottom edge', () => {
    expect(
      computeOverlayY({ ...base, layout: makeOffscreenLayout(100, 200) }),
    ).toBe(base.yOffset + base.height)
  })

  test('uses the layout rectangle vertical midpoint plus coverage offset', () => {
    // midpoint of [50,90] is 70, +40 coverage offset = 110
    expect(computeOverlayY({ ...base, layout: [0, 50, 0, 90] })).toBe(
      1000 + 110,
    )
  })

  test('vertical scroll shifts the endpoint up', () => {
    expect(
      computeOverlayY({ ...base, scrollTop: 30, layout: [0, 50, 0, 90] }),
    ).toBe(1000 + 80)
  })

  test('clamps up to the coverage offset when the midpoint is above it', () => {
    // scrolled so far that mid < coverageOffset -> pinned to coverageOffset
    expect(
      computeOverlayY({ ...base, scrollTop: 1000, layout: [0, 50, 0, 90] }),
    ).toBe(1000 + base.coverageOffset)
  })

  test('clamps down to the track height when the midpoint is below it', () => {
    expect(computeOverlayY({ ...base, layout: [0, 5000, 0, 5000] })).toBe(
      1000 + base.height,
    )
  })

  test('result always lands within [yOffset+coverageOffset, yOffset+height]', () => {
    for (const scrollTop of [-500, 0, 75, 5000]) {
      for (const top of [0, 60, 1000]) {
        const y = computeOverlayY({
          ...base,
          scrollTop,
          layout: [0, top, 0, top + 20],
        })
        expect(y).toBeGreaterThanOrEqual(base.yOffset + base.coverageOffset)
        expect(y).toBeLessThanOrEqual(base.yOffset + base.height)
      }
    }
  })
})

describe('findFeatureViewLevel', () => {
  // Stub views: bpToPx returns truthy only for refNames it owns.
  const make = (refs: string[]) => ({
    bpToPx: ({ refName }: { refName: string; coord: number }) =>
      refs.includes(refName) ? { offsetPx: 0 } : undefined,
  })
  // rows that spell contigs the way the file does
  const noAliases = [undefined, undefined]

  test('returns the first level whose view contains the feature refName', () => {
    const views = [make(['chr1']), make(['chr2'])]
    expect(findFeatureViewLevel(views, noAliases, 'chr2', 500)).toBe(1)
  })

  test('returns the lower index when both views contain the refName', () => {
    const views = [make(['chr1', 'chr2']), make(['chr2'])]
    expect(findFeatureViewLevel(views, noAliases, 'chr2', 500)).toBe(0)
  })

  test('returns undefined when no view contains the refName', () => {
    const views = [make(['chr1']), make(['chr2'])]
    expect(findFeatureViewLevel(views, noAliases, 'chrUn', 0)).toBeUndefined()
  })

  // The rows are independently assembly-picked, so the file's spelling resolves
  // differently on each. One shared resolver — row 0's, which is what this used
  // to be handed — renames the name into row 0's namespace and then asks every
  // other row about a contig it has never heard of.
  test('each level resolves the refName against its own assembly', () => {
    const views = [make(['chr1']), make(['sampleCtg'])]
    const assemblies = [
      { getCanonicalRefName2: (r: string) => (r === '1' ? 'chr1' : r) },
      { getCanonicalRefName2: (r: string) => (r === '1' ? 'sampleCtg' : r) },
    ]
    expect(findFeatureViewLevel([views[1]!], [assemblies[1]!], '1', 0)).toBe(0)
    expect(findFeatureViewLevel(views, assemblies, '1', 0)).toBe(0)
  })
})

// computeOverlayY snaps an off-display segment to the track's bottom edge to be
// the one sign it exists; that is only visible if x is in the panel too, which
// is the whole job of computeOverlayX. Pinned because the two have to move
// together — an x clamp without the y snap, or vice versa, draws a line to
// nowhere.
describe('computeOverlayX', () => {
  const WIDTH = 800

  test('leaves an on-display endpoint alone, even off-panel', () => {
    // a long read whose alignment runs past the window has a real row and a
    // real x, and the connector genuinely points off to the side
    const onDisplay: LayoutRecord = [100, 10, 200, 20]
    expect(computeOverlayX(-20000, WIDTH, onDisplay)).toBe(-20000)
    expect(computeOverlayX(9000, WIDTH, onDisplay)).toBe(9000)
    expect(computeOverlayX(400, WIDTH, onDisplay)).toBe(400)
  })

  test('clamps an off-display endpoint into its panel', () => {
    const off = makeOffscreenLayout(100, 200)
    expect(computeOverlayX(-20000, WIDTH, off)).toBe(0)
    expect(computeOverlayX(9000, WIDTH, off)).toBe(WIDTH)
    // one already in the panel is untouched, so the terminus keeps the side it
    // was on rather than snapping to an edge
    expect(computeOverlayX(400, WIDTH, off)).toBe(400)
  })
})
