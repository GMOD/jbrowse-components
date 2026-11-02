import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  .createPluggableElements()
  .configure()

test.each(['LinearVariantDisplay', 'LinearMarkDisplay'])(
  "%s's old rowHeight loads without it and points at rows.step",
  type => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const display = pluginManager.getDisplayType(type).configSchema.create({
      type,
      displayId: `${type}-row-step`,
      rowHeight: 12,
    })
    expect(readConfObject(display, ['rows', 'step'])).toBe('fit')
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/rowHeight.*did you mean rows\.step/),
    )
    warn.mockRestore()
  },
)
