import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function removeAttr(obj: Record<string, unknown>, attr: string) {
  for (const prop in obj) {
    if (prop === attr) {
      delete obj[prop]
    } else if (typeof obj[prop] === 'object') {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

export function generateDisplayableConfig({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const session = getSession(config)
  const conf = readConfObject(config)
  return pluginManager.evaluateExtensionPoint(
    'Core-customizeAbout',
    {
      config: {
        ...conf,
        ...getConf(session, ['formatAbout', 'config'], { config: conf }),
        ...readConfObject(config, ['formatAbout', 'config'], { config: conf }),
      },
    },
    { session, config },
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }
}
