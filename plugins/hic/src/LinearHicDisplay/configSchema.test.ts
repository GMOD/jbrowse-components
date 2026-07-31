import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  DEFAULT_HIC_COLOR_SCHEME,
  HIC_COLOR_SCHEMES,
} from './components/colorRamp.ts'
import configSchemaFactory from './configSchema.ts'

function make() {
  return configSchemaFactory().create({
    type: 'LinearHicDisplay',
    displayId: 'hic-test',
  })
}

describe('colorScheme slot', () => {
  test("the slot default is colorRamp's declared default", () => {
    expect(readConfObject(make(), 'colorScheme')).toBe(DEFAULT_HIC_COLOR_SCHEME)
  })

  test.each(HIC_COLOR_SCHEMES)('accepts %s', scheme => {
    const conf = make()
    conf.setSlot('colorScheme', scheme)
    expect(readConfObject(conf, 'colorScheme')).toBe(scheme)
  })

  // The track menu's Juicebox radio writes the default value rather than the
  // old `undefined` reset, which only avoids marking the track edited because
  // stripDefault omits a slot equal to its default. That holds solely
  // while the slot default and DEFAULT_HIC_COLOR_SCHEME agree — which is why the
  // schema now reads the constant instead of repeating the literal.
  test('picking the default writes no config delta', () => {
    const conf = make()
    conf.setSlot('colorScheme', DEFAULT_HIC_COLOR_SCHEME)
    expect(getSnapshot(conf)).not.toHaveProperty('colorScheme')
  })

  test('picking a non-default scheme does persist', () => {
    const other = HIC_COLOR_SCHEMES.find(s => s !== DEFAULT_HIC_COLOR_SCHEME)!
    const conf = make()
    conf.setSlot('colorScheme', other)
    expect(getSnapshot(conf)).toHaveProperty('colorScheme', other)
  })
})
