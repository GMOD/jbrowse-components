import { buildSourceRenderData } from '../../shared/buildSourceRenderData.ts'
import { SINGLE_WIGGLE_SOURCE_NAME } from '../../util.ts'
import { createTestEnvironment } from '../testEnv.ts'

import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

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
        hasSummaryScores: false,
      },
    ],
  }
}

interface SingleSettings {
  useBicolor?: boolean
  color?: string
  posColor?: string
  negColor?: string
  // isDensityMode is not a setting: the model derives it from this
  renderingType?: string
  summaryScoreMode?: string
  bicolorPivot?: number
}

// The real model's gpuProps(), driven through the same setters the track menu
// uses. This used to restate the formula instead, so the tests below asserted
// against a copy, and a copy cannot notice the model growing a case it does not
// have. The case it was missing (density plus solid color, a second color
// creeping into a single-ramp track) was a live bug.
//
// The two settings without a config default worth inheriting are named
// explicitly. Single-wiggle defaults summaryScoreMode to whiskers, and these
// tests are about color, not bands.
function singleGpuProps(settings: SingleSettings = {}): WiggleGpuProps {
  const { display } = createTestEnvironment().createDisplay()
  // undefined clears the slot back to its default, which a fresh display is
  // already at, so every optional setting can go through unconditionally
  display.setUseBicolor(settings.useBicolor)
  display.setColor(settings.color)
  display.setPosColor(settings.posColor)
  display.setNegColor(settings.negColor)
  display.setBicolorPivot(settings.bicolorPivot)
  display.setRenderingType(settings.renderingType ?? 'xyplot')
  display.setSummaryScoreMode(settings.summaryScoreMode ?? 'avg')
  return display.gpuProps()
}

describe('LinearWiggleDisplay gpuProps + buildSourceRenderData', () => {
  it('uses posColor/negColor when useBicolor is true', () => {
    const data = makeData(2, true)
    const sources = buildSourceRenderData(data, singleGpuProps())
    expect(sources.length).toBeGreaterThan(0)
    for (const s of sources) {
      expect(s.color).not.toEqual([1, 0, 1])
    }
  })

  it('uses base color when useBicolor is false', () => {
    const data = makeData()
    const sources = buildSourceRenderData(
      data,
      singleGpuProps({ useBicolor: false, color: '#00ff00' }),
    )
    expect(sources).toHaveLength(1)
    expect(sources[0]!.color[0]).toBeCloseTo(0)
    expect(sources[0]!.color[1]).toBeCloseTo(1)
    expect(sources[0]!.color[2]).toBeCloseTo(0)
  })

  it('produces different colors when custom color changes', () => {
    const data = makeData()

    const sources1 = buildSourceRenderData(
      data,
      singleGpuProps({ useBicolor: false, color: '#ff0000' }),
    )
    const sources2 = buildSourceRenderData(
      data,
      singleGpuProps({ useBicolor: false, color: '#0000ff' }),
    )

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  it('produces different colors when posColor changes in bicolor mode', () => {
    const data = makeData()

    const sources1 = buildSourceRenderData(
      data,
      singleGpuProps({ posColor: '#0068d1' }),
    )
    const sources2 = buildSourceRenderData(
      data,
      singleGpuProps({ posColor: '#ff0000' }),
    )

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  // The sub-pivot instances are the second half of `colorsAbgr`, the layer
  // colour staying the positive one.
  it('produces different colors when negColor changes in bicolor mode', () => {
    const data = makeData(2, true)

    const below = (negColor: string) =>
      buildSourceRenderData(data, singleGpuProps({ negColor }))[0]!
        .colorsAbgr![1]

    expect(below('#e10000')).not.toBe(below('#00ff00'))
  })

  it('density mode + bicolor renders single source row', () => {
    const data = makeData()
    const sources = buildSourceRenderData(
      data,
      singleGpuProps({ renderingType: 'density' }),
    )
    expect(sources).toHaveLength(1)
  })

  it('density mode + solid color falls back to posColor', () => {
    const data = makeData()
    const props = singleGpuProps({
      useBicolor: false,
      color: '#00ff00',
      renderingType: 'density',
      posColor: '#0068d1',
    })
    // gpuProps leaves source.color undefined in density+solid mode, so multi
    // build uses defaultPosColor — preserving single's prior behavior of using
    // posColor (not the custom solid color) in density mode.
    expect(props.sources[0]!.color).toBeUndefined()
    const sources = buildSourceRenderData(data, props)
    expect(sources[0]!.color[0]).toBeCloseTo(0)
    expect(sources[0]!.color[2]).toBeGreaterThan(0.5)
  })
})
