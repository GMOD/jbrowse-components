import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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

/**
 * Helper to read a config value from either an MST model or plain object.
 * For MST models, uses readConfObject. For plain objects, accesses directly.
 */
export function readConf(
  config: AnyConfigurationModel | Record<string, unknown>,
  slotPath?: string | string[],
) {
  if (isStateTreeNode(config)) {
    return slotPath ? readConfObject(config, slotPath as any) : getSnapshot(config)
  }
  // Plain object - access directly
  if (!slotPath) {
    return config
  }
  if (typeof slotPath === 'string') {
    return config[slotPath]
  }
  // Array path
  let result: any = config
  for (const key of slotPath) {
    result = result?.[key]
  }
  return result
}

export function generateDisplayableConfig({
  config,
  session,
  pluginManager,
}: {
  config: AnyConfigurationModel | Record<string, unknown>
  session: AbstractSessionModel
  pluginManager: PluginManager
}) {
  const conf = isStateTreeNode(config) ? readConfObject(config) : config
  const formatAboutConfig = readConf(config, ['formatAbout', 'config']) || {}
  return pluginManager.evaluateExtensionPoint(
    'Core-customizeAbout',
    {
      config: {
        ...conf,
        ...getConf(session, ['formatAbout', 'config'], { config: conf }),
        ...formatAboutConfig,
      },
    },
    { session, config },
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }
}
