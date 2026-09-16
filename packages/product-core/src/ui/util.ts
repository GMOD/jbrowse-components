import {
  getConf,
  mergeFormatCallbacks,
  readConfObject,
  readConfSlot,
} from '@jbrowse/core/configuration'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// #region aboutPanelProps
export type AboutConfig = AnyConfigurationModel | Record<string, unknown>

export interface AboutPanelProps {
  session: AbstractSessionModel
  config: AboutConfig
}
// #endregion

// #region aboutRegistry
// Augmentation lives here (not in the consuming components) because
// AboutDialogContents imports from this module, so the registry entries are
// visible wherever these points are evaluated — including getAboutDialogConfig
// below, which then needs no cast on the Core-customizeAbout result.
declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-extraAboutPanel': ComponentList<AboutPanelProps>
    // fired via PluggableComponent's `name` prop, so there is no string-literal
    // call site and the docs tag lives here at the contract
    /** #extensionPoint Core-replaceAbout | sync | Replace or wrap a track's About dialog body */
    'Core-replaceAbout': ComponentSlot<AboutPanelProps>
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
// #endregion

/**
 * What a track's About dialog shows: the config with the session's and the
 * track's `formatAbout` callbacks merged over it and passed through
 * `Core-customizeAbout`, plus the resolved `hideUris`. The two slots fold
 * differently on purpose: `config` is a merge the track can win key-by-key,
 * `hideUris` an OR a track cannot turn back off.
 *
 * The dialog hydrates a plain `session.tracks` entry before calling this, so a
 * plain object arrives only for a config no registered track type can build,
 * whose callback slots then cannot be evaluated either.
 */
export function getAboutDialogConfig({
  config,
  session,
  pluginManager,
}: {
  config: AboutConfig
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
      ...mergeFormatCallbacks(sessionFormatAbout, trackFormatAbout),
    },
  }
  return {
    ...pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-customizeAbout | sync | Transform the config shown in a track's About dialog */
      'Core-customizeAbout',
      merged,
      { session, config },
    ),
    hideUris: Boolean(
      getConf(session, ['formatAbout', 'hideUris']) ||
      readConfSlot<boolean>(config, ['formatAbout', 'hideUris']),
    ),
  }
}
