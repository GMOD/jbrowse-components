import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  getRowHeight,
  getRowTop,
  hitTestMouse,
  isOverlayMode,
  isScatterMode,
  legendRightEdgePx,
  makeWhiskersLayers,
  renderingTypeToInt,
} from './wiggleComponentUtils.ts'

describe('isOverlayMode', () => {
  test('overlay types return true', () => {
    expect(isOverlayMode('multixyplot')).toBe(true)
    expect(isOverlayMode('multiline')).toBe(true)
    expect(isOverlayMode('multiscatter')).toBe(true)
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
    expect(isScatterMode('multirowscatter')).toBe(true)
    expect(isScatterMode('multiscatter')).toBe(true)
  })

  test('non-scatter types return false', () => {
    expect(isScatterMode('multixyplot')).toBe(false)
    expect(isScatterMode('multiline')).toBe(false)
    expect(isScatterMode('multirowxy')).toBe(false)
  })
})

describe('renderingTypeToInt', () => {
  test('single-wiggle variants map correctly', () => {
    expect(renderingTypeToInt('xyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('density')).toBe(RENDERING_TYPE_DENSITY)
    expect(renderingTypeToInt('line')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('scatter')).toBe(RENDERING_TYPE_SCATTER)
  })

  test('multi-wiggle variants map to same int', () => {
    expect(renderingTypeToInt('multirowxy')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('multixyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('multirowline')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('multiline')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('multirowscatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('multiscatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('multirowdensity')).toBe(RENDERING_TYPE_DENSITY)
  })

  test('unknown types throw', () => {
    expect(() => renderingTypeToInt('unknown')).toThrow(
      /Unknown wiggle rendering type/,
    )
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

describe('legendRightEdgePx', () => {
  test('pins to the last visible content block, off a trailing padding block', () => {
    // whole-genome view: content ends at 1400 but the track is 1500 wide (the
    // trailing 100px is a region-separator/elided PaddingBlock that would mask a
    // 1500-pinned legend)
    const regions = [{ screenEndPx: 700 }, { screenEndPx: 1400 }]
    expect(legendRightEdgePx(regions, 1500)).toBe(1400)
  })

  test('clamps to the track width when content overflows (scrolled/zoomed in)', () => {
    expect(legendRightEdgePx([{ screenEndPx: 3000 }], 1500)).toBe(1500)
  })

  test('falls back to the track width with no visible regions', () => {
    expect(legendRightEdgePx([], 1500)).toBe(1500)
  })
})

describe('makeWhiskersLayers', () => {
  const positions = new Uint32Array([0, 10, 10, 20])
  const scores = new Float32Array([5, 8])
  const minScores = new Float32Array([2, 4])
  const maxScores = new Float32Array([9, 12])
  const color: [number, number, number] = [0.2, 0.4, 0.8]

  const summaryData = {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: minScores,
    featureMaxScores: maxScores,
    numFeatures: 2,
    hasSummaryScores: true,
  }

  const noSummaryData = {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: scores,
    featureMaxScores: scores,
    numFeatures: 2,
    hasSummaryScores: false,
  }

  test('returns 3 layers (max, avg, min) when summary data present', () => {
    const result = makeWhiskersLayers({
      data: summaryData,
      color,
      isDensityMode: false,
      isScatter: false,
    })
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(maxScores)
    expect(result[1]!.featureScores).toBe(scores)
    expect(result[2]!.featureScores).toBe(minScores)
  })

  test('returns single layer when no summary variation', () => {
    const result = makeWhiskersLayers({
      data: noSummaryData,
      color,
      isDensityMode: false,
      isScatter: false,
    })
    expect(result).toHaveLength(1)
  })

  test('returns single layer in density mode', () => {
    const result = makeWhiskersLayers({
      data: summaryData,
      color,
      isDensityMode: true,
      isScatter: false,
    })
    expect(result).toHaveLength(1)
  })

  test('reverses order in scatter mode', () => {
    const result = makeWhiskersLayers({
      data: summaryData,
      color,
      isDensityMode: false,
      isScatter: true,
    })
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(minScores)
    expect(result[2]!.featureScores).toBe(maxScores)
  })
})

describe('hitTestMouse', () => {
  // 100px of screen over 10bp → 10px per base, so each base's pixels are
  // unambiguous and an off-by-half-base shows up directly.
  const region = {
    refName: 'chr1',
    screenStartPx: 0,
    screenEndPx: 100,
    start: 1000,
    end: 1010,
    displayedRegionIndex: 0,
  }
  const data = new Map([[0, 'data']])

  test('returns undefined outside any region', () => {
    expect(hitTestMouse([region], data, -1)).toBeUndefined()
    expect(hitTestMouse([region], data, 100)).toBeUndefined()
  })

  test('returns undefined when the region has no data loaded', () => {
    expect(hitTestMouse([region], new Map(), 50)).toBeUndefined()
  })

  test('reports the base under the cursor across its whole pixel span', () => {
    // Every pixel of base 1000's 10px span reports 1000 — including the right
    // half, which a round() mapping would push onto 1001.
    expect(hitTestMouse([region], data, 0)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 4)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 5)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 9)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 10)?.bp).toBe(1001)
  })

  test('never reports the exclusive region end', () => {
    expect(hitTestMouse([region], data, 99)?.bp).toBe(1009)
  })

  test('reversed regions run right to left', () => {
    const rev = { ...region, reversed: true }
    // Leftmost pixel is the region's last base, not its exclusive end.
    expect(hitTestMouse([rev], data, 0)?.bp).toBe(1009)
    expect(hitTestMouse([rev], data, 9)?.bp).toBe(1009)
    expect(hitTestMouse([rev], data, 10)?.bp).toBe(1008)
    expect(hitTestMouse([rev], data, 99)?.bp).toBe(1000)
  })

  test('picks the region containing x and returns its data', () => {
    const second = {
      ...region,
      screenStartPx: 100,
      screenEndPx: 200,
      start: 2000,
      end: 2010,
      displayedRegionIndex: 1,
    }
    const map = new Map([
      [0, 'first'],
      [1, 'second'],
    ])
    const hit = hitTestMouse([region, second], map, 150)
    expect(hit?.data).toBe('second')
    expect(hit?.bp).toBe(2005)
  })
})
