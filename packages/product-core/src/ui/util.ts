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
import type { ComponentType } from 'react'

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
// #endregion

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
  // same two-tier merge the feature-details panel runs on `formatDetails`,
  // session first so a track can override individual keys
  const merged: { config: Record<string, unknown> } = {
    config: {
      ...conf,
      ...mergeFormatCallbacks(sessionFormatAbout, trackFormatAbout),
    },
  }
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-customizeAbout | sync | Transform the config shown in a track's About dialog */
    'Core-customizeAbout',
    merged,
    { session, config },
  )
}
