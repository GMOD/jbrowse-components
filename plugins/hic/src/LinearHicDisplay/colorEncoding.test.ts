import { setConf } from '@jbrowse/core/configuration'
import { darkAtLowEnd, rampLutOf } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '@jbrowse/render-core/scoreScale'
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
  binWidth: 4,
  originBp: 0,
  resolution: 1000,
  appliedNormalization: 'NONE',
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

function loaded(color: Record<string, unknown>) {
  const { display } = createDisplay()
  for (const [slot, value] of Object.entries(color)) {
    setConf(display, ['color', slot], value)
  }
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

describe.each(['linear', 'log'] as const)('a %s scale', scale => {
  test.each(CASES)('paints what the hand-built ramp did: %j', color => {
    const display = loaded({ ...color, scale })
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
    expect(display.renderState.scaleType).toBe(
      scale === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    )
  })
})

test('the encoding is the one object every surface reads', () => {
  const display = loaded({ scale: 'log', scheme: 'viridis', domainMax: 50 })
  expect(display.colorEncoding).toEqual({
    field: 'count',
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
  setConf(display, ['color', 'domainMax'], 10)
  setConf(display, ['color', 'scale'], 'log')
  setConf(display, ['color', 'domainQuantile'], 1)
  expect(display.colorRamp).toBe(ramp)
  dispose()
})

test('an inverted domain is flagged, and spans its ends in order', () => {
  const display = loaded({})
  expect(
    display.plotProblems({ color: { domainMin: 10, domainMax: 1 } }),
  ).toEqual([
    'color.domainMax: domainMax is below domainMin: the scale spans the two in order either way, and reverse is what turns it round',
  ])
  expect(display.plotProblems({ color: { scale: 'log' } })).toEqual([])
  expect(display.plotProblems({ color: { domainQuantile: 95 } })).toHaveLength(
    1,
  )
  setConf(display, ['color', 'domainMin'], 10)
  setConf(display, ['color', 'domainMax'], 1)
  expect(display.colorDomain).toEqual([1, 10])
})
