import { DEFAULTS } from './displayDefaults.ts'
import { createMafTestEnvironment } from './testEnv.ts'

function setup(nSamples: number, rowHeight: number) {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: Array.from({ length: nSamples }, (_, i) => ({
      id: `s${i}`,
      label: `s${i}`,
    })),
    treeNewick: undefined,
    samplesCanonical: true,
  })
  display.setRowHeight(rowHeight)
  return display
}

test('drag tracks the cursor in both directions', () => {
  const display = setup(10, 15)
  expect(display.effectiveRowHeight).toBe(15)

  const before = display.height
  display.resizeHeight(+100)
  expect(display.height - before).toBeCloseTo(100)

  const mid = display.height
  display.resizeHeight(-60)
  expect(display.height - mid).toBeCloseTo(-60)
})

// A pinned row height is the size the user asked to read at, so it survives
// however many species there are: the rows canvas is the viewport, and the rows
// that don't fit are scrolled to rather than shrunk or grown into.
describe('a pinned row height scrolls rather than resizing the canvas', () => {
  // 1000 species at 15px = 15000px of rows behind a 600px default track.
  const deep = () => setup(1000, 15)

  it('honors the pinned height and scrolls the overflow', () => {
    const display = deep()
    expect(display.effectiveRowHeight).toBe(15)
    expect(display.height).toBe(DEFAULTS.maxAutoFitHeight)
    expect(display.rowsContentHeight).toBe(15000)
    expect(display.scrollableHeight).toBe(15000 - display.rowsHeight)
  })

  it('a taller track reveals more rows instead of enlarging them', () => {
    const display = deep()
    const scrollable = display.scrollableHeight
    display.resizeHeight(+100)
    expect(display.height).toBe(DEFAULTS.maxAutoFitHeight + 100)
    expect(display.effectiveRowHeight).toBe(15)
    expect(display.scrollableHeight).toBeCloseTo(scrollable - 100)
  })

  it('clamps a scroll past the last row', () => {
    const display = deep()
    display.setScrollTop(1e6)
    expect(display.scrollTop).toBe(display.scrollableHeight)
    display.setScrollTop(-10)
    expect(display.scrollTop).toBe(0)
  })

  it('re-clamps a stranded scroll when the content shrinks', () => {
    const display = deep()
    display.setScrollTop(display.scrollableHeight)
    expect(display.scrollTop).toBe(14445)
    // shorter rows leave far less to scroll through, and the offset was sitting
    // at the old bottom — nothing but the clamp autorun brings it back
    display.setRowHeight(2)
    expect(display.scrollTop).toBe(display.scrollableHeight)
    expect(display.scrollTop).toBeLessThan(14445)
  })

  // The canvas-size guard that used to shrink every row now sits on the rows
  // viewport, which is the thing with a backing store.
  it('keeps the rows canvas under the backing-store ceiling on a huge drag', () => {
    const display = deep()
    display.resizeHeight(+100_000)
    expect(display.rowsHeight).toBe(display.maxRowsHeight)
  })
})

test('fit-to-display-height never scrolls', () => {
  const display = setup(447, 0)
  expect(display.rowsContentHeight).toBeCloseTo(display.rowsHeight)
  expect(display.scrollableHeight).toBe(0)
})

// A freshly loaded track sizes itself from the species count, which without a
// bound scaled the default height (and every full-height overlay canvas over
// the rows) linearly with it. `maxAutoFitHeight` is the policy bound; the
// `maxRowsHeight` cap exercised above stays as the backing-store crash guard.
describe('default fit-to-display-height ceiling', () => {
  // rowHeight 0 is the shipped default: fit rows to the track height.
  const fit = (n: number) => setup(n, 0)

  it('leaves a typical multiz exactly where it was', () => {
    // 30 * 15 + 45px coverage band = 495, under the ceiling, so nothing binds
    const display = fit(30)
    expect(display.effectiveRowHeight).toBe(DEFAULTS.rowHeight)
    expect(display.height).toBe(30 * DEFAULTS.rowHeight + 45)
  })

  // `height` is `nrow * ((ceiling - bands) / nrow)`, so it lands within a float
  // epsilon of the ceiling rather than exactly on it — hence toBeCloseTo here
  // and the epsilon in the loop below.
  it('shrinks the rows of a deep alignment instead of growing the track', () => {
    const display = fit(447)
    expect(display.height).toBeCloseTo(DEFAULTS.maxAutoFitHeight)
    // every row still drawn, just dense
    expect(display.effectiveRowHeight).toBeCloseTo(
      (DEFAULTS.maxAutoFitHeight - 45) / 447,
    )
    expect(display.effectiveRowHeight).toBeLessThan(DEFAULTS.rowHeight)
  })

  it('never grows past the ceiling however many species arrive', () => {
    for (const n of [40, 100, 447, 2000]) {
      expect(fit(n).height).toBeLessThan(DEFAULTS.maxAutoFitHeight + 0.001)
    }
  })

  it('bounds the default, not the user: an explicit height still wins', () => {
    const display = fit(447)
    display.configuration.setSlot('height', 2000)
    expect(display.height).toBeCloseTo(2000)
  })

  it('a drag past the ceiling is honored', () => {
    const display = fit(447)
    display.resizeHeight(+400)
    expect(display.height).toBeCloseTo(DEFAULTS.maxAutoFitHeight + 400)
  })
})

// The bands drag by delta, so the floor has to be expressed in terms of the
// current height rather than the bare 20px constant — same rule (and same
// regression) as the alignments coverage/arc/sashimi bands, now shared via
// clampBandHeight. See LinearAlignmentsDisplay/bandHeight.test.ts.
describe('resizable band height floor', () => {
  it('stops a drag from shrinking a default band below 20', () => {
    const display = setup(10, 15)
    expect(display.coverageHeight).toBe(45)
    display.resizeCoverageHeight(-100)
    expect(display.coverageHeight).toBe(20)
  })

  it('leaves a band config declared below the floor where it is', () => {
    const display = setup(10, 15)
    display.configuration.setSlot('coverageHeight', 5)
    // the regression: flooring at a bare 20 made this first +1 drag jump the
    // band up to 20 before it honored the delta
    display.resizeCoverageHeight(+1)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = setup(10, 15)
    display.configuration.setSlot('coverageHeight', 5)
    display.resizeCoverageHeight(-1)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = setup(10, 15)
    display.configuration.setSlot('coverageHeight', 5)
    display.resizeCoverageHeight(+20)
    expect(display.coverageHeight).toBe(25)
    display.resizeCoverageHeight(-100)
    expect(display.coverageHeight).toBe(20)
  })

  it('applies the same rule to the conservation band', () => {
    const display = setup(10, 15)
    expect(display.conservationHeight).toBe(40)
    display.resizeConservationHeight(-100)
    expect(display.conservationHeight).toBe(20)

    display.configuration.setSlot('conservationHeight', 8)
    display.resizeConservationHeight(+1)
    expect(display.conservationHeight).toBe(9)
  })
})
