import { buildMultiSourceRenderData } from '../../MultiLinearWiggleDisplay/components/buildMultiSourceRenderData.ts'
import { SINGLE_WIGGLE_SOURCE_NAME } from '../../RenderWiggleDataRPC/types.ts'
import {
  WIGGLE_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
  isDefaultBicolor,
} from '../../util.ts'

import type { MultiWiggleGpuProps } from '../../MultiLinearWiggleDisplay/components/buildMultiSourceRenderData.ts'
import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'

function makeData(numFeatures = 2, withNeg = false): WiggleDataResult {
  return {
    sources: [
      {
        name: SINGLE_WIGGLE_SOURCE_NAME,
        featurePositions: new Uint32Array([0, 10, 10, 20]),
        featureScores: new Float32Array([5, withNeg ? -3 : 8]),
        featureMinScores: new Float32Array([5, withNeg ? -3 : 8]),
        featureMaxScores: new Float32Array([5, withNeg ? -3 : 8]),
        numFeatures,
        posFeaturePositions: withNeg
          ? new Uint32Array([0, 10])
          : new Uint32Array([0, 10, 10, 20]),
        posFeatureScores: withNeg
          ? new Float32Array([5])
          : new Float32Array([5, 8]),
        posNumFeatures: withNeg ? 1 : numFeatures,
        negFeaturePositions: withNeg
          ? new Uint32Array([10, 20])
          : new Uint32Array(0),
        negFeatureScores: withNeg
          ? new Float32Array([-3])
          : new Float32Array(0),
        negNumFeatures: withNeg ? 1 : 0,
      },
    ],
  }
}

interface SingleModelLike {
  color: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  summaryScoreMode: string
}

// Mirror LinearWiggleDisplay.gpuProps() so tests exercise the same formula
// the model uses to drive the unified multi build path.
function singleGpuProps(
  overrides: Partial<SingleModelLike> = {},
): MultiWiggleGpuProps {
  const m: SingleModelLike = {
    color: WIGGLE_COLOR_DEFAULT,
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: '#e10000',
    renderingType: 'xyplot',
    isDensityMode: false,
    summaryScoreMode: 'avg',
    ...overrides,
  }
  const useBicolor = isDefaultBicolor(m.color)
  const wantsSolidColor =
    !useBicolor && (m.summaryScoreMode === 'whiskers' || !m.isDensityMode)
  return {
    sources: [
      {
        name: SINGLE_WIGGLE_SOURCE_NAME,
        color: wantsSolidColor ? m.color : undefined,
      },
    ],
    posColor: m.posColor,
    negColor: m.negColor,
    summaryScoreMode: m.summaryScoreMode,
    isDensityMode: m.isDensityMode,
    renderingType: m.renderingType,
  }
}

describe('LinearWiggleDisplay gpuProps + buildMultiSourceRenderData', () => {
  it('uses posColor/negColor when color is default bicolor', () => {
    const data = makeData(2, true)
    const sources = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: WIGGLE_COLOR_DEFAULT }),
    )
    expect(sources.length).toBeGreaterThan(0)
    for (const s of sources) {
      expect(s.color).not.toEqual([1, 0, 1])
    }
  })

  it('uses base color when color is custom (non-bicolor)', () => {
    const data = makeData()
    const sources = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: '#00ff00' }),
    )
    expect(sources).toHaveLength(1)
    expect(sources[0]!.color[0]).toBeCloseTo(0)
    expect(sources[0]!.color[1]).toBeCloseTo(1)
    expect(sources[0]!.color[2]).toBeCloseTo(0)
  })

  it('produces different colors when custom color changes', () => {
    const data = makeData()

    const sources1 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: '#ff0000' }),
    )
    const sources2 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: '#0000ff' }),
    )

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  it('produces different colors when posColor changes in bicolor mode', () => {
    const data = makeData()

    const sources1 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: WIGGLE_COLOR_DEFAULT, posColor: '#0068d1' }),
    )
    const sources2 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: WIGGLE_COLOR_DEFAULT, posColor: '#ff0000' }),
    )

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  it('produces different colors when negColor changes in bicolor mode', () => {
    const data = makeData(2, true)

    const sources1 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: WIGGLE_COLOR_DEFAULT, negColor: '#e10000' }),
    )
    const sources2 = buildMultiSourceRenderData(
      data,
      singleGpuProps({ color: WIGGLE_COLOR_DEFAULT, negColor: '#00ff00' }),
    )

    const negSource1 = sources1.find(s => s.color[0] > 0.5 && s.color[1] < 0.5)
    const negSource2 = sources2.find(s => s.color[1] > 0.5 && s.color[0] < 0.5)
    expect(negSource1).toBeDefined()
    expect(negSource2).toBeDefined()
    expect(negSource1!.color).not.toEqual(negSource2!.color)
  })

  it('density mode + bicolor renders single source row', () => {
    const data = makeData()
    const sources = buildMultiSourceRenderData(
      data,
      singleGpuProps({
        color: WIGGLE_COLOR_DEFAULT,
        isDensityMode: true,
        renderingType: 'density',
      }),
    )
    expect(sources).toHaveLength(1)
  })

  it('density mode + custom color falls back to posColor', () => {
    const data = makeData()
    const props = singleGpuProps({
      color: '#00ff00',
      isDensityMode: true,
      renderingType: 'density',
      posColor: '#0068d1',
    })
    // gpuProps leaves source.color undefined in density+!useBicolor, so multi
    // build uses defaultPosColor — preserving single's prior behavior of using
    // posColor (not the custom solid color) in density mode.
    expect(props.sources[0]!.color).toBeUndefined()
    const sources = buildMultiSourceRenderData(data, props)
    expect(sources[0]!.color[0]).toBeCloseTo(0)
    expect(sources[0]!.color[2]).toBeGreaterThan(0.5)
  })
})
