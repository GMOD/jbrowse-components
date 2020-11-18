/* eslint-disable @typescript-eslint/no-explicit-any */
import { getParent, Instance, types, isRoot } from 'mobx-state-tree'
import React from 'react'
import { getConf } from '../../configuration'
import { MenuItem } from '../../ui'
import { getSession } from '../../util'
import { getParentRenderProps } from '../../util/tracks'
import { ElementId } from '../../util/types/mst'

export const BaseDisplay = types
  .model('BaseDisplay', {
    id: ElementId,
    type: types.string,
  })
  .volatile(() => ({
    rendererTypeName: '',
    error: undefined as Error | string | undefined,
  }))
  .views(self => ({
    get RenderingComponent(): React.FC<{
      model: typeof self
      onHorizontalScroll?: Function
      blockState?: Record<string, any>
    }> {
      const { pluginManager } = getSession(self)
      const displayType = pluginManager.getDisplayType(self.type)
      return displayType.ReactComponent as React.FC<{
        model: typeof self
        onHorizontalScroll?: Function
        blockState?: Record<string, any>
      }>
    },

    get DisplayBlurb(): React.FC<{ model: typeof self }> | null {
      return null
    },

    get adapterConfig() {
      return getConf(this.parentTrack, 'adapter')
    },

    get parentTrack() {
      let track = getParent(self)
      while (!(track.configuration && getConf(track, 'trackId'))) {
        if (isRoot(track)) {
          throw new Error(`No parent track found for ${self.type} ${self.id}`)
        }
        track = getParent(track)
      }
      return track
    },

    /**
     * the react props that are passed to the Renderer when data
     * is rendered in this display
     */
    get renderProps() {
      return {
        ...getParentRenderProps(self),
        displayModel: self,
      }
    },

    /**
     * the pluggable element type object for this display's
     * renderer
     */
    get rendererType() {
      const session = getSession(self)
      const RendererType = session.pluginManager.getRendererType(
        self.rendererTypeName,
      )
      if (!RendererType)
        throw new Error(`renderer "${self.rendererTypeName}" not found`)
      if (!RendererType.ReactComponent)
        throw new Error(
          `renderer ${self.rendererTypeName} has no ReactComponent, it may not be completely implemented yet`,
        )
      return RendererType
    },

    /**
     * if a display-level message should be displayed instead,
     * make this return a react component
     */
    get DisplayMessageComponent() {
      return undefined as undefined | React.FC<any>
    },

    get trackMenuItems(): MenuItem[] {
      return []
    },

    get viewMenuActions(): MenuItem[] {
      return []
    },
    /**
     * @param region -
     * @returns falsy if the region is fine to try rendering. Otherwise,
     *  return a react node + string of text.
     *  string of text describes why it cannot be rendered
     *  react node allows user to force load at current setting
     */
    regionCannotBeRendered(/* region */) {
      return undefined
    },
  }))
  .actions(self => ({
    setError(e: string) {
      self.error = e
    },
    // base display reload does nothing, see specialized displays for details
    reload() {},
  }))

export type BaseDisplayStateModel = typeof BaseDisplay
export type BaseDisplayModel = Instance<BaseDisplayStateModel>
