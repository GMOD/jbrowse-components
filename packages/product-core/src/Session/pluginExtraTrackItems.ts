import { buildExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  TrackActionView,
} from '@jbrowse/core/util/types'

/**
 * plugin-contributed per-track items (`Core-extraTrackMenuItems`), surfaced in
 * both the hierarchical selector and the in-view label menu so plugins reach
 * every track menu consistently
 */
export function pluginExtraTrackItems(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  config: AnyTrackConfig,
  view?: TrackActionView,
): MenuItem[] {
  return buildExtraTrackMenuItems(pluginManager, {
    session,
    config,
    view,
  })
}
