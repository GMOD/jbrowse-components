import {
  evaluateJexl,
  getConf,
  isCallbackValue,
  readConfObject,
} from '@jbrowse/core/configuration'
import { isObject } from '@jbrowse/core/util'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * Recursively delete every occurrence of a property key from a nested plain
 * object (mutates in place), e.g. stripping `baseUri` from a config snapshot.
 */
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

/**
 * Read a single config slot from either a live MST config or a plain snapshot
 * object, evaluating the value if it is a `jexl:` expression. A plain snapshot
 * routes through the same `isCallbackValue`/`evaluateJexl` boundary as the MST
 * path, so callback handling (empty-body guard, feature proxy) stays identical.
 */
export function readConfSlot<T = unknown>(
  config: AnyConfigurationModel | Record<string, unknown>,
  slotPath: string | string[],
  args: Record<string, unknown> = {},
): T {
  const path = typeof slotPath === 'string' ? [slotPath] : slotPath
  if (isStateTreeNode(config)) {
    return readConfObject(config, path, args) as T
  }
  const value = path.reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    config,
  )
  return (isCallbackValue(value) ? evaluateJexl(value, args) : value) as T
}

/**
 * Build the config object shown in a track's About dialog: the base config
 * merged with session- and track-level `formatAbout` overrides, then passed
 * through the `Core-customizeAbout` extension point.
 */
export function getAboutDialogConfig({
  config,
  session,
  pluginManager,
}: {
  config: AnyConfigurationModel | Record<string, unknown>
  session: AbstractSessionModel
  pluginManager: PluginManager
}) {
  const conf = isStateTreeNode(config) ? readConfObject(config) : config
  const trackFormatAbout = readConfSlot(config, ['formatAbout', 'config'], {
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
        ...(isObject(trackFormatAbout) ? trackFormatAbout : {}),
      },
    },
    { session, config },
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }
}
