import { readConfObject } from '@jbrowse/core/configuration'
import { cast, getSnapshot, types } from 'mobx-state-tree'

// locals
import { BaseSessionModel, isBaseSession } from './BaseSession'
import { DrawerWidgetSessionMixin } from './DrawerWidgets'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import type { IBaseViewModelWithDisplayedRegions } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import type { Region } from '@jbrowse/core/util'
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
      addLinearGenomeViewOfAssembly(assemblyName: string, initialState = {}) {
        return this.addViewOfAssembly(
          'LinearGenomeView',
          assemblyName,
          initialState,
        )
      },

      /**
       * #action
       */
      addViewOfAssembly(
        viewType: string,
        assemblyName: string,
        initialState: Record<string, unknown> = {},
      ) {
        const asm = self.assemblies.find(
          s => readConfObject(s, 'name') === assemblyName,
        )
        if (!asm) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
        return this.addView(viewType, {
          ...initialState,
          displayRegionsFromAssemblyName: readConfObject(asm, 'name'),
        })
      },

      /**
       * #action
       */
      addViewFromAnotherView(
        viewType: string,
        otherView: IBaseViewModelWithDisplayedRegions,
        initialState: { displayedRegions?: Region[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
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
