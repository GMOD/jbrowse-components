import type React from 'react'

import { getParent, hasParent, isAlive, types } from '@jbrowse/mobx-state-tree'

import { getConf } from '../../configuration/index.ts'
import {
  getContainingTrack,
  getEnv,
  statusFraction,
  statusMessageText,
} from '../../util/index.ts'
import { ElementId } from '../../util/types/mst.ts'

import type { MenuItem } from '../../ui/index.ts'
import type { RpcStatus } from '../../util/progress.ts'
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      statusMessage: undefined as string | undefined,
      /**
       * #volatile
       * determinate progress fraction [0,1] for the current status, or
       * undefined when the in-flight phase is indeterminate. Set alongside
       * `statusMessage` by `setStatusMessage`; a display that never shows a
       * bar simply leaves it undefined.
       */
      statusProgress: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get parentTrack() {
        if (!hasParent(self)) {
          console.warn(
            `[BaseDisplayModel] parentTrack accessed with no parent: alive=${isAlive(self)} type=${self.type}`,
          )
        }
        return getContainingTrack(self)
      },

      /**
       * #getter
       * Returns the parent display if this display is nested within another display
       * (e.g., PileupDisplay inside LinearAlignmentsDisplay)
       */
      get parentDisplay() {
        if (hasParent(self)) {
          const parent = getParent<{
            type?: string
            effectiveRpcDriverName?: string
          }>(self)
          if (
            typeof parent.type === 'string' &&
            parent.type.endsWith('Display')
          ) {
            return parent
          }
        }
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get RenderingComponent(): React.FC<{
        model: typeof self
        onHorizontalScroll?: () => void
        blockState?: Record<string, unknown>
      }> {
        const { pluginManager } = getEnv(self)
        return pluginManager.getDisplayType(self.type)
          .ReactComponent as React.FC<{
          model: typeof self
          onHorizontalScroll?: () => void
          blockState?: Record<string, unknown>
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
        return getConf(self.parentTrack, 'adapter')
      },

      /**
       * #getter
       * Returns true if the parent track is minimized. Used to skip
       * expensive operations like autoruns when track is not visible.
       */
      get isMinimized() {
        return self.parentTrack.minimized
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
        if (self.parentDisplay?.effectiveRpcDriverName) {
          return self.parentDisplay.effectiveRpcDriverName
        }
        return getConf(self.parentTrack, 'rpcDriverName')
      },
    }))
    .views(self => ({
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
      setStatusMessage(status?: RpcStatus) {
        // derive the indeterminate label and the determinate fraction from the
        // one status transport; displays with no bar just ignore statusProgress
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
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
