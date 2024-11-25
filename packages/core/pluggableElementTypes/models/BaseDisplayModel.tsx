import type React from 'react'
import { getParent, types, isRoot } from 'mobx-state-tree'

// locals
import { getConf } from '../../configuration'
import { getContainingView, getEnv } from '../../util'
import { getParentRenderProps } from '../../util/tracks'
import { ElementId } from '../../util/types/mst'
import type { MenuItem } from '../../ui'
import type { Instance } from 'mobx-state-tree'

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
       * #method
       * the react props that are passed to the Renderer when data
       * is rendered in this display
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: getContainingView(self).minimized,
          rpcDriverName: self.rpcDriverName,
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
