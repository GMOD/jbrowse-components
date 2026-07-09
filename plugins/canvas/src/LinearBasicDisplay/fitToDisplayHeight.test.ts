import { createTestEnvironment } from './testEnv.ts'
import { maxBottom } from './yMorph.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type { FeatureLabelData } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Overlapping features so the packer stacks them into rows taller than the
// track height, giving the fit something to shrink.
function stackedRegionData(rows: number, heightPx: number) {
  const features = Array.from({ length: rows }, (_, i) => ({
    featureId: `f${i}`,
    startBp: 100,
    endBp: 500,
    height: heightPx,
  }))
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: f.height,
        featureHeightPx: f.height,
      }),
    ),
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
  })
}

// Same overlapping stack, but every feature carries a name + description label so
// the packer reserves label lines (and label-width overhang) on each row. Feeds
// the fit-escalation ladder something to strip: full > labels-only > bodies-only.
function labeledStackedRegionData(rows: number, heightPx: number) {
  const base = stackedRegionData(rows, heightPx)
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (let i = 0; i < rows; i++) {
    floatingLabelsData[`f${i}`] = {
      featureId: `f${i}`,
      minX: 100,
      maxX: 500,
      topY: 0,
      featureHeight: heightPx,
      nameLabel: { text: `name${i}`, relativeY: 0, color: '#000', textWidth: 40 },
      descriptionLabel: {
        text: `description ${i}`,
        relativeY: 0,
        color: '#000',
        textWidth: 80,
      },
    }
  }
  return makeFeatureData({ ...base, floatingLabelsData })
}

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

// State-machine coverage for fit-to-display-height mode (the "compress features
// to fit" track-height radio). The fit arithmetic itself is covered
// by scaleLaidOutData in layout.test.ts; here we only drive the mode flag,
// scroll reset, the density-is-orthogonal invariant, and the mutually-exclusive
// track-height radio (heightMode/setHeightMode). With no feature data maxY is 0,
// so fitScale stays 1 (a no-op) throughout.
describe('canvas display fit-to-display-height', () => {
  it('fitScale is 1 and fit is off by default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.fitScale).toBe(1)
  })

  it('entering fit mode resets scroll; leaving it re-enables scrolling', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    // Overflow content so there is a real scroll range (scrollTop is clamped to
    // the content, so a bare display with maxY 0 can't hold a nonzero scroll).
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    display.setHeight(97)
    expect(display.scrollableHeight).toBeGreaterThan(120)

    display.setScrollTop(120)
    expect(display.scrollTop).toBe(120)

    // Entering fit fits the content to the track, so the scroll resets.
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
    expect(display.scrollTop).toBe(0)

    // Leaving fit restores the overflow and a fresh scroll is honored — the
    // exit doesn't lock scrolling at the top.
    display.setHeightMode('fixed')
    expect(display.fitHeightToDisplay).toBe(false)
    display.setScrollTop(120)
    expect(display.scrollTop).toBe(120)
  })

  // Feature size (density) is orthogonal to the track-height strategy: fit
  // scales whatever size the density preset produces, so changing density must
  // leave fit active (the two live in separate radio groups now).
  it('changing feature-size density leaves fit mode active', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setDisplayMode('compact')
    expect(display.fitHeightToDisplay).toBe(true)
    display.setCompactness('super-compact')
    expect(display.fitHeightToDisplay).toBe(true)
    display.setDisplayMode('normal')
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('heightMode reflects the active track-height strategy', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.heightMode).toBe('fixed')
    display.setHeightMode('grow')
    expect(display.heightMode).toBe('grow')
    expect(display.autoHeight).toBe(true)
    display.setHeightMode('fit')
    expect(display.heightMode).toBe('fit')
    expect(display.fitHeightToDisplay).toBe(true)
    expect(display.autoHeight).toBe(false) // grow and fit are exclusive
    display.setHeightMode('fixed')
    expect(display.heightMode).toBe('fixed')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('entering fit mode turns off auto-fit height (opposite intents)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
    expect(display.autoHeight).toBe(false)
  })

  it('enabling auto-fit height exits fit mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('fitted content fits the track exactly (no float-epsilon overflow)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    // Height above MIN_FIT_HEIGHT (so the fitHeight floor doesn't confound
    // canExpand) and chosen so base(355)*(97/355) rounds just ABOVE 97 in
    // float — the exact case the clamp guards. Content stacks well past it, so
    // the base layout overflows.
    display.setHeight(97)
    expect(display.baseLaidOutDataMap.size).toBeGreaterThan(0)
    expect(display.fitScale).toBe(1)
    expect(display.hasOverflow).toBe(true)

    display.setHeightMode('fit')
    // Fit scales content to fit; maxY must land exactly on height, so the
    // expand button, overflow flag, and scrollbar all stay off.
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
    expect(display.canExpand).toBe(false)
  })

  it('entering fit mode clears a stale expand/restore marker', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeight(30)
    display.expandToFit()
    expect(display.heightBeforeExpand).toBe(30)

    display.setHeightMode('fit')
    expect(display.heightBeforeExpand).toBeUndefined()
  })
})

// The fit-to-height escalation ladder: rather than uniformly squeezing the
// label-inflated stack, fit mode drops the reservations it isn't drawing before
// scaling — descriptions first, then names entirely (packing bodies alone and
// hiding labels, since nothing is reserved to keep them off the boxes), then a
// uniform body squeeze only if bodies still overflow.
describe('canvas display fit escalation ladder', () => {
  it('climbs the ladder as the track height shrinks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')

    // Everything fits: keep descriptions and labels, no squeeze.
    display.setHeight(fullH + 50)
    expect(display.fitStage.level).toBe('full')
    expect(display.renderedShowDescriptions).toBe(true)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBe(1)

    // Below the full stack but above labels-only: drop descriptions, keep names,
    // no squeeze.
    display.setHeight(Math.round((labelsH + fullH) / 2))
    expect(display.fitStage.level).toBe('labels')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBe(1)

    // Below labels-only but above bodies: pack bodies alone, hide labels (nothing
    // is reserved for them), still no squeeze — the win over the old uniform
    // scale, which would have shrunk the feature boxes here.
    display.setHeight(Math.round((bodiesH + labelsH) / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(false)
    expect(display.fitScale).toBe(1)

    // Below even the label-free stack: only now does the uniform body squeeze
    // kick in, and it lands content exactly on the track height.
    display.setHeight(Math.round(bodiesH / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  // Dropping a reservation shrinks each feature's reserved box in both height
  // and width, which can only shrink (never grow) the packed stack. The ladder's
  // "least reduction that fits" logic rests on this ordering, so pin it across a
  // range of feature counts, not just the representative one.
  it('never grows the stack when a reservation is dropped', () => {
    for (const rows of [1, 2, 5, 15, 40]) {
      const { createDisplay } = createTestEnvironment()
      const { display, view } = createDisplay()
      display.setRpcData(0, labeledStackedRegionData(rows, 10), view.bpPerPx, ctgA)
      const fullH = maxBottom(display.baseLaidOutDataMap)
      const labelsH = maxBottom(display.fitLabelsOnlyLayout)
      const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
      expect(fullH).toBeGreaterThanOrEqual(labelsH)
      expect(labelsH).toBeGreaterThanOrEqual(bodiesH)
      expect(bodiesH).toBeGreaterThan(0)
    }
  })

  // The whole correctness contract, checked at every threshold (and both sides
  // of it) instead of a few hand-picked heights: fit never scrolls, the chosen
  // level is exactly the least reduction that fits, scaling is the last resort
  // and fills the track exactly, and the draw flags never claim more than the
  // active layout reserved.
  it('holds its invariants at every track height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')
    // Config-derived, stable across the sweep: the smallest scale the squeeze may
    // reach before it bottoms out and scrolls instead.
    const minScale = display.fitMinScale

    const heights = [
      5, // clamped to MIN_DISPLAY_HEIGHT (20); both hit the min-box floor
      20,
      Math.round(bodiesH / 2),
      bodiesH - 1,
      bodiesH,
      bodiesH + 1,
      Math.round((bodiesH + labelsH) / 2),
      labelsH - 1,
      labelsH,
      labelsH + 1,
      Math.round((labelsH + fullH) / 2),
      fullH - 1,
      fullH,
      fullH + 1,
      fullH + 200,
    ]
    for (const requested of heights) {
      display.setHeight(requested)
      // setHeight floors at MIN_DISPLAY_HEIGHT, so assert against the height the
      // model actually took, not the requested value.
      const h = display.height
      const level = display.fitStage.level
      const active = maxBottom(display.fitStage.layout)
      // Too dense to fit even at the min-box floor: the bodies squeeze bottoms
      // out at minScale and the surplus scrolls.
      const floored = level === 'bodies' && bodiesH * minScale > h

      // 1. The squeeze respects both bounds — never grows, never shrinks boxes
      // past the min-box floor.
      expect(display.fitScale).toBeLessThanOrEqual(1)
      expect(display.fitScale).toBeGreaterThanOrEqual(minScale)

      // 2. The level is the LEAST reduction that fits — pinned to h both ways.
      // (Independent of the squeeze floor, which only affects scale.)
      if (level === 'full') {
        expect(fullH).toBeLessThanOrEqual(h)
      } else if (level === 'labels') {
        expect(fullH).toBeGreaterThan(h)
        expect(labelsH).toBeLessThanOrEqual(h)
      } else {
        expect(labelsH).toBeGreaterThan(h)
      }

      // 3. Content fills the track exactly and never scrolls — unless the min-box
      // floor stopped the squeeze short, where it bottoms out and scrolls.
      if (floored) {
        expect(display.fitScale).toBe(minScale)
        expect(display.maxY).toBeGreaterThan(h)
        expect(display.scrollableHeight).toBeGreaterThan(0)
      } else {
        expect(display.maxY).toBeLessThanOrEqual(h)
        expect(display.hasOverflow).toBe(false)
        if (level === 'bodies' && display.fitScale < 1) {
          expect(display.maxY).toBe(h)
        }
        if (level !== 'bodies') {
          expect(active).toBeLessThanOrEqual(h)
          expect(display.fitScale).toBe(1)
        }
      }

      // 4. Draw flags never claim more than the active layout reserved: names
      // only where reserved (full/labels), descriptions only at full.
      expect(display.renderedShowDescriptions).toBe(
        display.effectiveShowDescriptions && level === 'full',
      )
      expect(display.renderedShowLabels).toBe(
        display.showLabels && level !== 'bodies',
      )
    }
  })

  // A stack so dense that fitting it would shrink feature boxes below
  // MIN_FIT_BOX_PX: the squeeze bottoms out at the floor and the surplus scrolls,
  // rather than packing the boxes down to invisibility.
  it('stops the squeeze at the min-box floor and scrolls the surplus', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(40, 10), view.bpPerPx, ctgA)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    const minScale = display.fitMinScale
    display.setHeightMode('fit')
    // Half the already-floored stack height — comfortably below what the floor
    // can fit, so the squeeze can't reach it.
    display.setHeight(Math.max(20, Math.round((bodiesH * minScale) / 2)))

    expect(display.fitStage.level).toBe('bodies')
    // Boxes stop shrinking at the floor instead of going sub-pixel...
    expect(display.fitScale).toBe(minScale)
    // ...and the overflow scrolls rather than clipping unreachably.
    expect(display.hasOverflow).toBe(true)
    expect(display.scrollableHeight).toBeGreaterThan(0)
  })

  // Descriptions off (or density-hidden) collapses the full and labels stages
  // onto one name-only reservation, so the ladder has no distinct descriptions
  // step and drops straight from names to bodies. Exercises the labels-only
  // shortcut that reuses the base layout.
  it('with descriptions off, the full and labels stages coincide', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setShowDescriptions(false)
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    expect(display.effectiveShowDescriptions).toBe(false)

    const labelsH = maxBottom(display.baseLaidOutDataMap)
    expect(maxBottom(display.fitLabelsOnlyLayout)).toBe(labelsH)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(labelsH).toBeGreaterThan(bodiesH)

    display.setHeightMode('fit')
    display.setHeight(Math.round((bodiesH + labelsH) / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(false)
  })

  // Labels and descriptions both off: nothing is reserved anywhere, so all three
  // candidate stacks are identical and only a uniform squeeze remains — the
  // legacy behavior, now the ladder's degenerate floor. Exercises the
  // bodies-only shortcut that reuses the labels-only layout.
  it('with labels and descriptions off, only a uniform squeeze remains', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setShowLabels('off')
    display.setShowDescriptions(false)
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    expect(display.showLabels).toBe(false)

    const h = maxBottom(display.baseLaidOutDataMap)
    expect(maxBottom(display.fitLabelsOnlyLayout)).toBe(h)
    expect(maxBottom(display.fitBodiesOnlyLayout)).toBe(h)

    display.setHeightMode('fit')
    display.setHeight(Math.round(h / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
  })

  it('with no data, fit stays at full and never squeezes', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setHeight(40)
    expect(display.baseLaidOutDataMap.size).toBe(0)
    expect(display.fitStage.level).toBe('full')
    expect(display.fitScale).toBe(1)
    expect(display.hasOverflow).toBe(false)
    expect(display.renderedShowDescriptions).toBe(true)
    expect(display.renderedShowLabels).toBe(true)
  })
})
