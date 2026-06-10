import { forEachRenderedLabel } from './labelPositioning.ts'

import type { LabelVisibility, ResolvedLabel } from './labelPositioning.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/core/gpu/renderBlock'

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

function collect(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: LabelVisibility,
) {
  const out: { featureId: string; labels: ResolvedLabel[] }[] = []
  forEachRenderedLabel(data, vr, visibility, (featureId, labels) => {
    out.push({ featureId, labels })
  })
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
    expect(emitted!.labels[1]!.label.relativeY).toBe(12)
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
          tooltip: '',
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
})
