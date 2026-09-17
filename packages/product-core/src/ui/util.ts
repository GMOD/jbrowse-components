import {
  getConf,
  mergeFormatCallbacks,
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

/**
 * What a track's About dialog shows: the config with the session's and the
 * track's `formatAbout` callbacks merged over it, plus the resolved `hideUris`.
 * The two slots fold differently on purpose: `config` is a merge the track can
 * win key-by-key, `hideUris` an OR a track cannot turn back off.
 */
export function getAboutDialogConfig({
  config,
  session,
}: {
  config: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const conf: Record<string, unknown> = readConfObject(config)
  const shown: { metadata?: Record<string, unknown>; [key: string]: unknown } =
    {
      ...conf,
      ...mergeFormatCallbacks(
        getConf(session, ['formatAbout', 'config'], { config: conf }),
        readConfObject(config, ['formatAbout', 'config'], { config: conf }),
      ),
    }
  return {
    config: shown,
    hideUris: Boolean(
      getConf(session, ['formatAbout', 'hideUris']) ||
      readConfObject(config, ['formatAbout', 'hideUris']),
    ),
  }
}
