import {
  localStorageGetBoolean,
  localStorageSetBoolean,
} from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, cast, types } from 'mobx-state-tree'

import { BaseSessionModel, isBaseSession } from './BaseSession'
import { DrawerWidgetSessionMixin } from './DrawerWidgets'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import type { IAnyStateTreeNode, Instance } from 'mobx-state-tree'

/**
 * #stateModel MultipleViewsSessionMixin
 * composed of
 * - [BaseSessionModel](../basesessionmodel)
 * - [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
 */
export function MultipleViewsSessionMixin(pluginManager: PluginManager) {
  return types
    .compose(
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      /**
       * #property
       */
      stickyViewHeaders: types.optional(types.boolean, () =>
        localStorageGetBoolean('stickyViewHeaders', true),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      moveViewDown(id: string) {
        const idx = self.views.findIndex(v => v.id === id)
        if (idx !== -1 && idx < self.views.length - 1) {
          self.views.splice(idx, 2, self.views[idx + 1], self.views[idx])
        }
      },
      /**
       * #action
       */
      moveViewUp(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        if (idx > 0) {
          self.views.splice(idx - 1, 2, self.views[idx], self.views[idx - 1])
        }
      },
      /**
       * #action
       */
      moveViewToTop(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        self.views = cast([
          self.views[idx],
          ...self.views.filter(view => view.id !== id),
        ])
      },

      /**
       * #action
       */
      moveViewToBottom(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        self.views = cast([
          ...self.views.filter(view => view.id !== id),
          self.views[idx],
        ])
      },

      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        const length = self.views.push({
          ...initialState,
          type: typeName,
        })
        return self.views[length - 1]
      },

      /**
       * #action
       */
      removeView(view: IBaseViewModel) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            self.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },

      /**
       * #action
       */
      setStickyViewHeaders(sticky: boolean) {
        self.stickyViewHeaders = sticky
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetBoolean('stickyViewHeaders', self.stickyViewHeaders)
          }),
        )
      },
    }))
}

/** Session mixin MST type for a session that manages multiple views */
export type SessionWithMultipleViewsType = ReturnType<
  typeof MultipleViewsSessionMixin
>

/** Instance of a session with multiple views */
export type SessionWithMultipleViews = Instance<SessionWithMultipleViewsType>

/** Type guard for SessionWithMultipleViews */
export function isSessionWithMultipleViews(
  session: IAnyStateTreeNode,
): session is SessionWithMultipleViews {
  return isBaseSession(session) && 'views' in session
}
