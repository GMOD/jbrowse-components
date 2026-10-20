import { setConf } from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
} from '@jbrowse/render-core/scoreScale'

import { MIN_VISIBLE_ALPHA } from './components/shaders/hic.consts.generated.ts'
import { INSTANCE_STRIDE_WORDS } from './components/shaders/hic.iface.generated.ts'
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

test('the percentile is the color domain quantile', () => {
  const display = loaded()
  expect(display.configuration.color.domainQuantile).toBe(0.95)
  expect(display.rpcProps().quantile).toBe(0.95)
  display.setColorFollowsPercentile(false)
  expect(display.configuration.color.domainQuantile).toBe(1)
  expect(display.rpcProps().quantile).toBe(0.95)
  expect(display.saturationQuantile).toBe(0.95)
  display.setColorFollowsPercentile(true)
  expect(display.configuration.color.domainQuantile).toBe(0.95)
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
  setConf(display, ['color', 'scale'], 'log')
  expect(display.renderState.scaleType).toBe(SCALE_TYPE_LOG)
  expect(display.colorScales[0]).toMatchObject({
    title: 'Contacts (log)',
    domain: [1, 40],
  })
})

// A KR map holds many counts below 1, and a raw one many counts of exactly 1:
// the juicebox ramp's alpha is t, so the toggle must keep them above the
// discard, which log's floor of 1 does not
test('the Log scale toggle keeps counts at or below 1 visible', () => {
  const display = loaded()
  display.setLogScale(true)
  const { scaleType, domainMin, domainMax } = display.renderState
  expect(scaleType).toBe(SCALE_TYPE_SYMLOG)
  expect(display.colorScales[0]).toMatchObject({
    title: 'Contacts (symlog)',
    domain: [0, 40],
  })
  const t = makeScoreNormalizer(domainMin, domainMax, scaleType, 1)
  expect(t(0)).toBe(0)
  expect(t(0.4)).toBeGreaterThan(MIN_VISIBLE_ALPHA)
  expect(t(1)).toBeGreaterThan(MIN_VISIBLE_ALPHA)
  const log = makeScoreNormalizer(1, domainMax, SCALE_TYPE_LOG, 1)
  expect(log(1)).toBeLessThan(MIN_VISIBLE_ALPHA)
})
