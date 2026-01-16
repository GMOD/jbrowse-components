import type React from 'react'

import { getParent, types } from '@jbrowse/mobx-state-tree'

import { getConf } from '../../configuration/index.ts'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
} from '../../util/index.ts'
import { getParentRenderProps } from '../../util/tracks.ts'
import { ElementId } from '../../util/types/mst.ts'

import type { MenuItem } from '../../ui/index.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel BaseDisplay
 * #category display
 */
function stateModelFactory() {
  return types
    .model('BaseDisplay', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.string,
      /**
       * #property
       */
      rpcDriverName: types.maybe(types.string),
    })
    .volatile(() => ({
      rendererTypeName: '',
      error: undefined as unknown,
      statusMessage: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get RenderingComponent(): React.FC<{
        model: typeof self
        onHorizontalScroll?: () => void
        blockState?: Record<string, any>
      }> {
        const { pluginManager } = getEnv(self)
        return pluginManager.getDisplayType(self.type)!
          .ReactComponent as React.FC<{
          model: typeof self
          onHorizontalScroll?: () => void
          blockState?: Record<string, any>
        }>
      },

      /**
       * #getter
       */
      get DisplayBlurb(): React.FC<{ model: typeof self }> | null {
        return null
      },

      /**
       * #getter
       */
      get adapterConfig() {
        return getConf(this.parentTrack, 'adapter')
      },

      /**
       * #getter
       */
      get parentTrack() {
        return getContainingTrack(self)
      },

      /**
       * #getter
       * Returns true if the parent track is minimized. Used to skip
       * expensive operations like autoruns when track is not visible.
       */
      get isMinimized() {
        return this.parentTrack.minimized
      },

      /**
       * #getter
       * Returns the parent display if this display is nested within another display
       * (e.g., PileupDisplay inside LinearAlignmentsDisplay)
       */
      get parentDisplay() {
        try {
          const parent = getParent<any>(self)
          // Check if immediate parent looks like a display
          // (has type property ending with 'Display')
          const parentType = parent?.type
          if (
            typeof parentType === 'string' &&
            parentType.endsWith('Display')
          ) {
            return parent
          }
        } catch {
          // Ignore errors walking up tree
        }
        return undefined
      },

      /**
       * #getter
       * Returns the effective RPC driver name with hierarchical fallback:
       * 1. This display's explicit rpcDriverName
       * 2. Parent display's effectiveRpcDriverName (for nested displays)
       * 3. Track config's rpcDriverName
       */
      get effectiveRpcDriverName() {
        if (self.rpcDriverName) {
          return self.rpcDriverName
        }
        if (this.parentDisplay?.effectiveRpcDriverName) {
          return this.parentDisplay.effectiveRpcDriverName
        }
        try {
          return getConf(this.parentTrack, 'rpcDriverName') || undefined
        } catch {
          return undefined
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * the react props that are passed to the Renderer when data
       * is rendered in this display. these are serialized and sent to the
       * worker for server-side rendering
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: self.isMinimized || getContainingView(self).minimized,
          rpcDriverName: self.effectiveRpcDriverName,
        }
      },
      /**
       * #method
       * props passed to the renderer's React "Rendering" component.
       * these are client-side only and never sent to the worker.
       * includes displayModel and callbacks
       */
      renderingProps() {
        return {
          displayModel: self,
        }
      },

      /**
       * #getter
       * the pluggable element type object for this display's renderer
       */
      get rendererType() {
        const { pluginManager } = getEnv(self)
        return pluginManager.getRendererType(self.rendererTypeName)!
      },

      /**
       * #getter
       * if a display-level message should be displayed instead, make this
       * return a react component
       */
      get DisplayMessageComponent() {
        return undefined as undefined | React.FC<any>
      },
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },

      /**
       * #getter
       */
      get viewMenuActions(): MenuItem[] {
        return []
      },
      /**
       * #method
       * @param region -
       * @returns falsy if the region is fine to try rendering. Otherwise,
       * return a react node + string of text. string of text describes why it
       * cannot be rendered react node allows user to force load at current
       * setting
       */
      regionCannotBeRendered(/* region */) {
        return null
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setStatusMessage(arg?: string) {
        self.statusMessage = arg
      },
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      setRpcDriverName(rpcDriverName: string) {
        self.rpcDriverName = rpcDriverName
      },
      /**
       * #action
       * base display reload does nothing, see specialized displays for details
       */
      reload() {},
    }))
}

export const BaseDisplay = stateModelFactory()
export type BaseDisplayStateModel = typeof BaseDisplay
export type BaseDisplayModel = Instance<BaseDisplayStateModel>
