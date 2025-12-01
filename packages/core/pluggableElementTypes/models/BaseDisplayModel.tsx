import type React from 'react'

import { getParent, isRoot, types } from '@jbrowse/mobx-state-tree'

import { getConf } from '../../configuration'
import { getContainingView, getEnv } from '../../util'
import { getParentRenderProps } from '../../util/tracks'
import { ElementId } from '../../util/types/mst'

import type { MenuItem } from '../../ui'
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
      message: undefined as string | undefined,
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
        let track = getParent<any>(self)
        while (!(track.configuration && getConf(track, 'trackId'))) {
          if (isRoot(track)) {
            throw new Error(`No parent track found for ${self.type} ${self.id}`)
          }
          track = getParent<any>(track)
        }
        return track
      },

      /**
       * #getter
       * Returns the parent display if this display is nested within another display
       * (e.g., PileupDisplay inside LinearAlignmentsDisplay)
       */
      get parentDisplay() {
        try {
          const parent = getParent<any>(self)
          // Check if immediate parent looks like a display (has type property
          // and is not the same as self)
          if (
            parent &&
            parent !== self &&
            parent.type &&
            typeof parent.type === 'string' &&
            parent.type.includes('Display')
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
       * display.rpcDriverName -> parentDisplay.effectiveRpcDriverName -> track.rpcDriverName -> global default
       */
      get effectiveRpcDriverName() {
        // 1. Check this display's explicit setting
        if (self.rpcDriverName) {
          // eslint-disable-next-line no-console
          console.log(`[effectiveRpcDriverName] ${self.type}: using own rpcDriverName:`, self.rpcDriverName)
          return self.rpcDriverName
        }

        // 2. Check parent display (for nested displays like PileupDisplay inside LinearAlignmentsDisplay)
        const parentDisplay = this.parentDisplay
        // eslint-disable-next-line no-console
        console.log(`[effectiveRpcDriverName] ${self.type}: parentDisplay:`, parentDisplay?.type, 'effectiveRpcDriverName:', parentDisplay?.effectiveRpcDriverName)
        if (parentDisplay?.effectiveRpcDriverName) {
          return parentDisplay.effectiveRpcDriverName
        }

        // 3. Fall back to track config
        try {
          const trackRpcDriverName = getConf(this.parentTrack, 'rpcDriverName')
          // eslint-disable-next-line no-console
          console.log(`[effectiveRpcDriverName] ${self.type}: using track config:`, trackRpcDriverName)
          return trackRpcDriverName || undefined
        } catch {
          // parentTrack may not be available in some contexts
          return undefined
        }
      },

      /**
       * #method
       * the react props that are passed to the Renderer when data
       * is rendered in this display. these are serialized and sent to the
       * worker for server-side rendering
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: getContainingView(self).minimized,
          rpcDriverName: this.effectiveRpcDriverName,
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
      setMessage(arg?: string) {
        self.message = arg
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
