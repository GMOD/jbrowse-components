/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getParentRenderProps,
} from '@gmod/jbrowse-core/util/tracks'
import { types } from 'mobx-state-tree'
import React from 'react'
import TrackControls from './components/TrackControls'

export const generateBaseTrackConfig = (pluginManager: any) =>
  ConfigurationSchema('BaseTrack', {
    viewType: 'LinearGenomeView',
    name: {
      description: 'descriptive name of the track',
      type: 'string',
      defaultValue: 'Track',
    },
    description: {
      description: 'a description of the track',
      type: 'string',
      defaultValue: '',
    },
    category: {
      description: 'the category and sub-categories of a track',
      type: 'stringArray',
      defaultValue: [],
    },
    // see corresponding entry in circular-view ChordTrack
    // no config slot editor exists for this at the time being
    configRelationships: {
      type: 'configRelationships',
      model: types.array(
        types.model('Relationship', {
          type: types.string,
          target: types.reference(
            pluginManager.pluggableConfigSchemaType('track'),
          ),
        }),
      ),
      defaultValue: [],
    },
  })

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under
// session.configuration.assemblies.get(assemblyName).tracks).

// note that multiple displayed tracks could use the same configuration.
const minTrackHeight = 20
const defaultTrackHeight = 100
const BaseTrack = (pluginManager: any) =>
  types
    .model('BaseTrack', {
      id: ElementId,
      type: types.string,
      height: types.optional(
        types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
        defaultTrackHeight,
      ),
      configuration: ConfigurationReference(
        generateBaseTrackConfig(pluginManager),
      ),
    })
    .volatile(() => ({
      ReactComponent: undefined,
      rendererTypeName: undefined,
      ready: false,
      scrollTop: 0,
      error: '',
    }))
    .views(self => ({
      get name() {
        return getConf(self, 'name')
      },
      get ControlsComponent() {
        return TrackControls
      },

      get RenderingComponent(): React.FC<{
        model: typeof self
        offsetPx: number
        bpPerPx: number
        onHorizontalScroll: Function
        blockState: Record<string, any>
      }> {
        return (
          self.ReactComponent ||
          (() => (
            <div className="TrackRenderingNotImplemented">
              Rendering not implemented for {self.type} tracks
            </div>
          ))
        )
      },

      /**
       * the react props that are passed to the Renderer when data
       * is rendered in this track
       */
      get renderProps() {
        return {
          ...getParentRenderProps(self),
          trackModel: self,
        }
      },

      /**
       * the pluggable element type object for this track's
       * renderer
       */
      get rendererType() {
        const track = getContainingView(self)
        const session: any = getSession(self)
        const RendererType = session.pluginManager.getRendererType(
          self.rendererTypeName,
        )
        if (!RendererType)
          throw new Error(`renderer "${track.rendererTypeName}" not found`)
        if (!RendererType.ReactComponent)
          throw new Error(
            `renderer ${track.rendererTypeName} has no ReactComponent, it may not be completely implemented yet`,
          )
        return RendererType
      },

      /**
       * the PluggableElementType for the currently defined adapter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        const session: any = getSession(self)
        if (!adapterConfig)
          throw new Error(`no adapter configuration provided for ${self.type}`)
        const adapterType = session.pluginManager.getAdapterType(
          adapterConfig.type,
        )
        if (!adapterType)
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
        return adapterType
      },

      get showConfigurationButton() {
        const session: any = getSession(self)
        return !!session.editConfiguration
      },

      /**
       * if a track-level message should be displayed instead of the blocks,
       * make this return a react component
       */
      get trackMessageComponent() {
        return undefined
      },

      /**
       * @param {Region} region
       * @returns falsy if the region is fine to try rendering. Otherwise,
       *  return a string of text saying why the region can't be rendered.
       */
      regionCannotBeRendered() {
        return undefined
      },
    }))
    .actions(self => ({
      setHeight(trackHeight: number) {
        if (trackHeight > minTrackHeight) self.height = trackHeight
        else self.height = minTrackHeight
        return self.height
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
      setError(e: string) {
        self.ready = true
        self.error = e
      },

      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },
      activateConfigurationUI() {
        const session: any = getSession(self)
        session.editConfiguration(self.configuration)
      },
    }))

export default BaseTrack

export type BaseTrackStateModel = ReturnType<typeof BaseTrack>
