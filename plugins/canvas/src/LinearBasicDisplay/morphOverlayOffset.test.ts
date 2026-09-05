import {
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function regionWith(featureIds: string[]): FeatureDataResult {
  const spans = featureIds.map((_, i) => ({
    startBp: i * 1000,
    endBp: i * 1000 + 500,
  }))
  return makeFeatureData({
    ...packFixtureRects(spans),
    flatbushItems: featureIds.map((featureId, i) =>
      makeFlatbushItem({ featureId, ...spans[i]!, topPx: 0, bottomPx: 10 }),
    ),
    subfeatureInfos: featureIds.map((featureId, i) =>
      makeSubfeatureInfo({
        featureId: `${featureId}-sub`,
        parentFeatureId: featureId,
        ...spans[i]!,
      }),
    ),
    featureCount: featureIds.length,
  })
}

function setUp(featureIds: string[]) {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, regionWith(featureIds), REGION)
  return display
}

function drawnRectY(
  display: ReturnType<typeof setUp>,
  featureId: string,
  map: ReadonlyMap<number, FeatureDataResult>,
) {
  for (const data of map.values()) {
    const idx = data.flatbushItems.findIndex(f => f.featureId === featureId)
    if (idx >= 0) {
      const rect = data.rectFeatureIndices.indexOf(idx)
      return data.rectYs[rect]!
    }
  }
  throw new Error(`no rect for ${featureId}`)
}

describe('morphOffsetFor', () => {
  it('is zero with no morph in flight, and once one settles', () => {
    const display = setUp(['f1'])
    expect(display.morphOffsetFor('f1')).toBe(0)

    display.beginYMorph(new Map([['f1', 60]]), display.settledMaxY + 60)
    display.setMorphProgress(0.5)
    expect(display.morphOffsetFor('f1')).not.toBe(0)

    display.endYMorph()
    expect(display.morphOffsetFor('f1')).toBe(0)
  })

  it('tracks the drawn glyph frame for frame', () => {
    const display = setUp(['f1', 'f2'])
    const settledY = drawnRectY(display, 'f1', display.laidOutDataMap)

    display.beginYMorph(
      new Map([['f1', settledY + 60]]),
      display.settledMaxY + 60,
    )
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      display.setMorphProgress(progress)
      expect(display.morphOffsetFor('f1')).toBeCloseTo(
        drawnRectY(display, 'f1', display.renderDataMap) - settledY,
      )
      expect(display.morphOffsetFor('f2')).toBe(0)
    }
    display.setMorphProgress(0.5)
    expect(display.morphOffsetFor('f1')).toBeCloseTo(30)
  })

  it('gives a subfeature its parent feature offset', () => {
    const display = setUp(['f1'])
    const settledY = drawnRectY(display, 'f1', display.laidOutDataMap)
    display.beginYMorph(
      new Map([['f1', settledY + 60]]),
      display.settledMaxY + 60,
    )
    display.setMorphProgress(0.5)

    expect(display.subfeatureIdIndex.has('f1-sub')).toBe(true)
    expect(display.morphOffsetFor('f1-sub')).toBe(display.morphOffsetFor('f1'))
  })

  it('is zero for an id that is not laid out', () => {
    const display = setUp(['f1'])
    display.beginYMorph(new Map([['f1', 60]]), display.settledMaxY + 60)
    display.setMorphProgress(0.5)
    expect(display.morphOffsetFor('nonexistent')).toBe(0)
  })

  it('survives being destructured off the model', () => {
    const display = setUp(['f1'])
    const settledY = drawnRectY(display, 'f1', display.laidOutDataMap)
    display.beginYMorph(
      new Map([['f1', settledY + 60]]),
      display.settledMaxY + 60,
    )
    display.setMorphProgress(0.5)

    const { morphOffsetFor, searchFeatureByID } = display
    expect(morphOffsetFor('f1')).toBeCloseTo(30)
    expect(searchFeatureByID('f1')).toBeDefined()
  })
})
