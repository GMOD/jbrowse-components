import { setConf } from '@jbrowse/core/configuration'
import { darkAtLowEnd, rampLutOf } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { autorun, getDependencyTree } from 'mobx'

import { INSTANCE_STRIDE_WORDS } from './components/shaders/hic.iface.generated.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

const DATA: HicDataResult = {
  instances: new Float32Array(INSTANCE_STRIDE_WORDS),
  numContacts: 1,
  maxScore: 400,
  quantileScore: 40,
  quantile: 0.95,
  binWidth: 4,
  originBp: 0,
  resolution: 1000,
  appliedNormalization: 'NONE',
  appliedField: 'observed',
  regions: [
    {
      refName: 'ctgA',
      dataXStart: 0,
      dataXEnd: 256,
      combinedOffset: 0,
      reversed: false,
    },
  ],
  pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: 1 }],
}

const { createDisplay } = createTestEnvironment()

function loaded(scale: Record<string, unknown>) {
  const { display } = createDisplay()
  display.applyPlot({ encoding: { color: { scale } } })
  display.setRpcData(DATA)
  return display
}

const CASES: {
  scheme: ColorSchemeName
  reverse?: boolean
  domainMin?: number
  domainMax?: number
  domainQuantile?: number
}[] = [
  { scheme: 'juicebox' },
  { scheme: 'viridis' },
  { scheme: 'viridis', reverse: false },
  { scheme: 'magma', reverse: true, domainMax: 50 },
  { scheme: 'fall', reverse: true, domainMin: 5 },
  { scheme: 'reds', domainMin: 2, domainMax: 300 },
  { scheme: 'blues', domainQuantile: 1 },
]

describe.each(['linear', 'symlog', 'log'] as const)('a %s scale', scale => {
  test.each(CASES)('paints what the hand-built ramp did: %j', color => {
    const display = loaded({ ...color, type: scale })
    const reverse = color.reverse ?? darkAtLowEnd(color.scheme)
    const loadedMax =
      (color.domainQuantile ?? 0.95) < 1 ? DATA.quantileScore : DATA.maxScore
    const shared = continuousColorScale(display.colorEncoding, [0, loadedMax])
    expect(display.colorRamp).toBe(rampLutOf({ scheme: color.scheme, reverse }))
    expect(display.colorRamp).toEqual(shared.lut)
    expect(display.colorDomain).toEqual([
      color.domainMin ?? 0,
      color.domainMax ?? loadedMax,
    ])
    expect(display.colorDomain).toEqual(shared.domain)
    expect(display.renderState.color.scaleType).toBe(scaleTypeCode(scale))
  })
})

test('the encoding is the one object every surface reads', () => {
  const display = loaded({ type: 'log', scheme: 'viridis', domainMax: 50 })
  expect(display.colorEncoding).toEqual({
    field: 'observed',
    scale: 'log',
    scheme: 'viridis',
    reverse: true,
    domainMin: undefined,
    domainMax: 50,
    domainMid: undefined,
    range: undefined,
    domainQuantile: 0.95,
  })
})

test('the ramp texture follows only the scheme and its direction', () => {
  const display = loaded({})
  const dispose = autorun(() => display.renderState)
  const ramp = display.colorRamp
  const deps = JSON.stringify(getDependencyTree(display, 'colorRamp'))
  expect(deps).toContain('colorScheme')
  expect(deps).toContain('colorReverse')
  expect(getDependencyTree(display, 'colorRamp').dependencies).toHaveLength(2)
  setConf(display, ['encoding', 'color', 'scale', 'domainMax'], 10)
  setConf(display, ['encoding', 'color', 'scale', 'type'], 'log')
  setConf(display, ['encoding', 'color', 'scale', 'domainQuantile'], 1)
  expect(display.colorRamp).toBe(ramp)
  dispose()
})

test('an inverted domain is flagged, and spans its ends in order', () => {
  const display = loaded({})
  expect(
    display.plotProblems({
      encoding: { color: { scale: { domainMin: 10, domainMax: 1 } } },
    }),
  ).toEqual([
    'encoding.color.scale.domainMax: domainMax is below domainMin: the scale spans the two in order either way, and reverse is what turns it round',
  ])
  expect(
    display.plotProblems({ encoding: { color: { scale: { type: 'log' } } } }),
  ).toEqual([])
  expect(
    display.plotProblems({
      encoding: { color: { scale: { domainQuantile: 95 } } },
    }),
  ).toHaveLength(1)
  setConf(display, ['encoding', 'color', 'scale', 'domainMin'], 10)
  setConf(display, ['encoding', 'color', 'scale', 'domainMax'], 1)
  expect(display.colorDomain).toEqual([1, 10])
})

// withPreset drops a preset whose scale.type differs, so a written symlog on
// a ratio kept the preset's redblue and lost its reverse: true
test('a ratio on a written scale type keeps its preset direction, enrichment red', () => {
  const { display } = createDisplay()
  display.applyPlot({
    encoding: {
      color: { field: 'observed/expected', scale: { type: 'symlog' } },
    },
  })
  expect(display.colorScheme).toBe('redblue')
  expect(display.colorReverse).toBe(true)
  display.applyPlot({
    encoding: {
      color: {
        field: 'observed/expected',
        scale: { type: 'symlog', scheme: 'purpleorange' },
      },
    },
  })
  expect(display.colorReverse).toBe(false)
})
