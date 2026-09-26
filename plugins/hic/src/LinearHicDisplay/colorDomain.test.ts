import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { SCALE_TYPE_LOG } from '@jbrowse/render-core/scoreScale'

import { INSTANCE_STRIDE_WORDS } from './components/shaders/hic.iface.generated.ts'
import configSchemaF from './configSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'

function maxLabel(display: {
  colorScales: Parameters<typeof legendSpecOf>[0]
}) {
  return legendSpecOf(display.colorScales).sections[0]?.items[0]?.gradient
    ?.maxLabel
}

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

function loaded() {
  const { display } = createDisplay()
  display.setRpcData(DATA)
  return display
}

test('an unset top saturates at the percentile, and the key says so', () => {
  const display = loaded()
  expect(display.colorDomain).toEqual([0, 40])
  expect(maxLabel(display)).toBe('≥40')
})

test('with the percentile off an unset top is the largest count', () => {
  const display = loaded()
  display.setColorFollowsPercentile(false)
  expect(display.colorDomain).toEqual([0, 400])
  expect(maxLabel(display)).toBe('400')
})

test('the percentile is the colour autoscale, and the retired checkbox lands on it', () => {
  const display = loaded()
  expect(display.configuration.color.autoscale).toBe('localpercentile')
  expect(display.rpcProps().numQuantile).toBe(0.95)
  display.setColorFollowsPercentile(false)
  expect(display.configuration.color.autoscale).toBe('local')
  const schema = configSchemaF()
  for (const [written, autoscale] of [
    [true, 'localpercentile'],
    [false, 'local'],
  ] as const) {
    const conf = schema.create({
      type: 'LinearHicDisplay',
      displayId: 'd',
      useColorPercentile: written,
      color: { scheme: 'viridis' },
    })
    expect(readConfObject(conf, ['color', 'autoscale'])).toBe(autoscale)
    expect(readConfObject(conf, ['color', 'scheme'])).toBe('viridis')
  }
})

test('a pinned top holds whatever the loaded counts are', () => {
  const display = loaded()
  setConf(display, ['color', 'domainMax'], 1000)
  expect(display.renderState).toMatchObject({ domainMin: 0, domainMax: 1000 })
  display.setRpcData({ ...DATA, maxScore: 5, quantileScore: 2 })
  expect(display.renderState.domainMax).toBe(1000)
})

test('a pinned top gives a key before any data lands', () => {
  const { display } = createDisplay()
  expect(display.colorScales).toEqual([])
  setConf(display, ['color', 'domainMax'], 1000)
  expect(display.colorScales[0]).toMatchObject({ domain: [0, 1000] })
})

// the log scale floors at a count of 1, so that is where the key starts
test('a log key starts where the ramp does', () => {
  const display = loaded()
  display.setColorScale('log')
  expect(display.renderState.scaleType).toBe(SCALE_TYPE_LOG)
  expect(display.colorScales[0]).toMatchObject({
    title: 'Contacts (log)',
    domain: [1, 40],
  })
})
