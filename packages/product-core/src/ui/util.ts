import {
  getConf,
  mergeFormatCallbacks,
  partitionAdvanced,
  readConfObject,
} from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// #region aboutPanelProps
export interface AboutPanelProps {
  session: AbstractSessionModel
  /** the track's config, hydrated by the dialog before any panel sees it */
  config: AnyConfigurationModel
}
// #endregion

// #region aboutRegistry
declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-extraAboutPanel': ComponentList<AboutPanelProps>
    // fired via PluggableComponent's `name` prop, so there is no string-literal
    // call site and the docs tag lives here at the contract
    /** #extensionPoint Core-replaceAbout | sync | Replace or wrap a track's About dialog body */
    'Core-replaceAbout': ComponentSlot<AboutPanelProps>
  }
}
// #endregion

/** About's two cards and `hideUris`, plus the raw `conf` Copy config copies. */
export function getAboutDialogConfig({
  config,
  session,
}: {
  config: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const conf: Record<string, unknown> = readConfObject(config)
  const edits = mergeFormatCallbacks(
    getConf(session, ['formatAbout', 'config'], { config: conf }),
    readConfObject(config, ['formatAbout', 'config'], { config: conf }),
  )
  const split = partitionAdvanced(config, conf)
  const shown: { metadata?: Record<string, unknown>; [key: string]: unknown } =
    { ...split.rest, ...edits }
  const advanced = Object.fromEntries(
    Object.entries(split.advanced).filter(([key]) => !(key in edits)),
  )
  return {
    conf,
    config: shown,
    advanced,
    hideUris: Boolean(
      getConf(session, ['formatAbout', 'hideUris']) ||
      readConfObject(config, ['formatAbout', 'hideUris']),
    ),
  }
}
