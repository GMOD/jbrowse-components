import type PluginManager from '../PluginManager.ts'
import type { AbstractSessionModel } from '../util/types/index.ts'
import type { MenuItem } from './MenuTypes.ts'

export interface MultiTrackMenuItemsProps {
  session: AbstractSessionModel
}

/** Return the items to add, or nothing when the selection isn't yours. */
export type MultiTrackMenuItemsCallback = (
  props: MultiTrackMenuItemsProps,
) => MenuItem | MenuItem[] | undefined

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region multiTrackMenuItems
    // lets plugins act on the whole checked selection in the hierarchical
    // track selector's shopping-cart menu
    'TrackSelector-multiTrackMenuItems': {
      args: MenuItem[]
      result: MenuItem[]
      props: MultiTrackMenuItemsProps
    }
    // #endregion
  }
}

// Declared here rather than in the plugin owning the track selector, because a
// contributor is a plugin that selector already depends on — wiggle offers
// "create multi-wiggle track" — and a type augmentation reaches a contributor
// only through an import it can afford to make. Same reason as
// Core-extraTrackMenuItems.
export function addMultiTrackMenuItems(
  pluginManager: PluginManager,
  callback: MultiTrackMenuItemsCallback,
) {
  pluginManager.contributeToExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    callback,
  )
}

// Returns the contributed items, or an empty array when no plugin contributes,
// so callers can spread it.
export function buildMultiTrackMenuItems(
  pluginManager: PluginManager,
  props: MultiTrackMenuItemsProps,
): MenuItem[] {
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint TrackSelector-multiTrackMenuItems | sync | Add items to the multi-track (shopping cart) menu */
    'TrackSelector-multiTrackMenuItems',
    [],
    props,
  )
}
