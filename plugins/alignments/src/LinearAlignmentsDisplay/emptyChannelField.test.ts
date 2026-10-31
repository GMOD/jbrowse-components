import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaF from './configSchema.ts'

test("a written '' field loads as unset on the three maybe-field channels", () => {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  const conf = configSchemaF(pm).create(
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'empty-fields',
      pileup: {
        bases: { encoding: { color: '' } },
        mismatches: { encoding: { opacity: { field: '' } } },
      },
      readConnections: { encoding: { color: { field: '' } } },
    },
    { pluginManager: pm },
  )
  for (const path of [
    ['pileup', 'bases', 'encoding', 'color', 'field'],
    ['pileup', 'mismatches', 'encoding', 'opacity', 'field'],
  ] as const) {
    expect(readConfObject(conf, path)).toBeUndefined()
  }
})
