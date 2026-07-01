import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { isObject } from '@jbrowse/core/util'
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
  args: Record<string, unknown> = {},
): T {
  const path = slotPath
    ? typeof slotPath === 'string'
      ? [slotPath]
      : slotPath
    : undefined
  if (isStateTreeNode(config)) {
    return (
      path ? readConfObject(config, path, args) : getSnapshot(config)
    ) as T
  }
  if (!path) {
    return config as unknown as T
  }
  let result: unknown = config
  for (const key of path) {
    result = (result as Record<string, unknown> | undefined)?.[key]
  }
  if (typeof result === 'string' && result.startsWith('jexl:')) {
    return stringToJexlExpression(result).eval(args) as T
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
  const formatAboutConfig = readConf(config, ['formatAbout', 'config'], {
    config: conf,
  })
  const sessionFormatAbout = getConf(session, ['formatAbout', 'config'], {
    config: conf,
  })
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-customizeAbout | sync | Transform the config shown in a track's About dialog */
    'Core-customizeAbout',
    {
      config: {
        ...conf,
        ...(isObject(sessionFormatAbout) ? sessionFormatAbout : {}),
        ...(isObject(formatAboutConfig) ? formatAboutConfig : {}),
      },
    },
    { session, config },
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }
}
