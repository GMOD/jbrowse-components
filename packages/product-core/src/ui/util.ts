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
    } else if (obj[prop] !== null && typeof obj[prop] === 'object') {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

export function readConf<T = unknown>(
  config: AnyConfigurationModel | Record<string, unknown>,
  slotPath?: string | string[],
): T {
  if (isStateTreeNode(config)) {
    if (!slotPath) {
      return getSnapshot(config) as unknown as T
    }
    const path = typeof slotPath === 'string' ? [slotPath] : slotPath
    return readConfObject(config, path) as T
  }
  if (!slotPath) {
    return config as unknown as T
  }
  const keys = typeof slotPath === 'string' ? [slotPath] : slotPath
  let result: unknown = config
  for (const key of keys) {
    result = (result as Record<string, unknown>)?.[key]
  }
  if (typeof result === 'string' && result.startsWith('jexl:')) {
    return stringToJexlExpression(result).eval({}) as T
  }
  return result as T
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
