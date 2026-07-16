import { readConfObject } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'
import { maxBottom } from './yMorph.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// Overlapping features so the packer stacks them into rows taller than the
// track height, giving the fit something to shrink. Each spans 800bp (64px at the
// test view's 12.5 bp/px) — wider than its 46px label, so `fitWidth` decimation
// keeps every name here (decimated ≡ labels); a dedicated mixed-width test
// exercises the case where narrow features shed their names.
function stackedRegionData(rows: number, heightPx: number) {
  const features = Array.from({ length: rows }, (_, i) => ({
    featureId: `f${i}`,
    startBp: 100,
    endBp: 900,
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
      nameLabel: {
        text: `name${i}`,
        relativeY: 0,
        color: '#000',
        textWidth: 40,
      },
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

// Narrow boxes (5px, at the test model's 1 bp/px) whose 40px names far outrun
// them, spaced with a start-to-start step that RAMPS from 6bp to 6+2·count so
// each feature has a distinct amount of overhang room. `fitWidth` keeps a name
// where its box + neighbor gap >= labelWidth·factor (see keepFeatureLabel), so
// distinct rooms make decimation gradual — the crowded (small-room) names shed
// first, the roomier ones last — and the solve can fill the height a name at a
// time. The uniform-wide `labeledStackedRegionData` can't show this: every name
// there has infinite room, so decimated always equals labels.
function mixedWidthRegionData(count: number) {
  const features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
  }[] = []
  let pos = 100
  for (let i = 0; i < count; i++) {
    features.push({
      featureId: `m${i}`,
      startBp: pos,
      endBp: pos + 5,
      height: 10,
    })
    pos += 6 + 2 * i
  }
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const f of features) {
    floatingLabelsData[f.featureId] = {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: f.height,
      nameLabel: {
        text: f.featureId,
        relativeY: 0,
        color: '#000',
        textWidth: 40,
      },
    }
  }
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
    floatingLabelsData,
  })
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
    display.setDisplayMode('superCompact')
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
    // Height above MIN_FIT_HEIGHT and chosen so base(355)*(97/355) rounds just
    // ABOVE 97 in float — the exact case the clamp guards. Content stacks well
    // past it, so the base layout overflows.
    display.setHeight(97)
    expect(display.baseLaidOutDataMap.size).toBeGreaterThan(0)
    expect(display.fitScale).toBe(1)
    expect(display.hasOverflow).toBe(true)

    display.setHeightMode('fit')
    // Fit scales content to fit; maxY must land exactly on height, so the
    // overflow flag and scrollbar stay off.
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
  })

  // naturalContentHeight (the grow-mode target / sparse-track floor) resolves to
  // MIN_FIT_HEIGHT when there's no content, rather than collapsing to a sliver.
  it('naturalContentHeight floors at MIN_FIT_HEIGHT with no content', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.maxY).toBe(0)
    expect(display.naturalContentHeight).toBe(50)
  })

  // Grow drives `height` from the laid-out content reactively — via the `height`
  // getter, NOT by writing the height config slot. So a settled zoom in grow mode
  // never mutates the persisted session (no autosave churn) nor bakes a momentary
  // height into a saved snapshot.
  it('grow mode drives height from content without writing the height slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    const slotBefore = readConfObject(display.configuration, 'height')
    expect(slotBefore).toBe(100)

    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, ctgA)

    // height tracks the grown content (taller than the 100px slot default)...
    expect(display.height).toBe(display.grownHeight)
    expect(display.height).toBeGreaterThan(slotBefore)
    // ...but the persisted config slot is untouched.
    expect(readConfObject(display.configuration, 'height')).toBe(slotBefore)
  })

  // The reactive path recomputes as content changes — no autorun needed.
  it('grow height grows as more content stacks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(3, 20), view.bpPerPx, ctgA)
    const small = display.height
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, ctgA)
    expect(display.height).toBeGreaterThan(small)
  })

  // Leaving grow bakes the height the user was seeing into the slot — one
  // deliberate write at the mode switch, so fixed/fit don't snap to the stale
  // slot default. After the switch the height stops tracking content.
  it('leaving grow mode bakes the grown height into the slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, ctgA)
    const grown = display.grownHeight
    expect(display.height).toBe(grown)

    display.setHeightMode('fixed')
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)

    // Fixed no longer tracks content: more rows don't change the height.
    display.setRpcData(0, stackedRegionData(30, 20), view.bpPerPx, ctgA)
    expect(display.height).toBe(grown)
  })

  // The promotable cascade can flip a grow track out of grow mode WITHOUT
  // setHeightMode — resetting it to the inherit sentinel or a session-default
  // change. The bake is a reaction on the resolved mode, so that exit bakes too.
  it('bakes on a cascade-driven grow exit, not just the menu action', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, ctgA)
    const grown = display.grownHeight
    expect(display.height).toBe(grown)

    // Reset the slot to its 'inherit' sentinel, exactly as clearing a customized
    // value does. Resolved heightMode falls to 'fixed' with no setHeightMode call.
    display.configuration.setSlot('heightMode', 'inherit')
    expect(display.autoHeight).toBe(false)
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // A manual drag-resize leaves grow mode; the bake-on-exit keeps the height the
  // user was seeing, then the drag delta applies on top of it.
  it('a manual drag-resize leaves grow mode so the height sticks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
    expect(display.heightMode).toBe('fixed')
  })

  // Grow, like fit, resets scroll on entry so the sticky GPU canvas can't be
  // stranded at an offset the reconfigured height no longer supports.
  it('entering grow mode resets scroll to the top', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, ctgA)
    display.setHeight(97)
    display.setScrollTop(120)
    expect(display.scrollTop).toBe(120)

    display.setHeightMode('grow')
    expect(display.scrollTop).toBe(0)
  })

  // A Y morph holds `maxY` at the taller of the old/new layout so rows animating
  // up from a deeper row aren't clipped — that inflation belongs to the scroll
  // extent, NOT to the grow-mode target height. `naturalContentHeight`/`grownHeight`
  // read the settled height so the track doesn't bounce to the old (taller) height
  // for the morph's duration and then collapse.
  it('grow height ignores the morph hold that maxY applies', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, stackedRegionData(6, 20), view.bpPerPx, ctgA)
    display.setHeight(400)

    const settled = display.settledMaxY
    const fitHeightBefore = display.naturalContentHeight
    expect(settled).toBeGreaterThan(0)

    // Simulate a morph animating up from a much deeper prior layout.
    display.beginYMorph(new Map(), settled + 500)

    // Scroll extent honors the taller in-flight layout...
    expect(display.maxY).toBe(settled + 500)
    expect(display.scrollableHeight).toBeGreaterThan(0)
    // ...but the settled height and the grow target are unmoved.
    expect(display.settledMaxY).toBe(settled)
    expect(display.naturalContentHeight).toBe(fitHeightBefore)
  })
})

// The fit-to-height escalation ladder: rather than uniformly squeezing the
// label-inflated stack, fit mode drops the reservations it isn't drawing before
// scaling — descriptions first, then names on all but the wide/pinned features
// (the `decimated` rung), then names entirely (packing bodies alone), and the
// kept rung is scaled to fill the track: grown when it fits with room to spare,
// squeezed only at the last `bodies` rung when even it overflows.
describe('canvas display fit escalation ladder', () => {
  it('climbs the ladder as the track height shrinks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')

    // Everything fits exactly: keep descriptions and labels, no scaling.
    display.setHeight(fullH)
    expect(display.fitStage.level).toBe('full')
    expect(display.renderedShowDescriptions).toBe(true)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBe(1)

    // Between labels-only and full: drop descriptions, keep names. The labels
    // stack fits with room to spare, so (labels fits before the ladder even
    // reaches the decimated rung) it grows to fill instead of leaving whitespace.
    display.setHeight(Math.round((labelsH + fullH) / 2))
    expect(display.fitStage.level).toBe('labels')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBeGreaterThanOrEqual(1)
    expect(display.hasOverflow).toBe(false)

    // Below even the label-free stack: only now does the uniform body squeeze
    // kick in, and it lands content exactly on the track height.
    display.setHeight(Math.round(bodiesH / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(false)
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  // Fit never scales a feature body past its normal height: in the default
  // (normal) display mode fitBodyPx already is the normal height, so the grow
  // scale pins at 1 and a track taller than the content strands whitespace rather
  // than ballooning the bodies (the resize-taller regression).
  it('does not grow features past the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(3, 10), view.bpPerPx, ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    expect(display.fitMaxScale).toBe(1)
    display.setHeightMode('fit')

    // Track far taller than the content: bodies keep their natural height and the
    // surplus stays whitespace instead of scaling up.
    display.setHeight(Math.round(fullH * 3))
    expect(display.fitStage.level).toBe('full')
    expect(display.fitScale).toBe(1)
    expect(display.maxY).toBe(fullH)
    expect(display.maxY).toBeLessThan(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  // In a compact mode the laid-out bodies start below the normal height, so a
  // tall track may grow them to fill it — but the grow ceiling is the normal
  // height (fitMaxScale = 1 / multiplier), never taller.
  it('grows compact bodies only up to the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setDisplayMode('compact')
    display.setRpcData(0, labeledStackedRegionData(3, 10), view.bpPerPx, ctgA)
    // compact multiplier 0.6 → bodies start at 0.6× normal, so grow tops out at
    // 1 / 0.6 to reach (not exceed) the normal height.
    expect(display.fitMaxScale).toBeCloseTo(1 / 0.6)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    display.setHeightMode('fit')

    // Track far taller than the content: grow is capped at the normal height, so
    // the surplus past that stays whitespace.
    display.setHeight(Math.round(fullH * display.fitMaxScale * 3))
    expect(display.fitScale).toBe(display.fitMaxScale)
    expect(display.maxY).toBeLessThan(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  // Dropping a reservation shrinks each feature's reserved box in both height
  // and width, which can only shrink (never grow) the packed stack. The ladder's
  // "least reduction that fits" logic rests on this monotonic ordering
  // (full >= labels >= bodies, with the height-solved `decimated` rung landing
  // between labels and bodies — see the mixed-width test), so pin it across a
  // range of feature counts, not just the representative one.
  it('never grows the unscaled stack when a reservation is dropped', () => {
    for (const rows of [1, 2, 5, 15, 40]) {
      const { createDisplay } = createTestEnvironment()
      const { display, view } = createDisplay()
      display.setRpcData(
        0,
        labeledStackedRegionData(rows, 10),
        view.bpPerPx,
        ctgA,
      )
      const fullH = maxBottom(display.baseLaidOutDataMap)
      const labelsH = maxBottom(display.fitLabelsOnlyLayout)
      const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
      expect(fullH).toBeGreaterThanOrEqual(labelsH)
      expect(labelsH).toBeGreaterThanOrEqual(bodiesH)
      expect(bodiesH).toBeGreaterThan(0)
    }
  })

  // The whole correctness contract, checked at every threshold (and both sides
  // of it) instead of a few hand-picked heights: the chosen level is exactly the
  // least reduction that fits; the kept rung is scaled to fill the track — grown
  // up to the max-box ceiling, squeezed only at bodies down to the min-box floor
  // (scrolling only when even that overflows); and the draw flags never claim
  // more than the active layout reserved.
  it('holds its invariants at every track height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), view.bpPerPx, ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')
    // Config-derived, stable across the sweep: the scale bounds the fill may reach
    // before it bottoms out and scrolls (min) or stops growing (max).
    const minScale = display.fitMinScale
    const maxScale = display.fitMaxScale

    // Least-reduced rung whose unscaled stack fits h; bodies is the fallback.
    // This data is uniform-wide (all names have infinite overhang room), so the
    // height-solved `decimated` rung always keeps every name and equals `labels`
    // — it is never selected distinctly here (the mixed-width test covers that);
    // when labels overflows so does decimated, dropping straight to bodies.
    const rungs = [
      ['full', fullH],
      ['labels', labelsH],
      ['bodies', bodiesH],
    ] as const
    const expectedLevel = (h: number) =>
      rungs.find(([, ch]) => ch <= h)?.[0] ?? 'bodies'

    const heights = [
      5, // clamped to MIN_DISPLAY_HEIGHT (20); hits the min-box floor
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
      Math.round(fullH * maxScale) - 1, // grows, just under the cap
      fullH * maxScale + 200, // grows to the cap, surplus is whitespace
    ]
    for (const requested of heights) {
      display.setHeight(requested)
      // setHeight floors at MIN_DISPLAY_HEIGHT, so assert against the height the
      // model actually took, not the requested value.
      const h = display.height
      const level = display.fitStage.level
      const active = maxBottom(display.fitStage.layout)
      const scale = display.fitScale

      // 1. The level is the least reduction that fits (bodies otherwise).
      expect(level).toBe(expectedLevel(h))

      // 2. The scale is the fill ratio clamped into [minScale, maxScale].
      expect(scale).toBeGreaterThanOrEqual(minScale)
      expect(scale).toBeLessThanOrEqual(maxScale)
      expect(scale).toBeCloseTo(
        Math.max(minScale, Math.min(maxScale, h / active)),
      )

      // 3. Fill behavior. A squeeze floored at the min box (only possible at
      // bodies) can't fit and scrolls; otherwise content lands on the track
      // (grown/squeezed to h) or below it (grow capped at the max box), never
      // scrolling.
      const floored = active * scale > h + 0.5
      if (floored) {
        expect(level).toBe('bodies')
        expect(scale).toBe(minScale)
        expect(display.hasOverflow).toBe(true)
        expect(display.scrollableHeight).toBeGreaterThan(0)
      } else {
        expect(display.maxY).toBeLessThanOrEqual(h + 0.001)
        expect(display.hasOverflow).toBe(false)
        expect(display.scrollableHeight).toBe(0)
      }

      // 4. Draw flags never claim more than the active layout reserved: names
      // wherever a rung short of bodies is active (decimation prunes per-feature
      // inside the layout, not via this flag), descriptions only at full.
      expect(display.renderedShowDescriptions).toBe(
        display.effectiveShowDescriptions && level === 'full',
      )
      expect(display.renderedShowLabels).toBe(
        display.showLabels && level !== 'bodies',
      )
    }
  })

  // The height-solved `decimated` rung (fitDecimatedSolved) on crowded
  // mixed-room features: it keeps as many non-overlapping names as fit the track,
  // fills the height without overflowing, and — critically — keeps MORE names as
  // the track grows taller. This is the fix for the old ladder, which dropped
  // straight to a sparse fixed rung and left the surplus height as whitespace
  // (plateau). Uniform-wide data can't show this (every name fits).
  //
  // It also guards the probe/commit invariant: the solve measures a stack's
  // height (a probe) then commits a stack, and those two must be the identical
  // packing — else the committed stack overflows the height the probe fit and the
  // ladder falls through to `bodies`, hiding every name exactly on the taller
  // tracks that should show the most. So every swept height must stay on
  // `decimated`, never regressing to `bodies`.
  it('fills the decimated rung with more names as the track grows', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    const total = 40
    // Force labels on: the auto density gate (orthogonal to the fit ladder) would
    // otherwise hide all labels at this feature count.
    display.setShowLabels('on')
    display.setRpcData(0, mixedWidthRegionData(total), view.bpPerPx, ctgA)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    // Decimation must actually bite: the all-names stack towers over bodies.
    expect(labelsH).toBeGreaterThan(bodiesH * 1.5)
    display.setHeightMode('fit')

    const keptAt = (frac: number) => {
      const h = Math.round(bodiesH + (labelsH - bodiesH) * frac)
      display.setHeight(h)
      const layout: Map<number, FeatureDataResult> = display.fitStage.layout
      let kept = 0
      for (const region of layout.values()) {
        for (const label of Object.values(region.floatingLabelsData)) {
          if (label.nameLabel) {
            kept++
          }
        }
      }
      return { level: display.fitStage.level, kept, maxY: display.maxY, h }
    }

    const sweep = [0.2, 0.35, 0.5, 0.65, 0.8].map(keptAt)
    for (const s of sweep) {
      // Every height between bodies and labels lands on the solved decimated rung
      // (never regressing to `bodies` — the probe/commit invariant)...
      expect(s.level).toBe('decimated')
      // ...an intermediate set of names, not none and not all...
      expect(s.kept).toBeGreaterThan(0)
      expect(s.kept).toBeLessThan(total)
      // ...and the solved stack fills without overflowing the track.
      expect(s.maxY).toBeLessThanOrEqual(s.h + 0.5)
    }
    // Kept names never shrink as the track grows (monotonic)...
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!.kept).toBeGreaterThanOrEqual(sweep[i - 1]!.kept)
    }
    // ...and the tallest track keeps strictly more than the shortest (no plateau
    // — the whole point of solving the factor to the height).
    expect(sweep.at(-1)!.kept).toBeGreaterThan(sweep[0]!.kept)
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
    // The labels rung's reservation IS the base one here, so it reuses that
    // stack by reference rather than packing a byte-identical copy.
    expect(display.fitLabelsOnlyLayout).toBe(display.baseLaidOutDataMap)
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
    // Nothing is reserved anywhere, so all four rungs are the one base stack —
    // shared by reference, not packed four times. The decimated rung skips its
    // whole factor solve too: with names off there is nothing to decimate.
    expect(display.fitLabelsOnlyLayout).toBe(display.baseLaidOutDataMap)
    expect(display.fitDecimatedSolved).toBe(display.baseLaidOutDataMap)
    expect(display.fitBodiesOnlyLayout).toBe(display.baseLaidOutDataMap)
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
