import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaF from './configSchema.ts'

test('a v4 strokeColor lands on encoding.color, from the display or its renderer', () => {
  const conf = configSchemaF(new PluginManager()).create({
    type: 'ChordVariantDisplay',
    displayId: 'sv-ChordVariantDisplay',
    strokeColor: 'red',
    renderer: { strokeColorHover: 'blue', strokeColorSelected: 'green' },
  })
  expect(readConfObject(conf, ['encoding', 'color', 'value'])).toBe('red')
  expect(readConfObject(conf, 'colorHover')).toBe('blue')
  expect(readConfObject(conf, 'colorSelected')).toBe('green')
})
