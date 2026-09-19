import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { densityRampLut } from './densityColorRamp.ts'
import { resolveWiggleColor } from './wiggleColor.ts'

import type { FullColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

const EMPTY: FullColorSetting = {
  value: undefined,
  field: '',
  scale: undefined,
  domain: [],
  palette: [],
  ramp: [],
  domainMid: undefined,
}

const color = (over: Partial<FullColorSetting>) => ({ ...EMPTY, ...over })

test('a bare value paints both sides', () => {
  expect(resolveWiggleColor(color({ value: 'green' }), 0)).toEqual({
    posColor: 'green',
    negColor: 'green',
    pivot: 0,
    rampLut: null,
    perSource: false,
  })
})

test('an empty threshold domain cuts at the origin, in the wiggle defaults', () => {
  expect(resolveWiggleColor(color({ field: 'score' }), 3)).toEqual({
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: WIGGLE_NEG_COLOR_DEFAULT,
    pivot: 3,
    rampLut: null,
    perSource: false,
  })
})

test('a threshold domain names the cut and the palette the two sides', () => {
  const out = resolveWiggleColor(
    color({
      field: 'score',
      scale: 'threshold',
      domain: ['2'],
      palette: ['#2166ac', '#b2182b'],
    }),
    0,
  )
  expect(out.pivot).toBe(2)
  expect(out.negColor).toBe('#2166ac')
  expect(out.posColor).toBe('#b2182b')
})

test('source through a categorical scale is a colour per source', () => {
  expect(resolveWiggleColor(color({ field: 'source' }), 0).perSource).toBe(true)
})

test('a named ramp resolves to the LUT both backends index', () => {
  const out = resolveWiggleColor(
    color({ field: 'score', scale: 'linear', ramp: ['viridis'] }),
    0,
  )
  expect(out.rampLut).toBe(densityRampLut('viridis'))
})

test('CSS stops build one cached LUT, and domainMid moves the pivot', () => {
  const written = color({
    field: 'score',
    scale: 'linear',
    ramp: ['white', 'red'],
    domainMid: 2,
  })
  const out = resolveWiggleColor(written, 0)
  expect(out.pivot).toBe(2)
  expect(out.rampLut).toBe(resolveWiggleColor(written, 0).rampLut)
  expect(out.rampLut).not.toBeNull()
})

test('one CSS stop is the inline fade to that colour', () => {
  const out = resolveWiggleColor(
    color({ field: 'score', scale: 'linear', ramp: ['red'] }),
    0,
  )
  expect(out.rampLut).toBeNull()
  expect(out.posColor).toBe('red')
  expect(out.negColor).toBe('red')
})
