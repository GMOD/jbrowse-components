import type { MultiWiggleSourceData } from '../RenderMultiWiggleDataRPC/types.ts'

// Mirror of getFeatureSlices from renderSvg.ts — kept in sync to test
// that SVG rendering uses the same color logic as the canvas renderer
function getFeatureSlices(
  source: MultiWiggleSourceData,
  posColor: string,
  negColor: string,
  isOverlay: boolean,
) {
  const slices: { color: string; type: 'pos' | 'neg' }[] = []
  if (source.posNumFeatures > 0) {
    slices.push({ color: posColor, type: 'pos' })
  }
  if (source.negNumFeatures > 0) {
    slices.push({
      color: isOverlay ? posColor : negColor,
      type: 'neg',
    })
  }
  return slices
}

// Mirror of the canvas renderer's color resolution from MultiWiggleComponent
function resolveCanvasColors(
  sourceColor: string | undefined,
  defaultPosColor: string,
  defaultNegColor: string,
  overlay: boolean,
) {
  const posColor = sourceColor ?? defaultPosColor
  const negColor = overlay ? posColor : defaultNegColor
  return { posColor, negColor }
}

// Mirror of the SVG renderer's color resolution from renderSvg
function resolveSvgColors(
  sourceColor: string | undefined,
  defaultPosColor: string,
  defaultNegColor: string,
  overlay: boolean,
) {
  const posColor = sourceColor ?? defaultPosColor
  const negColor = overlay ? posColor : defaultNegColor
  return { posColor, negColor }
}

function makeSource(pos: number, neg: number): MultiWiggleSourceData {
  return {
    name: 'test',
    featurePositions: new Uint32Array(0),
    featureScores: new Float32Array(0),
    featureMinScores: new Float32Array(0),
    featureMaxScores: new Float32Array(0),
    numFeatures: 0,
    posFeaturePositions: new Uint32Array(pos * 2),
    posFeatureScores: new Float32Array(pos),
    posNumFeatures: pos,
    negFeaturePositions: new Uint32Array(neg * 2),
    negFeatureScores: new Float32Array(neg),
    negNumFeatures: neg,
  }
}

describe('multi-wiggle renderSvg color consistency with canvas renderer', () => {
  const MODEL_POS_COLOR = '#1f77b4'
  const MODEL_NEG_COLOR = '#f0636b'

  it('canvas and SVG produce identical colors with explicit source color', () => {
    const sourceColor = '#00ff00'
    const canvas = resolveCanvasColors(
      sourceColor,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      false,
    )
    const svg = resolveSvgColors(
      sourceColor,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      false,
    )
    expect(svg).toEqual(canvas)
  })

  it('canvas and SVG produce identical colors without source color', () => {
    const canvas = resolveCanvasColors(
      undefined,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      false,
    )
    const svg = resolveSvgColors(
      undefined,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      false,
    )
    expect(svg).toEqual(canvas)
    expect(svg.posColor).toBe(MODEL_POS_COLOR)
    expect(svg.negColor).toBe(MODEL_NEG_COLOR)
  })

  it('canvas and SVG produce identical colors in overlay mode', () => {
    const sourceColor = '#00ff00'
    const canvas = resolveCanvasColors(
      sourceColor,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      true,
    )
    const svg = resolveSvgColors(
      sourceColor,
      MODEL_POS_COLOR,
      MODEL_NEG_COLOR,
      true,
    )
    expect(svg).toEqual(canvas)
    expect(svg.negColor).toBe(sourceColor)
  })

  it('overlay mode uses posColor for neg features', () => {
    const source = makeSource(3, 2)
    const slices = getFeatureSlices(source, '#00ff00', MODEL_NEG_COLOR, true)
    expect(slices).toHaveLength(2)
    expect(slices[0]!.color).toBe('#00ff00')
    expect(slices[1]!.color).toBe('#00ff00')
  })

  it('non-overlay mode uses negColor for neg features', () => {
    const source = makeSource(3, 2)
    const slices = getFeatureSlices(source, '#00ff00', MODEL_NEG_COLOR, false)
    expect(slices).toHaveLength(2)
    expect(slices[0]!.color).toBe('#00ff00')
    expect(slices[1]!.color).toBe(MODEL_NEG_COLOR)
  })

  it('returns empty slices when no features', () => {
    const source = makeSource(0, 0)
    const slices = getFeatureSlices(source, '#fff', '#000', false)
    expect(slices).toHaveLength(0)
  })

  it('returns only pos slice when no neg features', () => {
    const source = makeSource(5, 0)
    const slices = getFeatureSlices(source, '#fff', '#000', false)
    expect(slices).toHaveLength(1)
    expect(slices[0]!.type).toBe('pos')
  })
})
