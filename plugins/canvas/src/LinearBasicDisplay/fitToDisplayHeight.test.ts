import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { GROW_MAX_HEIGHT } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLaidOutData, maxBottom, packedContentHeight } from './layout.ts'
import { createTestEnvironment } from './testEnv.ts'
import { rowGeometrySignature } from './yMorph.ts'

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

// An overlapping stack whose bodies are DIFFERENT heights, so "the shortest body"
// and "the configured featureHeight" are distinguishable numbers — the fixture
// the squeeze floor's basis is pinned against.
function mixedHeightRegionData(heights: number[]) {
  const features = heights.map((height, i) => ({
    featureId: `h${i}`,
    startBp: 100,
    endBp: 900,
    height,
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

// The gene shape: a feature whose laid-out EXTENT is the whole stack of
// isoforms it contains, while the boxes it draws are the individual transcript
// rects inside it. The two numbers are what the squeeze floor's basis has to
// choose between, and every other fixture here makes them equal — a plain
// feature is one box the height of its own extent — so only this one can tell
// which the floor was built on.
function geneStackRegionData(opts: {
  genes: number
  isoformsPerGene: number
  isoformPx: number
}) {
  const { genes, isoformsPerGene, isoformPx } = opts
  const extentPx = isoformsPerGene * isoformPx
  const items = Array.from({ length: genes }, (_, i) => ({
    featureId: `g${i}`,
    startBp: 100,
    endBp: 900,
  }))
  // one rect per isoform, each attributed to its gene's flatbush entry
  const rects = items.flatMap((gene, i) =>
    Array.from({ length: isoformsPerGene }, (_, j) => ({
      geneIdx: i,
      startBp: gene.startBp,
      endBp: gene.endBp,
      y: j * isoformPx,
    })),
  )
  return makeFeatureData({
    flatbushItems: items.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'gene',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: extentPx,
        featureHeightPx: extentPx,
      }),
    ),
    rectPositions: new Uint32Array(rects.flatMap(r => [r.startBp, r.endBp])),
    rectYs: new Float32Array(rects.map(r => r.y)),
    rectHeights: new Float32Array(rects.map(() => isoformPx)),
    rectColors: new Uint32Array(rects.length),
    rectStrands: new Float32Array(rects.length),
    rectDensityFade: new Uint32Array(rects.length),
    rectFeatureIndices: new Uint32Array(rects.map(r => r.geneIdx)),
  })
}

// Every rect the display would paint, at the scale it would paint it — the
// quantity MIN_FIT_BOX_PX is a promise about.
function drawnBoxHeights(display: { laidOutDataMap: Map<number, unknown> }) {
  const out: number[] = []
  for (const data of (
    display as {
      laidOutDataMap: Map<number, { rectHeights: Float32Array }>
    }
  ).laidOutDataMap.values()) {
    out.push(...data.rectHeights)
  }
  return out
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
    const { display } = createDisplay()
    // Overflow content so there is a real scroll range (scrollTop is clamped to
    // the content, so a bare display with maxY 0 can't hold a nonzero scroll).
    display.setRpcData(0, stackedRegionData(12, 20), {
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
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    // Height above MIN_GROW_HEIGHT and chosen so base(355)*(97/355) rounds just
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

  // growTargetHeight (the grow-mode target) resolves to MIN_GROW_HEIGHT when
  // there's no content, rather than collapsing the track to a sliver.
  it('growTargetHeight floors at MIN_GROW_HEIGHT with no content', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.maxY).toBe(0)
    expect(display.growTargetHeight).toBe(50)
  })

  // Grow drives `height` from the laid-out content reactively — via the `height`
  // getter, NOT by writing the height config slot. So a settled zoom in grow mode
  // never mutates the persisted session (no autosave churn) nor bakes a momentary
  // height into a saved snapshot.
  it('grow mode drives height from content without writing the height slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const slotBefore = readConfObject(display.configuration, 'height')
    expect(slotBefore).toBe(100)

    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)

    // height tracks the grown content (taller than the 100px slot default)...
    expect(display.height).toBe(display.grownHeight)
    expect(display.height).toBeGreaterThan(slotBefore)
    // ...but the persisted config slot is untouched.
    expect(readConfObject(display.configuration, 'height')).toBe(slotBefore)
  })

  // The reactive path recomputes as content changes — no autorun needed.
  it('grow height grows as more content stacks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(3, 20), ctgA)
    const small = display.height
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    expect(display.height).toBeGreaterThan(small)
  })

  // The grow ceiling is the `growMaxHeight` slot, not a hardcoded constant: a
  // track pinned at the ceiling reads as inert autogrow, so raising the slot has
  // to actually raise it. Shared slot name and semantics with alignments.
  // The slot default is written as a literal so the generated config doc shows a
  // number rather than an identifier; this is what keeps it equal to the shared
  // default the alignments display's own slot uses.
  it('growMaxHeight defaults to the shared GROW_MAX_HEIGHT', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.growMaxHeight).toBe(GROW_MAX_HEIGHT)
  })

  it('grow pins at growMaxHeight, and follows content when it is raised', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    const content = display.growTargetHeight

    display.configuration.setSlot('growMaxHeight', content - 30)
    expect(display.height).toBe(content - 30)

    display.configuration.setSlot('growMaxHeight', content + 30)
    expect(display.height).toBe(content)
  })

  // Leaving grow bakes the height the user was seeing into the slot — one
  // deliberate write at the mode switch, so fixed/fit don't snap to the stale
  // slot default. After the switch the height stops tracking content.
  it('leaving grow mode bakes the grown height into the slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    const grown = display.grownHeight
    expect(display.height).toBe(grown)

    display.setHeightMode('fixed')
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)

    // Fixed no longer tracks content: more rows don't change the height.
    display.setRpcData(0, stackedRegionData(30, 20), ctgA)
    expect(display.height).toBe(grown)
  })

  // The promotable cascade can flip a grow track out of grow mode WITHOUT
  // setHeightMode — resetting it to the inherit sentinel or a session-default
  // change. The bake is a reaction on the resolved mode, so that exit bakes too.
  it('bakes on a cascade-driven grow exit, not just the menu action', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    const grown = display.grownHeight
    expect(display.height).toBe(grown)

    // Reset the slot to its unset sentinel, exactly as clearing a customized
    // value does. Resolved heightMode falls to 'fixed' with no setHeightMode call.
    display.configuration.setSlot('heightMode', undefined)
    expect(display.autoHeight).toBe(false)
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // A manual drag-resize leaves grow mode; the bake-on-exit keeps the height the
  // user was seeing, then the drag delta applies on top of it — the first drag
  // frame must not be swallowed by the bake.
  it('a manual drag-resize leaves grow mode so the height sticks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    const grown = display.grownHeight
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
    expect(display.heightMode).toBe('fixed')
    // The drag delta lands on top of the grown height the user was seeing.
    expect(display.height).toBe(grown + 50)
  })

  // Grow, like fit, resets scroll on entry so the sticky GPU canvas can't be
  // stranded at an offset the reconfigured height no longer supports.
  it('entering grow mode resets scroll to the top', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    display.setHeight(97)
    display.setScrollTop(120)
    expect(display.scrollTop).toBe(120)

    display.setHeightMode('grow')
    expect(display.scrollTop).toBe(0)
  })

  // A Y morph holds `maxY` at the taller of the old/new layout so rows animating
  // up from a deeper row aren't clipped — that inflation belongs to the scroll
  // extent, NOT to the grow-mode target height. `growTargetHeight`/`grownHeight`
  // read the settled height so the track doesn't bounce to the old (taller) height
  // for the morph's duration and then collapse.
  it('grow height ignores the morph hold that maxY applies', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(6, 20), ctgA)
    display.setHeight(400)

    const settled = display.settledMaxY
    const fitHeightBefore = display.growTargetHeight
    expect(settled).toBeGreaterThan(0)

    // Simulate a morph animating up from a much deeper prior layout.
    display.beginYMorph(new Map(), settled + 500)

    // Scroll extent honors the taller in-flight layout...
    expect(display.maxY).toBe(settled + 500)
    expect(display.scrollableHeight).toBeGreaterThan(0)
    // ...but the settled height and the grow target are unmoved.
    expect(display.settledMaxY).toBe(settled)
    expect(display.growTargetHeight).toBe(fitHeightBefore)
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
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
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
  // (normal) display mode fitSmallestBoxPx already is the normal height, so the grow
  // scale pins at 1 and a track taller than the content strands whitespace rather
  // than ballooning the bodies (the resize-taller regression).
  it('does not grow features past the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
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

  // A fit stack shorter than the track (grow capped at the normal height) stays
  // top-anchored at y=0, with the surplus as bottom whitespace, so a relayout
  // packs back up against the top instead of jumping to a re-centered offset.
  it('top-anchors a short fit stack in the track', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    display.setHeightMode('fit')

    display.setHeight(fullH * 3)
    // Grow is pinned at 1 (normal mode), so the content stays fullH tall and the
    // 2×fullH of slack strands as bottom whitespace.
    expect(display.fitScale).toBe(1)
    // Every rendered box keeps its natural top: the stack spans [0, fullH].
    const layout: Map<number, FeatureDataResult> = display.laidOutDataMap
    const tops = [...layout.values()].flatMap(d =>
      d.flatbushItems.map(i => i.topPx),
    )
    expect(Math.min(...tops)).toBe(0)
    expect(maxBottom(layout)).toBeCloseTo(fullH)
    // Scroll extent measures content only, so the short stack does not overflow.
    expect(display.maxY).toBeCloseTo(fullH)
    expect(display.hasOverflow).toBe(false)
  })

  // In a compact mode the laid-out bodies start below the normal height, so a
  // tall track may grow them to fill it — but the grow ceiling is the normal
  // height (fitMaxScale = 1 / multiplier), never taller.
  it('grows compact bodies only up to the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setDisplayMode('compact')
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
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
      const { display } = createDisplay()
      display.setRpcData(0, labeledStackedRegionData(rows, 10), ctgA)
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
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')
    // Stable across the sweep (the bodies don't change size, only the labels
    // reserved around them): the scale bounds the fill may reach before it
    // bottoms out and scrolls (min) or stops growing (max).
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
    const { display } = createDisplay()
    const total = 40
    // Pin a rung with names: the auto density gate (orthogonal to the fit
    // ladder) would otherwise hide all labels at this feature count.
    display.setShowLabels('nameAndDescription')
    display.setRpcData(0, mixedWidthRegionData(total), ctgA)
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
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(40, 10), ctgA)
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
    // A subfeature label survives the `bodies` rung (it is worker-baked, not a
    // rung) but not the squeeze: its reserved row scaled with everything else
    // while the text would still draw at the mode's full font size.
    expect(display.renderedShowSubfeatureLabels).toBe(false)
  })

  // The other side of that flag: every rung that isn't squeezing keeps the
  // subfeature labels, so turning "Subfeature labels" on is not silently undone
  // by entering fit mode.
  it('keeps subfeature labels wherever the fit is not squeezing', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(4, 10), ctgA)
    expect(display.renderedShowSubfeatureLabels).toBe(true)

    display.setHeightMode('fit')
    display.setHeight(400)
    expect(display.fitScale).toBe(1)
    expect(display.renderedShowSubfeatureLabels).toBe(true)
  })

  // The floor's promise is that NO body squeezes below MIN_FIT_BOX_PX, so it has
  // to be built on the shortest body in the stack. Reading the `featureHeight`
  // config slot instead described the plain-rect glyph and missed anything the
  // worker sized differently — here a 2px feature among 20px ones, which the
  // slot's 10px basis would have let squeeze to a fifth of a pixel.
  it('floors the squeeze on the shortest body, not the configured height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedHeightRegionData([20, 20, 2, 20]), ctgA)
    display.setHeightMode('fit')
    expect(readConfObject(display.configuration, 'featureHeight')).toBe(10)
    expect(display.fitSmallestBoxPx).toBe(2)
    // The shortest body is already at the minimum, so there is no squeeze left.
    expect(display.fitMinScale).toBe(1)

    // Same stack without the short feature: the floor relaxes to what a 20px body
    // can give up, so this isn't vacuously pinned at 1.
    const { display: tall } = createDisplay()
    tall.setRpcData(0, mixedHeightRegionData([20, 20, 20]), ctgA)
    tall.setHeightMode('fit')
    expect(tall.fitSmallestBoxPx).toBe(20)
    expect(tall.fitMinScale).toBeCloseTo(0.1)
  })

  // MIN_FIT_BOX_PX is a promise about DRAWN boxes, and for a gene the drawn box
  // is one transcript rect while the feature's laid-out extent is the whole
  // stack of them. Built on the extent, the floor let a 10-deep gene squeeze by
  // 1/50 and rendered each 10px isoform at a fifth of a pixel while reporting
  // that no box had gone under 2. Every other fixture here makes the two
  // numbers equal, so only a gene-shaped one can tell them apart.
  it('floors on the transcript rect a gene draws, not the gene it stacks them in', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(
      0,
      geneStackRegionData({ genes: 6, isoformsPerGene: 10, isoformPx: 10 }),
      ctgA,
    )
    display.setHeightMode('fit')

    // the drawn box, not the 100px extent the six genes stack out of
    expect(display.fitSmallestBoxPx).toBe(10)
    expect(display.fitMinScale).toBeCloseTo(0.2)

    // Ask for a height far under what even the floored squeeze can reach, so the
    // floor is what stops it...
    display.setHeight(20)
    expect(display.fitScale).toBeCloseTo(0.2)
    // ...and the promise holds on the rects that actually paint.
    for (const height of drawnBoxHeights(display)) {
      expect(height).toBeGreaterThanOrEqual(2)
    }
    // The surplus scrolls rather than vanishing, which is the trade the floor is
    // making.
    expect(display.hasOverflow).toBe(true)
  })

  // `featureHeight` is a per-feature jexl callback slot (contextVariable:
  // ['feature']), so reading it off the display — with no feature in scope —
  // evaluates the callback against nothing and throws. That used to happen inside
  // the squeeze floor, i.e. inside the fit layout every consumer reads, so a track
  // configured this way went blank the moment it was switched to fit.
  // What the Y-morph does across the ladder, pinned because it is the visible
  // half of fit mode and nothing else states it. `CanvasYMorph` animates rows only
  // while `rowGeometrySignature` holds still; a changed signature snaps, on the
  // reasoning that rescaled rows have nothing comparable to ease between.
  //
  // So: crossing a rung boundary SNAPS — the reservation changes, names or
  // descriptions appear or vanish, and every row restructures at once. That is
  // the jump you see at the moment the ladder changes rung. Staying within a rung
  // morphs, but only while the fit scale is pinned: at `bodies` (squeezing) and in
  // every compact mode (grow-to-fill), the scale tracks content height, so it
  // moves whenever the content does and the morph is unavailable.
  //
  // This is a description, not an endorsement — if boundaries should ease instead,
  // this test is what says which transitions change.
  it('snaps across a rung boundary and morphs within one', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('nameAndDescription')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    display.setHeightMode('fit')

    const signature = () =>
      rowGeometrySignature({
        displayMode: display.displayMode,
        renderedShowLabels: display.renderedShowLabels,
        renderedShowDescriptions: display.renderedShowDescriptions,
        fitScale: display.fitScale,
      })
    const at = (h: number) => {
      display.setHeight(h)
      return { level: display.fitStage.level, sig: signature() }
    }

    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(fullH).toBeGreaterThan(labelsH)
    expect(labelsH).toBeGreaterThan(bodiesH)

    // Either side of the full/labels boundary: different rungs, different
    // signature — the descriptions that vanish are exactly what rescaled the rows.
    const inFull = at(Math.round(fullH) + 10)
    const inLabels = at(Math.round(fullH) - 10)
    expect(inFull.level).toBe('full')
    expect(inLabels.level).toBe('labels')
    expect(inLabels.sig).not.toBe(inFull.sig)

    // ...and the labels/bodies boundary, where the names go.
    const inBodies = at(Math.round(labelsH) - 10)
    expect(inBodies.level).toBe('bodies')
    expect(inBodies.sig).not.toBe(inLabels.sig)

    // Within a rung, with the scale pinned at 1 (normal display mode never grows),
    // the signature holds — so a zoom re-pack at this height eases rather than
    // jumping. This is the case the morph exists for.
    expect(at(Math.round(fullH) + 40).sig).toBe(inFull.sig)
    expect(display.fitScale).toBe(1)

    // At `bodies` the squeeze is active, so the scale — and with it the morph
    // gate — moves with the track height rather than holding.
    const squeezedA = at(Math.round(bodiesH) - 40)
    const squeezedB = at(Math.round(bodiesH) - 44)
    expect(squeezedA.level).toBe('bodies')
    expect(display.fitScale).toBeLessThan(1)
    expect(squeezedB.sig).not.toBe(squeezedA.sig)
  })

  it('lays out under fit mode with a per-feature featureHeight callback', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedHeightRegionData([20, 20, 20]), ctgA)
    setConf(display, 'featureHeight', "jexl:get(feature,'score') > 5 ? 20 : 8")
    display.setHeightMode('fit')
    display.setHeight(30)
    expect(display.fitStage.level).toBe('bodies')
    expect(display.laidOutDataMap.size).toBeGreaterThan(0)
    expect(Number.isFinite(display.fitScale)).toBe(true)
    expect(Number.isFinite(display.maxY)).toBe(true)
  })

  // Descriptions off (or density-hidden) collapses the full and labels stages
  // onto one name-only reservation, so the ladder has no distinct descriptions
  // step and drops straight from names to bodies. Exercises the labels-only
  // shortcut that reuses the base layout.
  it('with descriptions off, the full and labels stages coincide', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('name')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
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
    const { display } = createDisplay()
    display.setShowLabels('none')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
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

  // The solve measures its ~9 trial factors with packedContentHeight (no clone,
  // no Y rewrite) and lays out only the winner. That is only sound if the probe
  // and the commit agree exactly on the height — otherwise the ladder keeps a rung
  // it measured as fitting and then renders one that overflows.
  it('the probed height equals the committed layout height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(60), ctgA)
    display.setHeightMode('fit')
    // A height between the all-names stack and the bodies stack, so the ladder
    // lands on `decimated` and the solve actually runs.
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeight(Math.round((labelsH + bodiesH) / 2))
    expect(display.fitStage.level).toBe('decimated')

    const factor = display.solveLabelRoomFactor(display.fitTargetHeight)
    expect(factor).toBeDefined()
    const inputs = display.decimatedLayoutInputs(factor!)
    expect(packedContentHeight(display.rpcDataMap, inputs)).toBe(
      maxBottom(computeLaidOutData(display.rpcDataMap, inputs)),
    )
    // ...and that is the height the ladder committed to.
    expect(display.fitStage.contentHeight).toBe(
      packedContentHeight(display.rpcDataMap, inputs),
    )
  })

  // Every drag-resize frame and every pan settle re-solves the factor, and most
  // of those land on the factor already committed. Re-packing that same stack
  // into fresh objects would hand the GPU upload diff a whole new layout to push
  // for a stack that did not move — the exact churn the incremental memo exists
  // to prevent on the other three rungs, and the reason this rung has one too.
  it('reuses the committed decimated stack when the factor is unchanged', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(60), ctgA)
    display.setHeightMode('fit')
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    const h = Math.round((labelsH + bodiesH) / 2)
    display.setHeight(h)
    expect(display.fitStage.level).toBe('decimated')

    const before = display.laidOutDataMap.get(0)
    const factorBefore = display.solveLabelRoomFactor(display.fitTargetHeight)
    // A sub-pixel nudge: one frame of a resize drag, far too small to move the
    // solve off the factor it just committed.
    display.setHeight(h + 0.01)
    expect(display.solveLabelRoomFactor(display.fitTargetHeight)).toBe(
      factorBefore,
    )
    expect(display.laidOutDataMap.get(0)).toBe(before)
  })

  // The probe's preparation (label widths, the neighbor-room sorts) is a function
  // of the data and the layout inputs, NOT of the track height — which is what
  // lets a drag-resize re-solve pay for the bisection's packs alone. Pinned by
  // reference so a stray height read inside it can't quietly reintroduce the cost.
  it('holds one height probe across a track-height change', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(60), ctgA)
    display.setHeightMode('fit')
    display.setHeight(120)
    // Observed by a reaction, so MobX keeps the computed alive between reads —
    // the state the app is in, and the only one where caching is observable.
    const seen: unknown[] = []
    const dispose = autorun(() => {
      seen.push(display.decimatedHeightProbe)
    })
    display.setHeight(240)
    display.setHeight(240.5)
    dispose()
    expect(seen).toHaveLength(1)
  })

  // Factor 0 keeps every name, so when it fits there is nothing to decimate and
  // the solve must say so rather than bisecting into a needless name cull. The
  // `labels` rung is packed through the incremental memo, whose prior-row seeding
  // can make it taller than an unseeded pack, so "labels overflowed" does not by
  // itself prove factor 0 overflows — hence probing it instead of assuming.
  it('solves to factor 0 when every name already fits', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(30), ctgA)
    display.setHeightMode('fit')
    const roomy = maxBottom(display.fitLabelsOnlyLayout) + 500
    expect(display.solveLabelRoomFactor(roomy)).toBe(0)
    // Nothing fits when there is no room at all, and the solve reports that
    // rather than returning its most aggressive factor.
    expect(display.solveLabelRoomFactor(1)).toBeUndefined()
  })

  // A reversed region is the one case where the whitespace factor changes the
  // insertion SORT and not just the row heights: the name overhangs leftward, so it
  // widens layoutStartBp, which is the sort key. That is the only place the
  // bisection's "stack height is monotone in the factor" premise could break, so
  // check the solve end-to-end there rather than only the keep/drop rule.
  it('solves and commits consistently in a reversed region', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    // `reversedRegions` is derived from the region each fetch was loaded with, not
    // from the view, so the flag has to ride in on setRpcData.
    display.setRpcData(0, mixedWidthRegionData(60), {
      ...ctgA,
      reversed: true,
    })
    expect(display.reversedRegions.has(0)).toBe(true)
    display.setHeightMode('fit')

    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeight(Math.round((labelsH + bodiesH) / 2))

    const factor = display.solveLabelRoomFactor(display.fitTargetHeight)
    expect(factor).toBeDefined()
    const inputs = display.decimatedLayoutInputs(factor!)
    // probe and commit still agree once the sort key itself moves with the factor
    expect(packedContentHeight(display.rpcDataMap, inputs)).toBe(
      maxBottom(computeLaidOutData(display.rpcDataMap, inputs)),
    )
    // and whatever rung the ladder settles on genuinely fits, or is the last one
    expect(
      display.fitStage.contentHeight <= display.fitTargetHeight ||
        display.fitStage.level === 'bodies',
    ).toBe(true)
  })

  // Height must be monotone non-increasing in the factor — the premise the
  // bisection rests on. Asserted over a sweep rather than trusted, in both region
  // orientations.
  it('packs a monotone non-increasing stack as the factor rises', () => {
    for (const reversed of [false, true]) {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      display.setRpcData(0, mixedWidthRegionData(60), {
        ...ctgA,
        reversed,
      })
      expect(display.reversedRegions.has(0)).toBe(reversed)
      const heights = [0, 0.25, 0.5, 1, 2, 4, 8].map(f =>
        packedContentHeight(
          display.rpcDataMap,
          display.decimatedLayoutInputs(f),
        ),
      )
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]!).toBeLessThanOrEqual(heights[i - 1]!)
      }
      // and the sweep actually moves, so this isn't vacuously true
      expect(heights.at(-1)!).toBeLessThan(heights[0]!)
    }
  })

  // Features past GranularRectLayout's row limit are pushed offscreen: they don't
  // draw, don't hit-test, and don't count toward maxY — so the display would
  // otherwise report a tidy fitted track while silently withholding data.
  it('counts features the layout could not place', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setHeight(200)
    // 800 mutually-overlapping features each need their own row, which passes the
    // 10000px row limit well before the last of them is placed.
    display.setRpcData(0, stackedRegionData(800, 20), ctgA)

    expect(display.truncatedFeatureCount).toBeGreaterThan(0)
    const placed = 800 - display.truncatedFeatureCount
    // maxY only accounts for what was placed, which is why the count is needed.
    expect(display.settledMaxY).toBeLessThan(800 * 20)
    expect(placed).toBeGreaterThan(0)
    expect(placed).toBeLessThan(800)
  })

  it('reports nothing truncated on a stack that fits the row limit', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setHeight(100)
    display.setRpcData(0, stackedRegionData(20, 20), ctgA)
    expect(display.truncatedFeatureCount).toBe(0)
  })
})

// Overlapping labeled genes spanning [start, end), each 1kb narrower than the
// last so they stack into their own rows. Placed by bp so a set can be put
// inside the viewport or out in the fetch buffer; `height` so the two sets can
// carry different body heights (the squeeze floor's basis).
function genesOver(
  prefix: string,
  start: number,
  end: number,
  n: number,
  height = 10,
) {
  const feats = Array.from({ length: n }, (_, i) => ({
    featureId: `${prefix}${i}`,
    startBp: start + i * 500,
    endBp: end - i * 500,
    height,
  }))
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const f of feats) {
    floatingLabelsData[f.featureId] = {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: height,
      nameLabel: {
        text: f.featureId,
        relativeY: 0,
        color: '#000',
        textWidth: 60,
      },
    }
  }
  return { feats, floatingLabelsData }
}

// n features sharing ONE span, so every one of them needs a row of its own —
// enough of them and the stack passes GranularRectLayout's row limit and the
// overflow is truncated. Same shape as `genesOver` so both feed `geneRegionData`.
function stackedGenesAt(
  prefix: string,
  start: number,
  end: number,
  n: number,
): ReturnType<typeof genesOver> {
  return {
    feats: Array.from({ length: n }, (_, i) => ({
      featureId: `${prefix}${i}`,
      startBp: start,
      endBp: end,
      height: 20,
    })),
    floatingLabelsData: {},
  }
}

function geneRegionData(
  groups: ReturnType<typeof genesOver>[],
): FeatureDataResult {
  const feats = groups.flatMap(g => g.feats)
  return makeFeatureData({
    flatbushItems: feats.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'mRNA',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: f.height,
        featureHeightPx: f.height,
      }),
    ),
    rectPositions: new Uint32Array(feats.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(feats.length),
    rectHeights: new Float32Array(feats.map(f => f.height)),
    rectColors: new Uint32Array(feats.length),
    rectStrands: new Float32Array(feats.length),
    rectDensityFade: new Uint32Array(feats.length),
    rectFeatureIndices: new Uint32Array(feats.map((_, i) => i)),
    floatingLabelsData: Object.assign(
      {},
      ...groups.map(g => g.floatingLabelsData),
    ),
  })
}

// The fetch deliberately loads half a viewport of extra features on each side
// (`bufferedVisibleRegions`), and the packer gives every one of them a row. Those
// rows add stack height while drawing nothing on screen, so measuring the whole
// pack made the fit squeeze the boxes — and strip the labels — to fit features
// the user cannot see. Fit measures `fitMeasureFeatureIds` instead: the on-screen
// features, on the same pack.
describe('canvas display fit measures the visible window', () => {
  // 800px over 80kb (100kb..180kb visible), with the fetch region covering the
  // buffered 60kb..220kb the display is really handed.
  function fitOver(offscreenGenes: number) {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 8),
        genesOver('left', 62_000, 98_000, offscreenGenes),
        genesOver('right', 182_000, 218_000, offscreenGenes),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setHeight(100)
    display.setHeightMode('fit')
    let onScreenBottom = 0
    for (const data of display.laidOutDataMap.values()) {
      for (const item of data.flatbushItems) {
        if (
          item.featureId.startsWith('vis') &&
          item.bottomPx > onScreenBottom
        ) {
          onScreenBottom = item.bottomPx
        }
      }
    }
    return {
      level: display.fitStage.level,
      scale: display.fitScale,
      contentHeight: display.fitStage.contentHeight,
      onScreenBottom,
    }
  }

  it('ignores buffered off-screen features when sizing the stack', () => {
    const alone = fitOver(0)
    const buffered = fitOver(10)
    // The off-screen genes are packed (they hold rows of their own) but change
    // nothing about how the on-screen stack is fitted.
    expect(buffered.contentHeight).toBe(alone.contentHeight)
    expect(buffered.scale).toBe(alone.scale)
    expect(buffered.level).toBe(alone.level)
    // ...and the visible stack still fills the track rather than being squeezed
    // into a fraction of it.
    expect(buffered.onScreenBottom).toBe(alone.onScreenBottom)
    expect(buffered.onScreenBottom).toBeCloseTo(100, 5)
  })

  // The set is on-screen membership, so a feature entering the viewport starts
  // counting and one leaving stops.
  it('tracks the viewport as it moves', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 4),
        genesOver('right', 182_000, 218_000, 12),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setHeight(100)
    display.setHeightMode('fit')
    const before = display.fitStage.contentHeight

    // Pan onto the taller off-screen group; the coarse blocks are what the
    // measurement reads, so it re-fits when they are flushed.
    view.scrollTo(182_000 / 100)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.fitStage.contentHeight).toBeGreaterThan(before)
  })

  // The squeeze floor is the other half of the measurement, and it binds on the
  // SHORTEST body — so leaving the fetch buffer in could only ever raise it. A
  // 2px mark sitting half a viewport away (a sub-pixel repeat, a variant tick)
  // is already at MIN_FIT_BOX_PX, which pins the floor at 1 and stops the visible
  // stack squeezing at all: the track then scrolls rather than fitting, in the
  // mode whose whole promise is that it doesn't.
  it('floors the squeeze on the visible stack, not the fetch buffer', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 12, 20),
        genesOver('left', 62_000, 98_000, 4, 2),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setHeightMode('fit')
    display.setHeight(40)

    // The off-screen 2px marks are laid out, but the floor is built on the 20px
    // bodies the user is looking at...
    expect(display.fitSmallestBoxPx).toBe(20)
    expect(display.fitMinScale).toBeCloseTo(0.1)
    // ...so the visible stack squeezes into the track instead of scrolling.
    expect(display.fitScale).toBeLessThan(1)
    expect(display.hasOverflow).toBe(false)
  })

  // The truncated count is the third measurement, and it is the one the user
  // reads: "N not shown (past the layout row limit; filter or zoom in)". A pile
  // deep enough to truncate, sitting entirely in the fetch buffer, is not
  // something filtering or zooming addresses — panning is — so in fit mode the
  // count is over the visible window like everything else.
  it('counts only the truncation the user is looking at', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 4),
        // one bp span, 800 deep: they pass the row limit among themselves, while
        // the on-screen four sit beside them in X and keep their rows
        stackedGenesAt('left', 62_000, 98_000, 800),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setHeight(100)

    // Outside fit mode the whole stack is the subject, and it is truncated...
    expect(display.truncatedFeatureCount).toBeGreaterThan(0)
    // ...but nothing the viewport holds is, so fit mode reports none.
    display.setHeightMode('fit')
    expect(display.truncatedFeatureCount).toBe(0)
  })

  // Outside fit mode nothing is narrowed: grow sizes the track to every feature
  // it holds, so panning inside the buffer doesn't resize the track.
  it('measures the whole stack outside fit mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 4),
        genesOver('right', 182_000, 218_000, 12),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.fitMeasureFeatureIds).toBeUndefined()
    expect(display.fitStage.contentHeight).toBe(
      maxBottom(display.baseLaidOutDataMap),
    )
  })
})

// The same "measure the window, not the buffer" rule, applied to the scroll
// extent rather than to the fit ladder. The scrollbar and the edge shadow are
// two readouts of one number, and both answer "is this track showing me all of
// its features" — so a stack whose deep rows are all fetch buffer must report
// no overflow, however tall the pack is. Three figures came back from one review
// pass with a shadow drawn under empty canvas.
describe('canvas display scrolls over the visible window', () => {
  // 800px over 80kb, the fetch region covering the buffered 60kb..220kb: four
  // genes on screen and `offscreen` more packed beside them in the buffer.
  function bufferedStack(offscreen: number) {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 400_000, refName: 'ctgA' },
    ])
    view.zoomTo(100)
    view.scrollTo(1000)
    display.setRpcData(
      0,
      geneRegionData([
        genesOver('vis', 120_000, 160_000, 4),
        genesOver('right', 182_000, 218_000, offscreen),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    let onScreenBottom = 0
    for (const data of display.laidOutDataMap.values()) {
      for (const item of data.flatbushItems) {
        if (
          item.featureId.startsWith('vis') &&
          item.bottomPx > onScreenBottom
        ) {
          onScreenBottom = item.bottomPx
        }
      }
    }
    // tall enough for every on-screen row, far short of the whole pack
    display.setHeight(Math.ceil(onScreenBottom) + 10)
    return { display, view, onScreenBottom }
  }

  it('reports no overflow when only the buffer is below the fold', () => {
    const { display } = bufferedStack(12)
    // the pack really is deeper than the track — this is the case that drew a
    // scrollbar and a bottom shadow over blank canvas
    expect(display.maxY).toBeGreaterThan(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
    expect(display.scrollContentHeight).toBe(display.height)
  })

  it('still DRAWS the buffered rows it will not scroll to', () => {
    const { display } = bufferedStack(12)
    // the canvas, the overlay layer and the peptide lane are sized from
    // contentHeight, so a buffered feature keeps its box and its label — it is
    // unreachable, not clipped
    expect(display.contentHeight).toBe(display.maxY)
    expect(display.contentHeight).toBeGreaterThan(display.scrollContentHeight)
  })

  it('scrolls when the visible window is what overflows', () => {
    const { display } = bufferedStack(0)
    display.setHeight(20)
    expect(display.hasOverflow).toBe(true)
    expect(display.scrollableHeight).toBeGreaterThan(0)
  })

  it('re-measures on a pan onto the deeper group', () => {
    const { display, view } = bufferedStack(12)
    expect(display.hasOverflow).toBe(false)

    view.scrollTo(182_000 / 100)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.hasOverflow).toBe(true)
  })

  // The clamp TrackHeightMixin installs is earned by this getter, so a pan back
  // out of the deep group pulls the offset with it rather than stranding the
  // viewport over blank canvas.
  it('clamps a scroll offset the pan left behind', () => {
    const { display, view } = bufferedStack(12)
    view.scrollTo(182_000 / 100)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setScrollTop(display.scrollableHeight)
    expect(display.scrollTop).toBeGreaterThan(0)

    view.scrollTo(1000)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.scrollTop).toBe(0)
  })

  // Before the view has coarse blocks there is no window to measure, so the
  // extent is the whole pack — the behavior every consumer had.
  it('falls back to the whole pack with no coarse blocks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    display.setHeight(97)
    expect(display.onScreenFeatureIds).toBeUndefined()
    expect(display.scrollExtentMaxY).toBe(display.maxY)
    expect(display.hasOverflow).toBe(true)
  })
})
