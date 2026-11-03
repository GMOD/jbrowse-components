import { cssColorToRgba } from '@jbrowse/core/util/colorBits'
import { thresholdIndex } from '@jbrowse/core/util/thresholdScale'
import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'
import { COLOR_RAMP_LUT_ENTRIES } from '@jbrowse/render-core/colorRampLut'

import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

const { createDisplay } = createTestEnvironment()

const CUTS = ['0.2', '0.4', '0.6', '0.8']
const LOCUSZOOM = ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a']

const VALUES = [0, 0.1999, 0.2, 0.3999, 0.4, 0.5, 0.7999, 0.8, 0.95, 1]

function loaded(ldValues: Float32Array): LDDataResult {
  return {
    ldValues,
    boundaries: new Float32Array(ldValues.length + 1),
    band: ldValues.length,
    uniformW: 10,
    originBp: 0,
    appliedLayout: 'columns',
    appliedField: 'r2',
    hasR2: true,
    hasDprime: false,
    snps: [],
  }
}

function binned(scale: Record<string, unknown>, legend = {}) {
  const { display } = createDisplay()
  display.applyPlot({ encoding: { color: { field: 'r2', scale, legend } } })
  display.setRpcData(loaded(Float32Array.from([...VALUES, LD_NOT_COMPUTED])))
  return display
}

function entry(ramp: Uint8Array, i: number) {
  return [...ramp.subarray(i * 4, i * 4 + 4)]
}

// `rampColor` in colorRampLut.slang: `t` lands at texel position t * (N - 1),
// and the linear filter blends the two entries either side of it.
function gpuSampledEntries(ramp: Uint8Array, t: number) {
  const x = Math.min(1, Math.max(0, t)) * (COLOR_RAMP_LUT_ENTRIES - 1)
  return [entry(ramp, Math.floor(x)), entry(ramp, Math.ceil(x))]
}

describe('a threshold scale over LocusZoom bins', () => {
  const display = binned({ type: 'threshold', domain: CUTS, range: LOCUSZOOM })
  const painted = display.paintedCells.get(0)!.ldValues
  const { ramp, domain, midNorm } = display.renderState.color
  const canvasFill = makeRampFillStyleLut(ramp)

  test.each(VALUES.map((v, k) => [v, k]))(
    'paints r² %f its bin on both backends',
    (v, k) => {
      const expected = [
        ...cssColorToRgba(LOCUSZOOM[thresholdIndex(v, CUTS.map(Number))]!),
      ]
      for (const sampled of gpuSampledEntries(ramp, painted[k]!)) {
        expect(sampled).toEqual(expected)
      }
      expect([...cssColorToRgba(canvasFill(painted[k]!))]).toEqual(expected)
    },
  )

  test('samples the banded table straight, the cells carrying their bin', () => {
    expect(domain).toEqual([0, 1])
    expect(midNorm).toBe(0.5)
  })

  test('leaves a pair the file does not list unpainted', () => {
    expect(painted.at(-1)).toBe(LD_NOT_COMPUTED)
  })

  test('hit-tests and labels the value the file wrote', () => {
    expect(display.rpcData!.ldValues[1]).toBeCloseTo(0.1999, 6)
  })

  test('keys every interval in its color, lowest first', () => {
    expect(display.colorScales).toEqual([
      {
        kind: 'categorical',
        id: 'ld',
        title: 'R²',
        entries: [
          { value: '< 0.2', label: '< 0.2', color: LOCUSZOOM[0] },
          { value: '0.2 – 0.4', label: '0.2 – 0.4', color: LOCUSZOOM[1] },
          { value: '0.4 – 0.6', label: '0.4 – 0.6', color: LOCUSZOOM[2] },
          { value: '0.6 – 0.8', label: '0.6 – 0.8', color: LOCUSZOOM[3] },
          { value: '≥ 0.8', label: '≥ 0.8', color: LOCUSZOOM[4] },
        ],
      },
    ])
  })

  test('is a config with no problem', () => {
    expect(display.notices).toEqual([])
  })
})

test('a descending key lists the highest interval first', () => {
  const display = binned(
    { type: 'threshold', domain: CUTS, range: LOCUSZOOM },
    { descending: true },
  )
  const [scale] = display.colorScales
  expect(scale?.kind === 'categorical' && scale.entries[0]!.label).toBe('≥ 0.8')
})

test('an interval the range leaves unnamed samples the scheme from its low end', () => {
  const display = binned({ type: 'threshold', domain: ['0.5'], range: [] })
  const lowest = entry(display.renderState.color.ramp, 0)
  const highest = entry(display.renderState.color.ramp, 255)
  expect(lowest).toEqual(entry(display.schemeRamp, 0))
  expect(highest).toEqual(entry(display.schemeRamp, 255))
})

test('a linear scale paints the file values through the scheme as before', () => {
  const display = binned({})
  expect(display.colorBins).toBeUndefined()
  expect(display.paintedCells.get(0)!.ldValues).toBe(display.rpcData!.ldValues)
  expect(display.renderState.color.ramp).toBe(display.schemeRamp)
})
