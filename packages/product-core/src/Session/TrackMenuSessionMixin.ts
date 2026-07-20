import { types } from '@jbrowse/mobx-state-tree'

import { asSession } from '../siblingCast.ts'
import {
  aboutTrackMenuItem,
  pluginExtraTrackItems,
  trackListMenuItems,
} from './TrackMenu.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'

/**
 * #stateModel TrackMenuSessionMixin
 *
 * The minimal track menus used by the embedded react views, which have no
 * track-editing actions to offer: just "About track" plus any plugin-contributed
 * items (`Core-extraTrackMenuItems`). Mirrors the shape of the full
 * `TrackMenuItemsSessionMixin` so both menu surfaces stay consistent across
 * products, minus the Settings/Copy/Delete actions.
 */
export function TrackMenuSessionMixin(pluginManager: PluginManager) {
  return types.model('TrackMenuSessionMixin', {}).views(s => {
    const self = asSession(s)
    return {
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        config: AnyConfigurationModel,
        view?: TrackActionView,
      ): MenuItem[] {
        return [
          ...trackListMenuItems(self, config, []),
          ...pluginExtraTrackItems(pluginManager, self, config, view),
        ]
      },
      /**
       * #method
       */
      getTrackActionMenuItems({
        config,
        view,
      }: {
        config: AnyConfigurationModel
        view?: TrackActionView
      }): MenuItem[] {
        return [
          // priority mirrors the full TrackMenuItemsSessionMixin so "About
          // track" sorts to the top of the in-view label menu consistently
          // across embedded and full products
          { ...aboutTrackMenuItem(self, config), priority: 1002 },
          ...pluginExtraTrackItems(pluginManager, self, config, view),
        ]
      },
    }
  })
}
