import {
  isOverlayMode,
  isScatterMode,
  renderingTypeToInt,
  getRowHeight,
  getRowTop,
  makeWhiskersSourceData,
} from './wiggleComponentUtils.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from './wiggleShader.ts'

describe('isOverlayMode', () => {
  test('overlay types return true', () => {
    expect(isOverlayMode('xyplot')).toBe(true)
    expect(isOverlayMode('line')).toBe(true)
    expect(isOverlayMode('scatter')).toBe(true)
  })

  test('multirow types return false', () => {
    expect(isOverlayMode('multirowxy')).toBe(false)
    expect(isOverlayMode('multirowdensity')).toBe(false)
    expect(isOverlayMode('multirowline')).toBe(false)
    expect(isOverlayMode('multirowscatter')).toBe(false)
  })

  test('density is not an overlay type', () => {
    expect(isOverlayMode('density')).toBe(false)
  })
})

describe('isScatterMode', () => {
  test('scatter types return true', () => {
    expect(isScatterMode('scatter')).toBe(true)
    expect(isScatterMode('multirowscatter')).toBe(true)
  })

  test('non-scatter types return false', () => {
    expect(isScatterMode('xyplot')).toBe(false)
    expect(isScatterMode('line')).toBe(false)
    expect(isScatterMode('multirowxy')).toBe(false)
  })
})

describe('renderingTypeToInt', () => {
  test('overlay and multirow variants map to same int', () => {
    expect(renderingTypeToInt('xyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('multirowxy')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('line')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('multirowline')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('scatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('multirowscatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('density')).toBe(RENDERING_TYPE_DENSITY)
    expect(renderingTypeToInt('multirowdensity')).toBe(RENDERING_TYPE_DENSITY)
  })

  test('unknown types default to xyplot', () => {
    expect(renderingTypeToInt('unknown')).toBe(RENDERING_TYPE_XYPLOT)
  })
})

describe('getRowHeight', () => {
  test('divides canvas height by number of rows', () => {
    expect(getRowHeight(200, 4)).toBe(50)
  })

  test('returns full height for 0 rows', () => {
    expect(getRowHeight(200, 0)).toBe(200)
  })

  test('returns full height for 1 row', () => {
    expect(getRowHeight(200, 1)).toBe(200)
  })
})

describe('getRowTop', () => {
  test('computes row offset', () => {
    expect(getRowTop(0, 50)).toBe(0)
    expect(getRowTop(1, 50)).toBe(50)
    expect(getRowTop(3, 50)).toBe(150)
  })
})

describe('makeWhiskersSourceData', () => {
  const positions = new Uint32Array([0, 10, 10, 20])
  const scores = new Float32Array([5, 8])
  const minScores = new Float32Array([2, 4])
  const maxScores = new Float32Array([9, 12])
  const color: [number, number, number] = [0.2, 0.4, 0.8]

  test('returns 3 layers (max, avg, min) when summary data present', () => {
    const result = makeWhiskersSourceData(
      {
        featurePositions: positions,
        featureScores: scores,
        featureMinScores: minScores,
        featureMaxScores: maxScores,
        numFeatures: 2,
      },
      color,
      false,
      false,
      3,
    )
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(maxScores)
    expect(result[1]!.featureScores).toBe(scores)
    expect(result[2]!.featureScores).toBe(minScores)
    expect(result[0]!.rowIndex).toBe(3)
  })

  test('returns single layer when no summary variation', () => {
    const result = makeWhiskersSourceData(
      {
        featurePositions: positions,
        featureScores: scores,
        featureMinScores: scores,
        featureMaxScores: scores,
        numFeatures: 2,
      },
      color,
      false,
      false,
      0,
    )
    expect(result).toHaveLength(1)
  })

  test('returns single layer in density mode', () => {
    const result = makeWhiskersSourceData(
      {
        featurePositions: positions,
        featureScores: scores,
        featureMinScores: minScores,
        featureMaxScores: maxScores,
        numFeatures: 2,
      },
      color,
      true,
      false,
      0,
    )
    expect(result).toHaveLength(1)
  })

  test('reverses order in scatter mode', () => {
    const result = makeWhiskersSourceData(
      {
        featurePositions: positions,
        featureScores: scores,
        featureMinScores: minScores,
        featureMaxScores: maxScores,
        numFeatures: 2,
      },
      color,
      false,
      true,
      0,
    )
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(minScores)
    expect(result[2]!.featureScores).toBe(maxScores)
  })

  test('all layers share the same rowIndex', () => {
    const result = makeWhiskersSourceData(
      {
        featurePositions: positions,
        featureScores: scores,
        featureMinScores: minScores,
        featureMaxScores: maxScores,
        numFeatures: 2,
      },
      color,
      false,
      false,
      5,
    )
    for (const layer of result) {
      expect(layer.rowIndex).toBe(5)
    }
  })
})
