import type { MenuItem } from './MenuTypes.ts'
import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  AbstractSessionModel,
  TrackActionView,
} from '../util/types/index.ts'

export interface ExtraTrackMenuItemsProps {
  session: AbstractSessionModel
  config: AnyConfigurationModel
  view?: TrackActionView
}

export type ExtraTrackMenuItemsCallback = (
  items: MenuItem[],
  props: ExtraTrackMenuItemsProps,
) => MenuItem[]

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // lets plugins contribute per-track items to the hierarchical track
    // selector's track menu, where only the track config (no open display) is
    // available
    'Core-extraTrackMenuItems': {
      args: MenuItem[]
      result: MenuItem[]
      props: ExtraTrackMenuItemsProps
    }
  }
}

// Plugins call this to contribute per-track menu items (keyed off the track
// config) to the hierarchical track selector. Wrapping addToExtensionPoint here
// keeps the typed callback contract in one place so callers don't depend on the
// extension-point type augmentation crossing package boundaries.
export function addExtraTrackMenuItems(
  pluginManager: PluginManager,
  callback: ExtraTrackMenuItemsCallback,
) {
  pluginManager.addToExtensionPoint('Core-extraTrackMenuItems', callback)
}

// Returns the contributed per-track menu items, or an empty array when no
// plugin contributes, so callers can spread it.
export function buildExtraTrackMenuItems(
  pluginManager: PluginManager,
  props: ExtraTrackMenuItemsProps,
): MenuItem[] {
  return pluginManager.evaluateExtensionPoint(
    'Core-extraTrackMenuItems',
    [],
    props,
  )
}
