import { types } from '@jbrowse/mobx-state-tree'

import { aboutTrackMenuItem } from './TrackMenu.ts'

import type { BaseSession } from './BaseSession.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'

/**
 * #stateModel TrackMenuSessionMixin
 *
 * The minimal in-view track-label menu (just "About track" plus any
 * plugin-contributed extra actions) used by the embedded react views, which
 * have no track-editing actions to offer.
 */
export function TrackMenuSessionMixin(_pluginManager: PluginManager) {
  return types.model('TrackMenuSessionMixin', {}).views(s => {
    const self = s as typeof s & BaseSession
    return {
      /**
       * #method
       */
      getTrackActionMenuItems({
        effectiveConfig,
        extraTrackActions,
      }: {
        config: AnyConfigurationModel
        effectiveConfig: Record<string, unknown>
        extraTrackActions?: MenuItem[]
        view?: TrackActionView
      }): MenuItem[] {
        return [
          aboutTrackMenuItem(self, effectiveConfig),
          ...(extraTrackActions ?? []),
        ]
      },
    }
  })
}
