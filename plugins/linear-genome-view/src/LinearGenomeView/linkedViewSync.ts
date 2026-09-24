import { addDisposer, addMiddleware } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const LINKED_ACTIONS = [
  'horizontalScroll',
  'zoomTo',
  'showTrack',
  'toggleTrack',
  'launchTrack',
  'launchToggleTrack',
  'hideTrack',
  'setTrackLabels',
  'setShowCenterLine',
] as const satisfies readonly (keyof LinearGenomeViewModel)[]

type LinkedAction = (typeof LINKED_ACTIONS)[number]

function isLinkedAction(name: string): name is LinkedAction {
  return (LINKED_ACTIONS as readonly string[]).includes(name)
}

interface LinkableViews {
  linkViews: boolean
  views: LinearGenomeViewModel[]
}

/**
 * While `linkViews` is on, replay each pan, zoom and track toggle made on one
 * sub-view onto every other, with the same arguments.
 */
export function installLinkedViewSync(self: IStateTreeNode & LinkableViews) {
  addDisposer(
    self,
    addMiddleware(self, (call, next) => {
      next(call)
      const { name, args, context } = call
      if (
        call.type === 'action' &&
        call.id === call.rootId &&
        self.linkViews &&
        isLinkedAction(name)
      ) {
        for (const view of self.views) {
          if (view !== context) {
            const action = view[name] as (...a: unknown[]) => unknown
            void action(...args)
          }
        }
      }
    }),
  )
}
