import { addDisposer, addMiddleware, getPath } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model.ts'
import type {
  IAnyStateTreeNode,
  IMiddlewareEvent,
} from '@jbrowse/mobx-state-tree'

/**
 * The single source of truth for which LinearGenomeView actions can be
 * replayed across linked views. Keeping it here (rather than as loose string
 * arrays in each parent view) means the dispatch below stays exhaustive and a
 * typo can't silently produce a no-op sync.
 */
export type SyncableViewAction =
  | 'horizontalScroll'
  | 'zoomTo'
  | 'showTrack'
  | 'toggleTrack'
  | 'hideTrack'
  | 'setTrackLabels'
  | 'setShowCenterLine'

function applyViewAction(
  view: LinearGenomeViewModel,
  name: SyncableViewAction,
  args: IMiddlewareEvent['args'],
) {
  switch (name) {
    case 'horizontalScroll':
      view.horizontalScroll(args[0])
      break
    case 'zoomTo':
      view.zoomTo(args[0])
      break
    case 'showTrack':
      view.showTrack(args[0])
      break
    case 'toggleTrack':
      view.toggleTrack(args[0])
      break
    case 'hideTrack':
      view.hideTrack(args[0])
      break
    case 'setTrackLabels':
      view.setTrackLabels(args[0])
      break
    case 'setShowCenterLine':
      view.setShowCenterLine(args[0])
      break
  }
}

interface LinkableViews {
  linkViews: boolean
  views: LinearGenomeViewModel[]
}

/**
 * Install a middleware that, while `linkViews` is on, replays each listed
 * action onto every other sub-view so panning/zooming/track-toggling stays in
 * sync. Used by linear-comparative-view and breakpoint-split-view.
 */
export function installLinkedViewSync(
  self: IAnyStateTreeNode & LinkableViews,
  syncActions: readonly SyncableViewAction[],
) {
  addDisposer(
    self,
    addMiddleware(self, (rawCall, next) => {
      const handler =
        rawCall.type === 'action' &&
        rawCall.id === rawCall.rootId &&
        self.linkViews
          ? syncActions.find(action => action === rawCall.name)
          : undefined
      if (handler) {
        const sourcePath = getPath(rawCall.context)
        next(rawCall)
        for (const view of self.views) {
          if (getPath(view) !== sourcePath) {
            applyViewAction(view, handler, rawCall.args)
          }
        }
      } else {
        next(rawCall)
      }
    }),
  )
}
