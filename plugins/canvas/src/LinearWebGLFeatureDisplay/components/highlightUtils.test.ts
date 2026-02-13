import { measureText } from '@jbrowse/core/util'

import { computeLabelExtraWidth } from './highlightUtils.ts'

import type { FeatureLabelData } from '../../RenderWebGLFeatureDataRPC/rpcTypes.ts'

function makeLabelData(
  texts: string[],
  overrides?: Partial<FeatureLabelData>,
): FeatureLabelData {
  return {
    featureId: 'feat1',
    minX: 0,
    maxX: 100,
    topY: 0,
    featureHeight: 10,
    floatingLabels: texts.map(text => ({
      text,
      relativeY: 0,
      color: 'black',
      textWidth: measureText(text, 11),
    })),
    ...overrides,
  }
}

describe('computeLabelExtraWidth', () => {
  test('returns positive extra width when label is wider than feature', () => {
    const labelData = makeLabelData(['BRCA1_longGeneName'])
    const labelWidth = measureText('BRCA1_longGeneName', 11)
    const featureWidthPx = 2
    const result = computeLabelExtraWidth(labelData, featureWidthPx)
    expect(result).toBeCloseTo(labelWidth - featureWidthPx)
    expect(result).toBeGreaterThan(0)
  })

  test('returns 0 when feature is wider than label', () => {
    const labelData = makeLabelData(['A'])
    const result = computeLabelExtraWidth(labelData, 500)
    expect(result).toBe(0)
  })

  test('returns 0 when there are no labels', () => {
    const labelData = makeLabelData([])
    const result = computeLabelExtraWidth(labelData, 2)
    expect(result).toBe(0)
  })

  test('uses widest label when multiple labels exist', () => {
    const labelData = makeLabelData(['X', 'LongLabelText_description'])
    const featureWidthPx = 5
    const widestLabelWidth = measureText('LongLabelText_description', 11)
    const result = computeLabelExtraWidth(labelData, featureWidthPx)
    expect(result).toBeCloseTo(widestLabelWidth - featureWidthPx)
  })

  test('SNP-like feature (1bp, very narrow) gets large extra width', () => {
    const labelData = makeLabelData(['rs12345'])
    const snpWidthPx = 0.5
    const labelWidth = measureText('rs12345', 11)
    const result = computeLabelExtraWidth(labelData, snpWidthPx)
    expect(result).toBeCloseTo(labelWidth - snpWidthPx)
    expect(result).toBeGreaterThan(labelWidth - 1)
  })
})
