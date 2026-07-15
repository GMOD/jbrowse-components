import {
  LABEL_CULL_BUCKET_PX,
  forEachDisplayLabel,
  forEachRenderedLabel,
  labelCullBand,
} from './labelPositioning.ts'

import type {
  LabelCullBand,
  RegionWithData,
  ResolvedLabel,
} from './labelPositioning.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

function makeLabel(overrides: Partial<LabelItem> = {}): LabelItem {
  return {
    text: 'NAME',
    relativeY: 4,
    color: 'black',
    textWidth: 30,
    ...overrides,
  }
}

function makeLabelData(
  featureId: string,
  overrides: Partial<FeatureLabelData> = {},
): FeatureLabelData {
  return {
    featureId,
    minX: 100,
    maxX: 200,
    topY: 0,
    featureHeight: 10,
    ...overrides,
  }
}

function makeData(labels: Record<string, FeatureLabelData>): FeatureDataResult {
  return { floatingLabelsData: labels } as FeatureDataResult
}

const FULL_REGION: BpRegionBounds = {
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
}

const LABEL_FONT = 11

function collect(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: { showLabels: boolean; showDescriptions: boolean },
  cullBand?: LabelCullBand,
) {
  const out: { featureId: string; labels: ResolvedLabel[] }[] = []
  forEachRenderedLabel(
    data,
    vr,
    { ...visibility, fontSize: LABEL_FONT },
    (featureId, labels) => {
      out.push({ featureId, labels })
    },
    undefined,
    cullBand,
  )
  return out
}

describe('forEachRenderedLabel', () => {
  test('skips features whose bp span is outside the region', () => {
    const data = makeData({
      f1: makeLabelData('f1', { minX: 600, maxX: 700 }),
    })
    const result = collect(
      data,
      { ...FULL_REGION, start: 0, end: 500 },
      { showLabels: true, showDescriptions: true },
    )
    expect(result).toHaveLength(0)
  })

  test('does not emit when no labels would render', () => {
    const data = makeData({
      f1: makeLabelData('f1', { nameLabel: makeLabel() }),
    })
    const result = collect(data, FULL_REGION, {
      showLabels: false,
      showDescriptions: false,
    })
    expect(result).toHaveLength(0)
  })

  test('emits name + description with original relativeY when both shown', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel({ text: 'name' }),
        descriptionLabel: makeLabel({ text: 'desc', relativeY: 12 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels.map(l => l.kind)).toEqual(['name', 'desc'])
    // description sits one label-line (the context font size) below the name,
    // regardless of the worker-supplied relativeY
    expect(emitted!.labels[1]!.label.relativeY).toBe(LABEL_FONT)
  })

  test('collapses description relativeY to 0 when name is hidden', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel({ text: 'name' }),
        descriptionLabel: makeLabel({ text: 'desc', relativeY: 12 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: false,
      showDescriptions: true,
    })
    expect(emitted!.labels.map(l => l.kind)).toEqual(['desc'])
    expect(emitted!.labels[0]!.label.relativeY).toBe(0)
  })

  test('does not mutate the source descriptionLabel when collapsing', () => {
    const description = makeLabel({ text: 'desc', relativeY: 12 })
    const data = makeData({
      f1: makeLabelData('f1', {
        descriptionLabel: description,
      }),
    })
    collect(data, FULL_REGION, { showLabels: false, showDescriptions: true })
    expect(description.relativeY).toBe(12)
  })

  test('passes through subfeature label with isOverlay flag', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        subfeatureLabel: {
          ...makeLabel({ text: 'sub' }),
          isOverlay: true,
        },
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels[0]!.kind).toBe('sub')
    expect(emitted!.labels[0]!.label.isOverlay).toBe(true)
  })

  test('left-aligns labels wider than the feature', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: 100,
        maxX: 110,
        nameLabel: makeLabel({ textWidth: 500 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels[0]!.labelX).toBe(100)
  })

  test('clamps left edge of label to screenStartPx when feature starts off-screen', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: 0,
        maxX: 500,
        nameLabel: makeLabel({ textWidth: 30 }),
      }),
    })
    const [emitted] = collect(
      data,
      { ...FULL_REGION, screenStartPx: 50 },
      { showLabels: true, showDescriptions: true },
    )
    expect(emitted!.labels[0]!.labelX).toBeGreaterThanOrEqual(50)
  })

  test('culls a feature whose row is outside the cull band', () => {
    const data = makeData({
      near: makeLabelData('near', {
        topY: 100,
        nameLabel: makeLabel({ text: 'near' }),
      }),
      far: makeLabelData('far', {
        topY: 5000,
        nameLabel: makeLabel({ text: 'far' }),
      }),
    })
    const result = collect(
      data,
      FULL_REGION,
      { showLabels: true, showDescriptions: true },
      { top: 0, bottom: 400 },
    )
    expect(result.map(r => r.featureId)).toEqual(['near'])
  })

  test('keeps a feature within the cull band', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        topY: 300,
        nameLabel: makeLabel(),
      }),
    })
    const result = collect(
      data,
      FULL_REGION,
      { showLabels: true, showDescriptions: true },
      { top: 200, bottom: 700 },
    )
    expect(result).toHaveLength(1)
  })
})

describe('labelCullBand', () => {
  test('spans one bucket of margin on each side of the viewport', () => {
    const band = labelCullBand(0, 800)
    expect(band.top).toBe(-LABEL_CULL_BUCKET_PX)
    expect(band.bottom).toBe(800 + 2 * LABEL_CULL_BUCKET_PX)
  })

  test('covers the visible viewport for every scrollTop within a bucket', () => {
    const viewportHeight = 700
    const bucket = 3
    const band = labelCullBand(bucket, viewportHeight)
    // extremes of scrollTop that still map to this bucket
    const minScroll = bucket * LABEL_CULL_BUCKET_PX
    const maxScroll = (bucket + 1) * LABEL_CULL_BUCKET_PX
    expect(band.top).toBeLessThanOrEqual(minScroll)
    expect(band.bottom).toBeGreaterThanOrEqual(maxScroll + viewportHeight)
  })
})

describe('forEachDisplayLabel', () => {
  function regionWithData(displayedRegionIndex: number): RegionWithData {
    return { ...FULL_REGION, displayedRegionIndex }
  }

  test('emits a feature label once when it spans back-to-back regions', () => {
    // A collapsed-intron feature is laid out into both regions' data; its
    // label must be emitted a single time (the SVG-export duplication bug).
    const spanning = { f1: makeLabelData('f1', { nameLabel: makeLabel() }) }
    const laidOutDataMap = new Map([
      [0, makeData(spanning)],
      [1, makeData(spanning)],
    ])
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0), regionWithData(1)],
      laidOutDataMap,
      { showLabels: true, showDescriptions: true, fontSize: LABEL_FONT },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted).toEqual(['f1'])
  })

  test('still emits distinct features from different regions', () => {
    const laidOutDataMap = new Map([
      [0, makeData({ f1: makeLabelData('f1', { nameLabel: makeLabel() }) })],
      [1, makeData({ f2: makeLabelData('f2', { nameLabel: makeLabel() }) })],
    ])
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0), regionWithData(1)],
      laidOutDataMap,
      { showLabels: true, showDescriptions: true, fontSize: LABEL_FONT },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted.sort()).toEqual(['f1', 'f2'])
  })

  // Fit's `bodies` level hides labels upstream (model.renderedShowLabels /
  // renderedShowDescriptions both false), so the walker simply emits nothing.
  test('emits nothing when the caller has hidden every label kind', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel(),
        descriptionLabel: makeLabel({ text: 'desc' }),
      }),
    })
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0)],
      new Map([[0, data]]),
      { showLabels: false, showDescriptions: false, fontSize: LABEL_FONT },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted).toEqual([])
  })
})
