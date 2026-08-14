import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData as emptyPileupData,
  oneReadWithMate,
} from '../testUtils.ts'

// An arc whose two feet are in DIFFERENT displayed regions, through the model's
// own chain rather than through a hand-built argument.
//
// The whole point of routing it this way is the band: `computeStackedSections`
// reserves the arc strip from `hasArcs`, which used to be `anyArcsDrawn` over
// `arcsByGroup` alone. Holding cross-region arcs out of that feed — which is the
// fix, since no per-region pass can draw them — silently made a lane whose every
// arc crosses a seam reserve NO band, and the overlay then had nowhere to draw.
// That is the display's own `hasArcBandInk`-not-`numArcs` rule met from the
// other side, and nothing about it is visible in a unit test of either half.
//
// Two regions either side of a breakpoint is not a corner case; it is the view
// read connections exist for.
function twoRegionDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  // The one 10kb region, cut into two that each hold one foot of the pair
  // below. `oneReadWithMate(2000)` reads 1000..1100 with its mate at 2000, so
  // the arc runs 1000 -> 2000 across the seam at 1500.
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 1500, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 1500, end: 10_000, refName: 'ctgA' },
  ])
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(0, {
    groups: [{ key: '', label: '', data: oneReadWithMate(2000) }],
  })
  // The second region's fetch, empty of reads. A region only counts as LOADED
  // once its data arrives (`loadedRegionInfos` filters on `rpcDataMap`), and
  // without it the far foot resolves to no region at all — which is the
  // off-screen-partner case, not this one.
  display.setRpcData(1, {
    groups: [{ key: '', label: '', data: emptyPileupData() }],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 1500,
    assemblyName: 'volvox',
  })
  display.setLoadedRegion(1, {
    refName: 'ctgA',
    start: 1500,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return display
}

test('a cross-region arc leaves the per-region buffers', () => {
  // Not "is dropped": both blocks used to receive it and each drew the foot it
  // held plus a leg extrapolated at its own scale toward a place the other
  // block is not.
  const display = twoRegionDisplay()
  for (const regionMap of display.arcsByGroup.values()) {
    for (const data of regionMap.values()) {
      expect(data.numArcs).toBe(0)
    }
  }
  expect(display.crossRegionArcsByGroup.get('')).toHaveLength(1)
})

test('and the band is still reserved for it', () => {
  // The regression this file exists for: the strip is reserved from the ink a
  // lane has, and after the split that lane's ink is entirely in the overlay.
  const display = twoRegionDisplay()
  expect(display.renderSections[0]!.arcBandHeight).toBeGreaterThan(0)
})

test('and it draws, with both feet on their own region', () => {
  const display = twoRegionDisplay()
  const sections = display.crossRegionArcSections
  expect(sections).toHaveLength(1)
  const arcs = sections[0]!.arcs
  expect(arcs).toHaveLength(1)
  expect(arcs[0]!.d).toMatch(/^M /)
  // The two feet straddle the seam, which is the claim the picture makes and
  // the one a per-region pass could not: at bpPerPx 10 with the first region
  // 0..1500, the seam sits at 150px, and the arc has to reach past it.
  const [, footX] = /^M (-?[\d.]+) /.exec(arcs[0]!.d)!
  expect(Number(footX)).toBeLessThan(150)
  expect(arcs[0]!.support).toBe(1)
})
