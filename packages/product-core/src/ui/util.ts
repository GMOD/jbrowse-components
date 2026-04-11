import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
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
    return slotPath
      ? readConfObject(config, slotPath as any)
      : getSnapshot(config)
  }
  // Plain object - access directly
  if (!slotPath) {
    return config
  }
  const keys = typeof slotPath === 'string' ? [slotPath] : slotPath
  let result: any = config
  for (const key of keys) {
    result = result?.[key]
  }
  if (typeof result === 'string' && result.startsWith('jexl:')) {
    return stringToJexlExpression(result).eval({})
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
  const sessionFormatAbout =
    getConf(session, ['formatAbout', 'config'], { config: conf }) || {}
  return pluginManager.evaluateExtensionPoint(
    'Core-customizeAbout',
    {
      config: {
        ...conf,
        ...(typeof sessionFormatAbout === 'object' ? sessionFormatAbout : {}),
        ...(typeof formatAboutConfig === 'object' ? formatAboutConfig : {}),
      },
    },
    { session, config },
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }
}
