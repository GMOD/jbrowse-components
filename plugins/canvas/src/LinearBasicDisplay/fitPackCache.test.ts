import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createPackHeightCache, createPackHeightProbe } from './layout.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'
import type * as Layout from './layout.ts'
import type {
  LayoutInputs,
  LayoutRegionData,
  PackKnobs,
} from './layoutInputs.ts'
import type * as PackRef from './packRef.ts'

const mockPackCount = { value: 0 }
// A display built while this is set holds caches that never hand a pack
// back: the answer the cached solve must reproduce.
const mockUncached = { value: false }

jest.mock('./packRef.ts', () => {
  const actual = jest.requireActual<typeof PackRef>('./packRef.ts')
  return {
    ...actual,
    packPreparedRef: (...args: Parameters<typeof actual.packPreparedRef>) => {
      mockPackCount.value++
      return actual.packPreparedRef(...args)
    },
  }
})

jest.mock('./layout.ts', () => {
  const actual = jest.requireActual<typeof Layout>('./layout.ts')
  return {
    ...actual,
    createPackHeightCache: () =>
      mockUncached.value ? () => new Map() : actual.createPackHeightCache(),
  }
})

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function labelled(
  starts: number[],
  length: number,
  heightAt: (i: number) => number,
) {
  const features = starts.map((startBp, i) => ({
    featureId: `f${i}`,
    startBp,
    endBp: startBp + length,
    height: heightAt(i),
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
    floatingLabelsData: new Map(
      features.map(f => [
        f.featureId,
        {
          featureId: f.featureId,
          minX: f.startBp,
          maxX: f.endBp,
          topY: 0,
          featureHeight: f.height,
          nameLabel: { text: f.featureId, relativeY: 0, textWidth: 40 },
        },
      ]),
    ),
  })
}

const spaced = (n: number, spacing: number) =>
  Array.from({ length: n }, (_, i) => i * spacing)

// Gaps that vary, so the decimation keeps some names and drops others.
function unevenlySpaced(n: number) {
  const starts: number[] = []
  let pos = 0
  for (let i = 0; i < n; i++) {
    starts.push(pos)
    pos += 6 + ((i * 7) % 23)
  }
  return starts
}

// Bodies grow taller to the right, so a pan moves the labelled body floor and
// with it the body scale every labelled rung packs at.
const taller = (per: number) => (i: number) => 8 + 2 * Math.floor(i / per)

function fitDisplay(data: FeatureDataResult, height?: number) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRpcData(0, data, ctgA)
  if (height !== undefined) {
    display.setHeight(height)
  }
  const dispose = autorun(() => void display.renderDataMap)
  return { display, view, dispose }
}

function uncachedFitDisplay(data: FeatureDataResult, height?: number) {
  mockUncached.value = true
  try {
    return fitDisplay(data, height)
  } finally {
    mockUncached.value = false
  }
}

function settle(view: ReturnType<typeof fitDisplay>['view'], px: number) {
  view.scrollTo(view.offsetPx + px)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
}

const answer = ({
  level,
  scale,
  bodyScale,
  maxIsoforms,
  contentHeight,
}: FitStage) => ({ level, scale, bodyScale, maxIsoforms, contentHeight })

describe('the fit solve across settles of the view', () => {
  it('packs nothing on a settle that moves only the on-screen set', () => {
    const data = labelled(spaced(1500, 6), 60, () => 10)
    const cached = fitDisplay(data)
    const uncached = uncachedFitDisplay(data)
    const before = cached.display.onScreenFeatureIds!

    const packsOnSettle = (d: typeof cached) => {
      mockPackCount.value = 0
      settle(d.view, 30)
      void d.display.fitStage
      return mockPackCount.value
    }
    const cachedPacks = packsOnSettle(cached)
    const uncachedPacks = packsOnSettle(uncached)

    const after = cached.display.onScreenFeatureIds!
    expect([...after].some(id => !before.has(id))).toBe(true)
    expect(cached.display.fitStage.level).toBe('bodies')
    expect(uncachedPacks).toBeGreaterThan(0)
    expect(cachedPacks).toBe(0)
    expect(answer(cached.display.fitStage)).toEqual(
      answer(uncached.display.fitStage),
    )
    cached.dispose()
    uncached.dispose()
  })

  for (const [level, data, height] of [
    ['thinned', () => labelled(spaced(500, 20), 60, taller(25)), 108],
    ['decimated', () => labelled(unevenlySpaced(400), 5, taller(40)), 60],
    ['bodies', () => labelled(spaced(1500, 6), 60, taller(70)), undefined],
  ] as const) {
    it(`resolves the ${level} rung as an uncached solve does`, () => {
      const cached = fitDisplay(data(), height)
      const uncached = uncachedFitDisplay(data(), height)
      const levels = new Set<string>()
      const floors = new Set<number>()
      for (let i = 0; i < 8; i++) {
        settle(cached.view, 150)
        settle(uncached.view, 150)
        expect(answer(cached.display.fitStage)).toEqual(
          answer(uncached.display.fitStage),
        )
        levels.add(cached.display.fitStage.level)
        floors.add(cached.display.fitLabeledBodyFloor)
      }
      expect(levels).toContain(level)
      expect(floors.size).toBeGreaterThan(1)
      cached.dispose()
      uncached.dispose()
    })
  }
})

describe('the pack cache', () => {
  // Crowded genes and non-genes with three isoforms each, so every knob moves
  // the stack's height.
  function crowdedGenes(n: number): ReadonlyMap<number, LayoutRegionData> {
    const genes = packStackedGenes(
      spaced(n, 12).map((startBp, i) => ({
        featureId: `g${i}`,
        name: `gene${i}`,
        startBp,
        endBp: startBp + 8,
        isoforms: 3,
      })),
    )
    return new Map([
      [
        0,
        {
          ...genes,
          regionKey: 'volvox:ctgA',
          flatbushItems: genes.flatbushItems.map((item, i) => ({
            ...item,
            gene: i % 2 === 0,
          })),
        },
      ],
    ])
  }
  const rpcDataMap = crowdedGenes(24)
  const inputs: LayoutInputs = {
    bpPerPx: 1,
    showLabels: true,
    showDescriptions: false,
    reversedRegions: new Set<number>(),
    displayMode: 'normal',
    pinnedFeatureIds: new Set<string>(),
    labelDecimation: 'fitWidth',
  }
  const start: PackKnobs = {
    bodyScale: 1,
    maxIsoformsPerGene: undefined,
    labelRoomFactor: 0,
    geneLabelRoomFactor: undefined,
  }
  const uncachedHeight = (
    knobs: PackKnobs,
    data = rpcDataMap,
    config: LayoutInputs = inputs,
  ) => createPackHeightProbe(data, config, undefined)(knobs)

  for (const [knob, value] of [
    ['bodyScale', 0.5],
    ['maxIsoformsPerGene', 1],
    ['labelRoomFactor', 8],
    ['geneLabelRoomFactor', 8],
  ] as const) {
    it(`keys a pack on ${knob}`, () => {
      const moved = { ...start, [knob]: value }
      expect(uncachedHeight(moved)).not.toBe(uncachedHeight(start))

      const cache = createPackHeightCache()
      createPackHeightProbe(rpcDataMap, inputs, undefined, cache)(start)
      expect(
        createPackHeightProbe(rpcDataMap, inputs, undefined, cache)(moved),
      ).toBe(uncachedHeight(moved))
    })
  }

  for (const [change, data, config] of [
    ['the data', crowdedGenes(2), inputs],
    ['showLabels', rpcDataMap, { ...inputs, showLabels: false }],
    ['displayMode', rpcDataMap, { ...inputs, displayMode: 'compact' }],
    ['bpPerPx', rpcDataMap, { ...inputs, bpPerPx: 4 }],
  ] as const) {
    it(`drops its packs when ${change} changes`, () => {
      expect(uncachedHeight(start, data, config)).not.toBe(
        uncachedHeight(start),
      )

      const cache = createPackHeightCache()
      createPackHeightProbe(rpcDataMap, inputs, undefined, cache)(start)
      expect(createPackHeightProbe(data, config, undefined, cache)(start)).toBe(
        uncachedHeight(start, data, config),
      )
    })
  }
})
