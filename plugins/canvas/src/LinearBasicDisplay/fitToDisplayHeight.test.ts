import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { GROW_MAX_HEIGHT } from '@jbrowse/display-kit/heightMode'
import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLaidOutData } from './layout.ts'
import { maxBottom } from './layoutQueries.ts'
import { packedContentHeight } from './layoutTestUtils.ts'
import { createTestEnvironment } from './testEnv.ts'
import { rowGeometrySignature } from './yMorph.ts'

import type {
  FeatureDataResult,
  FloatingLabelsDataMap,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { TestDisplay } from './testEnv.ts'

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

function labeledStackedRegionData(rows: number, heightPx: number) {
  const base = stackedRegionData(rows, heightPx)
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (let i = 0; i < rows; i++) {
    floatingLabelsData.set(`f${i}`, {
      featureId: `f${i}`,
      minX: 100,
      maxX: 500,
      topY: 0,
      featureHeight: heightPx,
      nameLabel: {
        text: `name${i}`,
        relativeY: 0,
        textWidth: 40,
      },
      descriptionLabel: {
        text: `description ${i}`,
        relativeY: 0,
        textWidth: 80,
      },
    })
  }
  return makeFeatureData({ ...base, floatingLabelsData })
}

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
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (const f of features) {
    floatingLabelsData.set(f.featureId, {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: f.height,
      nameLabel: {
        text: f.featureId,
        relativeY: 0,
        textWidth: 40,
      },
    })
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

function belowLabeledStackedRegionData(rows: number, heightPx: number) {
  const base = stackedRegionData(rows, heightPx)
  return makeFeatureData({
    ...base,
    flatbushItems: base.flatbushItems.map(f => ({ ...f, labelRows: 1 })),
  })
}

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

function drawnBoxHeights(display: {
  laidOutDataMap: ReadonlyMap<number, { rectHeights: Float32Array }>
}) {
  const out: number[] = []
  for (const data of display.laidOutDataMap.values()) {
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

function displaySignature(display: TestDisplay) {
  const { level, maxIsoforms } = display.fitStage
  return rowGeometrySignature({
    displayMode: display.displayMode,
    renderedShowLabels: display.renderedShowLabels,
    renderedShowDescriptions: display.renderedShowDescriptions,
    fitScale: display.fitScale,
    fitLevel: level,
    labelRoomFactor:
      level === 'decimated' ? display.fitDecimatedFactor : undefined,
    maxIsoforms,
  })
}

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

    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
    expect(display.scrollTop).toBe(0)

    display.setHeightMode('fixed')
    expect(display.fitHeightToDisplay).toBe(false)
    display.setScrollTop(120)
    expect(display.scrollTop).toBe(120)
  })

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
    display.setHeight(97)
    expect(display.baseLaidOutDataMap.size).toBeGreaterThan(0)
    expect(display.fitScale).toBe(1)
    expect(display.hasOverflow).toBe(true)

    display.setHeightMode('fit')
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
  })

  it('growTargetHeight holds the slot height while no layout exists', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.maxY).toBe(0)
    expect(display.growTargetHeight).toBe(100)
  })

  it('growTargetHeight floors at MIN_GROW_HEIGHT once an empty region loads', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(0, 20), ctgA)
    expect(display.settledMaxY).toBe(0)
    expect(display.growTargetHeight).toBe(50)
  })

  it('grow mode drives height from content without writing the height slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const slotBefore = readConfObject(display.configuration, 'height')
    expect(slotBefore).toBe(100)

    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)

    expect(display.height).toBe(display.grownHeight)
    expect(display.height).toBeGreaterThan(slotBefore)
    expect(readConfObject(display.configuration, 'height')).toBe(slotBefore)
  })

  it('grow height grows as more content stacks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(3, 20), ctgA)
    const small = display.height
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    expect(display.height).toBeGreaterThan(small)
  })

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

    display.setRpcData(0, stackedRegionData(30, 20), ctgA)
    expect(display.height).toBe(grown)
  })

  it('bakes on a cascade-driven grow exit, not just the menu action', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    const grown = display.grownHeight
    expect(display.height).toBe(grown)

    display.configuration.setSlot('heightMode', undefined)
    expect(display.autoHeight).toBe(false)
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

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
    expect(display.height).toBe(grown + 50)
  })

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

  it('grow height ignores the morph hold that maxY applies', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(6, 20), ctgA)
    display.setHeight(400)

    const settled = display.settledMaxY
    const fitHeightBefore = display.growTargetHeight
    expect(settled).toBeGreaterThan(0)

    display.beginYMorph(new Map(), settled + 500)

    expect(display.maxY).toBe(settled + 500)
    expect(display.contentHeight).toBe(settled + 500)
    expect(display.settledMaxY).toBe(settled)
    expect(display.growTargetHeight).toBe(fitHeightBefore)
  })

  it('keeps the morph hold out of the scroll extent', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(6, 20), ctgA)
    display.setHeight(400)
    display.setHeightMode('fit')
    const settled = display.settledMaxY
    expect(display.hasOverflow).toBe(false)

    display.beginYMorph(new Map(), settled + 500)

    expect(display.maxY).toBe(settled + 500)
    expect(display.scrollExtentMaxY).toBe(settled)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
  })
})

describe('canvas display fit escalation ladder', () => {
  it('climbs the ladder as the track height shrinks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')

    display.setHeight(fullH)
    expect(display.fitStage.level).toBe('full')
    expect(display.renderedShowDescriptions).toBe(true)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBe(1)

    display.setHeight(Math.round((labelsH + fullH) / 2))
    expect(display.fitStage.level).toBe('labels')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.fitScale).toBeGreaterThanOrEqual(1)
    expect(display.hasOverflow).toBe(false)

    display.setHeight(Math.round(bodiesH / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(false)
    expect(display.fitScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  it('tells the user what each rung gave up', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    const labelRows = () =>
      display
        .showSubmenuRadioGroups()
        .map(item => ('label' in item ? item.label : undefined))

    display.setHeight(fullH)
    expect(display.fitNote).toBeUndefined()
    display.setHeightMode('fit')
    expect(display.fitNote).toBeUndefined()
    expect(labelRows()).toContain('Auto')

    display.setHeight(Math.round((labelsH + fullH) / 2))
    expect(display.fitStage.level).toBe('labels')
    expect(display.fitNote).toBe(
      'descriptions hidden (taller track shows more)',
    )
    expect(labelRows()).toContain('Auto — descriptions hidden to fit')

    display.setHeight(Math.round(bodiesH / 2))
    expect(display.fitStage.level).toBe('bodies')
    expect(display.fitNote).toBe(
      `names + descriptions hidden, squeezed to ${Math.round(display.fitScale * 100)}% (taller track shows more)`,
    )
    expect(labelRows()).toContain('Auto — hidden to fit')

    display.setHeightMode('fixed')
    expect(display.fitNote).toBeUndefined()
    expect(labelRows()).toContain('Auto')
  })

  it('does not grow features past the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    expect(display.fitMaxScale).toBe(1)
    display.setHeightMode('fit')

    display.setHeight(Math.round(fullH * 3))
    expect(display.fitStage.level).toBe('full')
    expect(display.fitScale).toBe(1)
    expect(display.maxY).toBe(fullH)
    expect(display.maxY).toBeLessThan(display.height)
    expect(display.hasOverflow).toBe(false)
  })

  it('top-anchors a short fit stack in the track', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    display.setHeightMode('fit')

    display.setHeight(fullH * 3)
    expect(display.fitScale).toBe(1)
    const layout: ReadonlyMap<number, FeatureDataResult> =
      display.laidOutDataMap
    const tops = [...layout.values()].flatMap(d =>
      d.flatbushItems.map(i => i.topPx),
    )
    expect(Math.min(...tops)).toBe(0)
    expect(maxBottom(layout)).toBeCloseTo(fullH)
    expect(display.maxY).toBeCloseTo(fullH)
    expect(display.hasOverflow).toBe(false)
  })

  it('grows compact bodies only up to the normal feature height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setDisplayMode('compact')
    display.setRpcData(0, labeledStackedRegionData(3, 10), ctgA)
    expect(display.fitMaxScale).toBeCloseTo(1 / 0.6)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    display.setHeightMode('fit')

    display.setHeight(Math.round(fullH * display.fitMaxScale * 3))
    expect(display.fitScale).toBe(display.fitMaxScale)
    expect(display.maxY).toBeLessThan(display.height)
    expect(display.hasOverflow).toBe(false)
  })

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

  it('holds its invariants at every track height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    display.setHeightMode('fit')
    const minScale = display.fitMinScale
    const maxScale = display.fitMaxScale

    const rungs = [
      ['full', fullH],
      ['labels', labelsH],
      ['decimated', bodiesH],
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
      const h = display.height
      const level = display.fitStage.level
      const active = maxBottom(display.fitStage.layout)
      const scale = display.fitScale

      expect(level).toBe(expectedLevel(h))

      expect(scale).toBeGreaterThanOrEqual(minScale)
      expect(scale).toBeLessThanOrEqual(maxScale)
      expect(scale).toBeCloseTo(
        Math.max(minScale, Math.min(maxScale, h / active)),
      )

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

      expect(display.renderedShowDescriptions).toBe(
        display.effectiveShowDescriptions && level === 'full',
      )
      expect(display.renderedShowLabels).toBe(
        display.showLabels && level !== 'bodies',
      )
    }
  })

  it('fills the decimated rung with more names as the track grows', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const total = 40
    display.setShowLabels('nameAndDescription')
    display.setRpcData(0, mixedWidthRegionData(total), ctgA)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(labelsH).toBeGreaterThan(bodiesH * 1.5)
    display.setHeightMode('fit')

    const keptAt = (frac: number) => {
      const h = Math.round(bodiesH + (labelsH - bodiesH) * frac)
      display.setHeight(h)
      const layout: Map<number, FeatureDataResult> = display.fitStage.layout
      let kept = 0
      for (const region of layout.values()) {
        for (const label of [...region.floatingLabelsData.values()]) {
          if (label.nameLabel) {
            kept++
          }
        }
      }
      return {
        level: display.fitStage.level,
        kept,
        maxY: display.maxY,
        h,
        factor: display.fitDecimatedFactor,
        names: display.fitDrops.names,
      }
    }

    const sweep = [0.2, 0.35, 0.5, 0.65, 0.8].map(keptAt)
    for (const s of sweep) {
      expect(s.level).toBe('decimated')
      expect(s.kept).toBeGreaterThan(0)
      expect(s.kept).toBeLessThan(total)
      expect(s.maxY).toBeLessThanOrEqual(s.h + 0.5)
      expect(s.factor).toBeGreaterThan(0)
      expect(s.names).toBe('some')
    }
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!.kept).toBeGreaterThanOrEqual(sweep[i - 1]!.kept)
    }
    expect(sweep.at(-1)!.kept).toBeGreaterThan(sweep[0]!.kept)
  })

  it('stops the squeeze at the min-box floor and scrolls the surplus', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, labeledStackedRegionData(40, 10), ctgA)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    const minScale = display.fitMinScale
    display.setHeightMode('fit')
    display.setHeight(Math.max(20, Math.round((bodiesH * minScale) / 2)))

    expect(display.fitStage.level).toBe('bodies')
    expect(display.fitScale).toBe(minScale)
    expect(display.hasOverflow).toBe(true)
    expect(display.scrollableHeight).toBeGreaterThan(0)
    expect(display.renderedShowSubfeatureLabels).toBe(false)
  })

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

  it('drops the below-label rows before squeezing the bodies', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'subfeatureLabels', 'below')
    display.setRpcData(0, belowLabeledStackedRegionData(8, 10), ctgA)
    display.setHeightMode('fit')

    const bodiesHeight = maxBottom(display.fitBodiesOnlyLayout)
    const bareHeight = maxBottom(display.fitBareLayout)
    expect(bareHeight).toBeLessThan(bodiesHeight)

    display.setHeight(Math.ceil((bareHeight + bodiesHeight) / 2))
    expect(display.fitStage.level).toBe('bare')
    expect(display.fitScale).toBe(1)
    expect(display.hasOverflow).toBe(false)
    expect(display.renderedShowSubfeatureLabels).toBe(false)
    expect(display.renderedShowLabels).toBe(false)
    expect(display.fitNote).toContain('subfeature labels hidden')
  })

  it('squeezes at the bare rung once even the reclaimed rows overflow', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'subfeatureLabels', 'below')
    display.setRpcData(0, belowLabeledStackedRegionData(8, 10), ctgA)
    display.setHeightMode('fit')
    display.setHeight(Math.floor(maxBottom(display.fitBareLayout) / 2))
    expect(display.fitStage.level).toBe('bare')
    expect(display.fitScale).toBeLessThan(1)
    expect(display.renderedShowSubfeatureLabels).toBe(false)
  })

  it('has no bare rung while the settings reserve no below-label rows', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, stackedRegionData(8, 10), ctgA)
    display.setHeightMode('fit')
    display.setHeight(20)
    expect(display.reservesBelowLabelRows).toBe(false)
    expect(display.fitStage.level).toBe('bodies')
  })

  it('floors the squeeze on the shortest body, not the configured height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedHeightRegionData([20, 20, 2, 20]), ctgA)
    display.setHeightMode('fit')
    expect(readConfObject(display.configuration, 'featureHeight')).toBe(10)
    expect(display.fitSmallestBoxPx).toBe(2)
    expect(display.fitMinScale).toBe(1)

    const { display: tall } = createDisplay()
    tall.setRpcData(0, mixedHeightRegionData([20, 20, 20]), ctgA)
    tall.setHeightMode('fit')
    expect(tall.fitSmallestBoxPx).toBe(20)
    expect(tall.fitMinScale).toBeCloseTo(0.1)
  })

  it('floors on the transcript rect a gene draws, not the gene it stacks them in', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(
      0,
      geneStackRegionData({ genes: 6, isoformsPerGene: 10, isoformPx: 10 }),
      ctgA,
    )
    display.setHeightMode('fit')

    expect(display.fitSmallestBoxPx).toBe(10)
    expect(display.fitMinScale).toBeCloseTo(0.2)

    display.setHeight(20)
    expect(display.fitScale).toBeCloseTo(0.2)
    for (const height of drawnBoxHeights(display)) {
      expect(height).toBeGreaterThanOrEqual(2)
    }
    expect(display.hasOverflow).toBe(true)
  })

  it('snaps across a rung boundary and morphs within one', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('nameAndDescription')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    display.setHeightMode('fit')

    const signature = () => displaySignature(display)
    const at = (h: number) => {
      display.setHeight(h)
      return { level: display.fitStage.level, sig: signature() }
    }

    const fullH = maxBottom(display.baseLaidOutDataMap)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(fullH).toBeGreaterThan(labelsH)
    expect(labelsH).toBeGreaterThan(bodiesH)

    const inFull = at(Math.round(fullH) + 10)
    const inLabels = at(Math.round(fullH) - 10)
    expect(inFull.level).toBe('full')
    expect(inLabels.level).toBe('labels')
    expect(inLabels.sig).not.toBe(inFull.sig)

    const inDecimated = at(Math.round(labelsH) - 10)
    expect(inDecimated.level).toBe('decimated')
    expect(inDecimated.sig).not.toBe(inLabels.sig)

    expect(at(Math.round(fullH) + 40).sig).toBe(inFull.sig)
    expect(display.fitScale).toBe(1)

    const squeezedA = at(Math.round(bodiesH) - 40)
    const squeezedB = at(Math.round(bodiesH) - 44)
    expect(squeezedA.level).toBe('bodies')
    expect(display.fitScale).toBeLessThan(1)
    expect(squeezedB.sig).not.toBe(squeezedA.sig)
  })

  it('snaps into and within the decimated rung', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('name')
    display.setRpcData(0, mixedWidthRegionData(40), ctgA)
    const labelsH = maxBottom(display.fitLabelsOnlyLayout)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(labelsH).toBeGreaterThan(bodiesH * 1.5)
    display.setHeightMode('fit')

    const at = (h: number) => {
      display.setHeight(Math.round(h))
      return { level: display.fitStage.level, sig: displaySignature(display) }
    }

    const allNames = at(labelsH + 20)
    const decimated = at(bodiesH + (labelsH - bodiesH) * 0.5)
    expect(decimated.level).toBe('decimated')
    expect(display.fitScale).toBe(1)
    expect(display.renderedShowLabels).toBe(true)
    expect(display.renderedShowDescriptions).toBe(false)
    expect(decimated.sig).not.toBe(allNames.sig)

    const looser = at(bodiesH + (labelsH - bodiesH) * 0.8)
    expect(looser.level).toBe('decimated')
    expect(display.fitScale).toBe(1)
    expect(looser.sig).not.toBe(decimated.sig)
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

  it('with descriptions off, the full and labels stages coincide', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('name')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    expect(display.effectiveShowDescriptions).toBe(false)

    const labelsH = maxBottom(display.baseLaidOutDataMap)
    expect(display.fitLabelsOnlyLayout).toBe(display.baseLaidOutDataMap)
    expect(maxBottom(display.fitLabelsOnlyLayout)).toBe(labelsH)
    const bodiesH = maxBottom(display.fitBodiesOnlyLayout)
    expect(labelsH).toBeGreaterThan(bodiesH)

    display.setHeightMode('fit')
    display.setHeight(Math.round((bodiesH + labelsH) / 2))
    expect(display.fitStage.level).toBe('decimated')
    expect(display.renderedShowDescriptions).toBe(false)
    expect(display.renderedShowLabels).toBe(true)
  })

  it('with labels and descriptions off, only a uniform squeeze remains', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('none')
    display.setRpcData(0, labeledStackedRegionData(10, 10), ctgA)
    expect(display.showLabels).toBe(false)

    const h = maxBottom(display.baseLaidOutDataMap)
    expect(display.fitLabelsOnlyLayout).toBe(display.baseLaidOutDataMap)
    expect(display.fitIsoformsSolved).toBe(display.baseLaidOutDataMap)
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

  it('the probed height equals the committed layout height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(60), ctgA)
    display.setHeightMode('fit')
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
    expect(display.fitStage.contentHeight).toBe(
      packedContentHeight(display.rpcDataMap, inputs),
    )
  })

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
    display.setHeight(h + 0.01)
    expect(display.solveLabelRoomFactor(display.fitTargetHeight)).toBe(
      factorBefore,
    )
    expect(display.laidOutDataMap.get(0)).toBe(before)
  })

  it('holds one height probe across a track-height change', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(60), ctgA)
    display.setHeightMode('fit')
    display.setHeight(120)
    // Observed by a reaction so MobX keeps the computed alive between reads,
    // the only state where caching is observable.
    const seen: unknown[] = []
    const dispose = autorun(() => {
      seen.push(display.decimatedHeightProbe)
    })
    display.setHeight(240)
    display.setHeight(240.5)
    dispose()
    expect(seen).toHaveLength(1)
  })

  it('solves to factor 0 when every name already fits', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, mixedWidthRegionData(30), ctgA)
    display.setHeightMode('fit')
    const roomy = maxBottom(display.fitLabelsOnlyLayout) + 500
    expect(display.solveLabelRoomFactor(roomy)).toBe(0)
    expect(display.solveLabelRoomFactor(1)).toBeUndefined()
  })

  it('solves and commits consistently in a reversed region', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    // `reversedRegions` is derived from the region each fetch was loaded
    // with, not from the view, so the flag rides in on setRpcData.
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
    expect(packedContentHeight(display.rpcDataMap, inputs)).toBe(
      maxBottom(computeLaidOutData(display.rpcDataMap, inputs)),
    )
    expect(
      display.fitStage.contentHeight <= display.fitTargetHeight ||
        display.fitStage.level === 'bodies',
    ).toBe(true)
  })

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
      expect(heights.at(-1)!).toBeLessThan(heights[0]!)
    }
  })

  it('counts features the layout could not place', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setHeight(200)
    display.setRpcData(0, stackedRegionData(800, 20), ctgA)

    expect(display.truncatedFeatureCount).toBeGreaterThan(0)
    const placed = 800 - display.truncatedFeatureCount
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
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (const f of feats) {
    floatingLabelsData.set(f.featureId, {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: height,
      nameLabel: {
        text: f.featureId,
        relativeY: 0,
        textWidth: 60,
      },
    })
  }
  return { feats, floatingLabelsData }
}

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
    floatingLabelsData: new Map(),
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
    floatingLabelsData: new Map(groups.flatMap(g => [...g.floatingLabelsData])),
  })
}

describe('canvas display fit measures the visible window', () => {
  function fitOver(offscreenGenes: number, mode: 'fit' | 'fixed' = 'fit') {
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
    display.setHeightMode(mode)
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
      settledMaxY: display.settledMaxY,
      onScreenBottom,
    }
  }

  it('ignores buffered off-screen features when sizing the stack', () => {
    const alone = fitOver(0)
    const buffered = fitOver(10)
    expect(buffered.contentHeight).toBe(alone.contentHeight)
    expect(buffered.scale).toBe(alone.scale)
    expect(buffered.level).toBe(alone.level)
    expect(buffered.onScreenBottom).toBe(alone.onScreenBottom)
    expect(buffered.onScreenBottom).toBeCloseTo(100, 5)
  })

  it('chooses a fixed rung over the window and still draws the buffer', () => {
    const alone = fitOver(0, 'fixed')
    const buffered = fitOver(10, 'fixed')
    expect(buffered.contentHeight).toBe(alone.contentHeight)
    expect(buffered.level).toBe(alone.level)
    expect(buffered.settledMaxY).toBeGreaterThan(buffered.contentHeight)
    expect(alone.settledMaxY).toBe(alone.contentHeight)
  })

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

    view.scrollTo(182_000 / 100)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.fitStage.contentHeight).toBeGreaterThan(before)
  })

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

    expect(display.fitSmallestBoxPx).toBe(20)
    expect(display.fitMinScale).toBeCloseTo(0.1)
    expect(display.fitScale).toBeLessThan(1)
    expect(display.hasOverflow).toBe(false)
  })

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
        stackedGenesAt('left', 62_000, 98_000, 800),
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 60_000, end: 220_000 },
    )
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    display.setHeight(100)

    expect(display.heightMode).toBe('fixed')
    expect(display.truncatedFeatureCount).toBe(0)
    display.setHeightMode('fit')
    expect(display.truncatedFeatureCount).toBe(0)
    display.setHeightMode('grow')
    expect(display.truncatedFeatureCount).toBeGreaterThan(0)
  })

  it('measures the whole stack in grow mode and the window in fixed', () => {
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
    const wholePack = maxBottom(display.baseLaidOutDataMap)

    display.setHeightMode('grow')
    expect(display.fitMeasureFeatureIds).toBeUndefined()
    expect(display.fitStage.contentHeight).toBe(wholePack)

    display.setHeightMode('fixed')
    expect(display.fitMeasureFeatureIds).toBeDefined()
    expect(display.fitStage.contentHeight).toBeLessThan(wholePack)
    expect(display.settledMaxY).toBe(wholePack)
  })
})

describe('canvas display scrolls over the visible window', () => {
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
    display.setHeight(Math.ceil(onScreenBottom) + 10)
    return { display, view, onScreenBottom }
  }

  it('reports no overflow when only the buffer is below the fold', () => {
    const { display } = bufferedStack(12)
    expect(display.maxY).toBeGreaterThan(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
    expect(display.scrollContentHeight).toBe(display.height)
  })

  it('still DRAWS the buffered rows it will not scroll to', () => {
    const { display } = bufferedStack(12)
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

  it('falls back to the whole pack with no coarse blocks', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay(undefined, { unplacedView: true })
    expect(view.coarseDynamicBlocks).toHaveLength(0)
    display.setRpcData(0, stackedRegionData(12, 20), ctgA)
    display.setHeight(97)
    expect(display.onScreenFeatureIds).toBeUndefined()
    expect(display.scrollExtentMaxY).toBe(display.maxY)
    expect(display.hasOverflow).toBe(true)
  })
})

const ISOFORM_GENES = packStackedGenes([
  { featureId: 'gene1', name: 'GENE1', startBp: 100, endBp: 500, isoforms: 4 },
  { featureId: 'gene2', name: 'GENE2', startBp: 450, endBp: 900, isoforms: 10 },
])

const namesOnScreen = (display: TestDisplay) =>
  [...display.laidOutDataMap.values()]
    .flatMap(data => [...data.floatingLabelsData.values()])
    .map(label => label.nameLabel?.text)
    .filter(Boolean)
    .sort()

describe('the isoform rung across the three height modes', () => {
  it('fit keeps both names and trims the crowded gene', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setRpcData(0, ISOFORM_GENES, ctgA)

    expect(display.fitStage.level).toBe('isoforms')
    expect(display.fitStage.maxIsoforms).toBeLessThan(10)
    expect(display.fitStage.contentHeight).toBeLessThanOrEqual(100)
    expect(namesOnScreen(display)).toEqual(['GENE1', 'GENE2'])
  })

  it('fixed trims too, and keeps its descriptions', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, ISOFORM_GENES, ctgA)

    expect(display.heightMode).toBe('fixed')
    expect(display.fitStage.level).toBe('isoforms')
    expect(display.fitStage.maxIsoforms).toBeLessThan(10)
    expect(display.fitStage.scale).toBe(1)
    expect(namesOnScreen(display)).toEqual(['GENE1', 'GENE2'])
  })

  it('fixed leaves the stack whole where no count achieves a fit', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, ISOFORM_GENES, ctgA)
    display.setHeight(20)

    expect(display.heightMode).toBe('fixed')
    expect(display.fitStage.maxIsoforms).toBeUndefined()
    expect(drawnOrdinals(display, 'gene2').size).toBe(10)
    expect(display.hasOverflow).toBe(true)

    display.setHeightMode('fit')
    expect(display.fitStage.maxIsoforms).toBe(1)
    expect(drawnOrdinals(display, 'gene2').size).toBe(1)
  })

  it('trims on the rungs below the isoform one with names off', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('none')
    display.setRpcData(0, ISOFORM_GENES, ctgA)
    display.setHeightMode('fit')
    display.setHeight(20)
    expect(display.showLabels).toBe(false)

    expect(display.fitStage.level).toBe('bodies')
    expect(display.fitStage.maxIsoforms).toBe(1)
    expect(drawnOrdinals(display, 'gene2').size).toBe(1)
  })

  it('does not commit to a count over genes the worker collapsed', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setRpcData(
      0,
      packStackedGenes(
        Array.from({ length: 12 }, (_, i) => ({
          featureId: `gene${i}`,
          name: `GENE${i}`,
          startBp: 100,
          endBp: 900,
          isoforms: 10,
          drawn: 1,
          collapsedIsoformCount: 1,
        })),
      ),
      ctgA,
    )

    expect(display.fitStage.level).not.toBe('full')
    expect(display.fitStage.maxIsoforms).toBeUndefined()
    expect(display.geneGlyphIsoformCap).toBeUndefined()
    expect(drawnOrdinals(display, 'gene0').size).toBe(1)
  })

  it('grow never trims', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('grow')
    display.setRpcData(0, ISOFORM_GENES, ctgA)

    expect(display.fitStage.level).toBe('full')
    expect(display.fitStage.maxIsoforms).toBeUndefined()
    expect(display.height).toBeGreaterThan(100)
  })

  const EXPANDED_GENES = packStackedGenes([
    {
      featureId: 'gene1',
      name: 'GENE1',
      startBp: 100,
      endBp: 500,
      isoforms: 4,
    },
    {
      featureId: 'gene2',
      name: 'GENE2',
      startBp: 450,
      endBp: 900,
      isoforms: 10,
      collapsedIsoformCount: 1,
    },
  ])

  const drawnOrdinals = (display: TestDisplay, featureId: string) => {
    const data = [...display.laidOutDataMap.values()][0]!
    const idx = data.flatbushItems.findIndex(i => i.featureId === featureId)
    const ordinals = new Set<number>()
    for (const [i, feature] of data.rectFeatureIndices.entries()) {
      if (feature === idx) {
        ordinals.add(data.rectChildOrdinals[i]!)
      }
    }
    return ordinals
  }

  it.each(['fit', 'fixed', 'grow'] as const)(
    'leaves an expanded gene whole in %s mode',
    mode => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      display.setHeightMode(mode)
      display.toggleExpandedGene('gene2')
      display.setRpcData(0, EXPANDED_GENES, ctgA)

      expect(drawnOrdinals(display, 'gene2').size).toBe(10)
      expect(display.geneGlyphTrimmedGenes.has('gene2')).toBe(false)
    },
  )

  it('still honours the collapse on a gene nobody opened', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setRpcData(0, EXPANDED_GENES, ctgA)

    expect(drawnOrdinals(display, 'gene2').size).toBe(1)
  })

  it.each(['fit', 'fixed'] as const)(
    'All transcripts withholds the rung in %s mode',
    mode => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      display.setHeightMode(mode)
      display.setGeneGlyphMode('all')
      display.setRpcData(0, ISOFORM_GENES, ctgA)

      expect(display.fitStage.maxIsoforms).toBeUndefined()
      expect(display.fitStage.level).not.toBe('isoforms')
      expect(drawnOrdinals(display, 'gene2').size).toBe(10)
      expect(display.geneGlyphTrimmedGenes.size).toBe(0)
    },
  )
})
