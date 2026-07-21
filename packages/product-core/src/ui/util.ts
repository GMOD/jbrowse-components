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
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ComponentType } from 'react'

export type AboutConfig = AnyConfigurationModel | Record<string, unknown>

export interface AboutPanelProps {
  session: AbstractSessionModel
  config: AboutConfig
}

// Augmentation lives here (not in the consuming components) because
// AboutDialogContents imports from this module, so the registry entries are
// visible wherever these points are evaluated — including getAboutDialogConfig
// below, which then needs no cast on the Core-customizeAbout result.
declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // accumulates an array of panels — every callback appends its own component
    // and returns the array, so panels from multiple plugins compose instead of
    // clobbering one another. Each renders its own BaseCard chrome
    'Core-extraAboutPanel': {
      args: ComponentType<AboutPanelProps>[]
      result: ComponentType<AboutPanelProps>[]
      props: AboutPanelProps
    }
    // singular: one dialog body renders, so this stays a single-component fold —
    // return your own component to replace/wrap the default, or the default to
    // opt out. Fired via PluggableComponent's `name` prop (no string-literal
    // call site), so the docs tag lives here at the contract.
    /** #extensionPoint Core-replaceAbout | sync | Replace or wrap a track's About dialog body */
    'Core-replaceAbout': {
      args: ComponentType<AboutPanelProps>
      result: ComponentType<AboutPanelProps>
      props: AboutPanelProps
    }
    // data transform: mutate the config object shown in the dialog
    'Core-customizeAbout': {
      args: { config: Record<string, unknown> }
      result: {
        config: { metadata?: Record<string, unknown>; [key: string]: unknown }
      }
      props: AboutPanelProps
    }
  }
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
  jexl?: JexlInstance,
): T {
  const path = typeof slotPath === 'string' ? [slotPath] : slotPath
  if (isStateTreeNode(config)) {
    return readConfObject(config, path, args) as T
  }
  const value = path.reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    config,
  )
  // A plain-object config has no MST env, so the realm's jexl instance can't be
  // resolved automatically — callers reading a callback slot must pass it. Only
  // reached when the slot actually holds a `jexl:` value (trackId/adapter/etc.
  // never do), so non-callback readers need not supply it.
  if (isCallbackValue(value)) {
    if (!jexl) {
      throw new Error(
        `cannot evaluate jexl config slot ${JSON.stringify(slotPath)} on a plain-object config: no jexl instance provided`,
      )
    }
    return evaluateJexl(value, args, jexl) as T
  }
  return value as T
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
  const conf: Record<string, unknown> = isStateTreeNode(config)
    ? readConfObject(config)
    : config
  const trackFormatAbout = readConfSlot(
    config,
    ['formatAbout', 'config'],
    { config: conf },
    pluginManager.jexl,
  )
  const sessionFormatAbout = getConf(session, ['formatAbout', 'config'], {
    config: conf,
  })
  const merged: { config: Record<string, unknown> } = {
    config: {
      ...conf,
      ...(isObject(sessionFormatAbout) ? sessionFormatAbout : {}),
      ...(isObject(trackFormatAbout) ? trackFormatAbout : {}),
    },
  }
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-customizeAbout | sync | Transform the config shown in a track's About dialog */
    'Core-customizeAbout',
    merged,
    { session, config },
  )
}
