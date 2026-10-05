import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { darkAtLowEnd, rampLutOf } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { autorun, getDependencyTree } from 'mobx'

import { LD_FIELD_PRESETS } from './ldColorConfigSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { LDMetric } from '../VariantRPC/ldTypes.ts'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

const { createDisplay } = createTestEnvironment()

function served(metric: LDMetric): LDDataResult {
  return {
    ldValues: new Float32Array([0.5]),
    boundaries: new Float32Array([0, 10, 20]),
    numCells: 1,
    band: 1,
    uniformW: 10,
    originBp: 0,
    genomicMode: false,
    metric,
    hasR2: metric === 'r2',
    hasDprime: metric === 'dprime',
    snps: [],
  }
}

function painting(color: Record<string, unknown>) {
  const { display } = createDisplay()
  display.applyPlot({ color })
  return display
}

const CASES: {
  field: LDMetric
  scheme?: ColorSchemeName
  reverse?: boolean
  domainMin?: number
  domainMax?: number
}[] = [
  { field: 'r2' },
  { field: 'dprime' },
  { field: 'r2', scheme: 'viridis' },
  { field: 'dprime', scheme: 'viridis', reverse: false },
  { field: 'r2', scheme: 'magma', reverse: true, domainMax: 0.6 },
  { field: 'dprime', scheme: 'fall', domainMin: 0.2 },
  { field: 'r2', reverse: true, domainMin: 0.1, domainMax: 0.9 },
]

test.each(CASES)('paints what the shared ramp does: %j', color => {
  const display = painting(color)
  const scheme = color.scheme ?? LD_FIELD_PRESETS[color.field].scheme
  const reverse = color.reverse ?? darkAtLowEnd(scheme)
  const shared = continuousColorScale(display.colorEncoding, [0, 1])
  expect(display.colorScheme).toBe(scheme)
  expect(display.colorRamp).toBe(rampLutOf({ scheme, reverse }))
  expect(display.colorRamp).toEqual(shared.lut)
  expect(display.colorDomain).toEqual([
    color.domainMin ?? 0,
    color.domainMax ?? 1,
  ])
  expect(display.colorDomain).toEqual(shared.domain)
  expect(display.renderState).toMatchObject({
    domainMin: display.colorDomain[0],
    domainMax: display.colorDomain[1],
    colorRamp: display.colorRamp,
  })
})

test('the encoding is the one object every surface reads', () => {
  const display = painting({ field: 'dprime', domainMax: 0.8 })
  expect(display.colorEncoding).toEqual({
    field: 'dprime',
    scale: 'linear',
    scheme: 'blues',
    reverse: false,
    domainMin: undefined,
    domainMax: 0.8,
    domainMid: undefined,
    range: undefined,
    domainQuantile: undefined,
  })
})

// The worker serves r² from a file with no D' column, and a triangle stays on
// screen through a metric switch's refetch: both keep the hue of what they are.
test('the served metric picks the preset, whatever the config asks for', () => {
  const { display } = createDisplay()
  setConf(display, ['color', 'field'], 'dprime')
  display.setRpcData(served('r2'))
  expect(display.colorField).toBe('dprime')
  expect(display.rpcProps().ldMetric).toBe('dprime')
  expect(display.colorScheme).toBe('reds')
  expect(display.colorScales[0]!.title).toBe('R²')
  display.setRpcData(served('dprime'))
  expect(display.colorScheme).toBe('blues')
})

test('a written scheme holds across a metric switch', () => {
  const { display } = createDisplay()
  display.setColorScheme('viridis')
  display.setLDMetric('dprime')
  expect(display.colorScheme).toBe('viridis')
})

test("picking the field's own scheme leaves it following the field", () => {
  const { display } = createDisplay()
  display.setColorScheme('reds')
  expect(
    readConfObject(display.configuration, ['color', 'scheme']),
  ).toBeUndefined()
  display.setLDMetric('dprime')
  expect(display.colorScheme).toBe('blues')
})

test("on a file serving only D', picking reds paints reds", () => {
  const { display } = createDisplay()
  display.setRpcData(served('dprime'))
  display.setColorScheme('reds')
  expect(display.colorScheme).toBe('reds')
  display.setColorScheme('blues')
  expect(
    readConfObject(display.configuration, ['color', 'scheme']),
  ).toBeUndefined()
})

test('the ramp texture follows only the scheme and its direction', () => {
  const { display } = createDisplay()
  const dispose = autorun(() => display.renderState)
  const ramp = display.colorRamp
  const deps = JSON.stringify(getDependencyTree(display, 'colorRamp'))
  expect(deps).toContain('colorScheme')
  expect(deps).toContain('colorReverse')
  expect(getDependencyTree(display, 'colorRamp').dependencies).toHaveLength(2)
  setConf(display, ['color', 'domainMax'], 0.5)
  setConf(display, ['color', 'domainMin'], 0.1)
  display.setRpcData(served('r2'))
  expect(display.colorRamp).toBe(ramp)
  dispose()
})

test('a v4 track whose display spells ldMetric loads its colour', () => {
  const { display } = createTestEnvironment({
    displayConfig: { ldMetric: 'dprime' },
  }).createDisplay()
  expect(readConfObject(display.configuration, ['color', 'field'])).toBe(
    'dprime',
  )
  expect(display.colorScheme).toBe('blues')
  expect(display.rpcProps().ldMetric).toBe('dprime')
})
