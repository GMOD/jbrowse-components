import { coarseStripHTML, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface MenuTrack {
  configuration: BaseTrackConfig
  trackMenuItems: () => MenuItem[]
}

/**
 * #api
 * One track's menu as a submenu named for the track: the session's track
 * actions (About track, Settings) beside the track's own items; the menu orders
 * them by priority. A linear view attaches this to the track label; a view that draws no label
 * puts it in the view's menu. `view` is whatever shows and launches the track.
 */
export function trackSubMenuItem(
  view: TrackActionView & IAnyStateTreeNode,
  track: MenuTrack,
): MenuItem {
  const session = getSession(view)
  return {
    label: coarseStripHTML(getTrackName(track.configuration, session)),
    type: 'subMenu',
    subMenu: [
      ...(session.getTrackActionMenuItems?.({
        config: track.configuration,
        view,
      }) ?? []),
      ...track.trackMenuItems(),
    ],
  }
}
