/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigurationSchema, getConf } from '@gmod/jbrowse-core/configuration'
import { isSessionModelWithConfigEditing } from '@gmod/jbrowse-core/util/types'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { MenuItem } from '@gmod/jbrowse-core/ui'
import { getSession, getContainingView } from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types, Instance } from 'mobx-state-tree'
import InfoIcon from '@material-ui/icons/Info'
import React from 'react'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'

import { LinearGenomeViewModel } from '../LinearGenomeView'

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under
// session.configuration.assemblies.get(assemblyName).tracks).

const generateBaseTrackConfig = (base: any) =>
  ConfigurationSchema(
    'BaseTrack',
    {
      viewType: 'LinearGenomeView',
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      },
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
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
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },
      mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `function(feature) {
      return feature.get('name')
      }`,
        functionSignature: ['feature'],
      },
      maxDisplayedBpPerPx: {
        type: 'number',
        description: 'maximum bpPerPx that is displayed in the view',
        defaultValue: Number.MAX_VALUE,
      },

      // see corresponding entry in circular-view ChordTrack
      // no config slot editor exists for this at the time being
      configRelationships: {
        type: 'configRelationships',
        model: types.array(
          types.model('Relationship', {
            type: types.string,
            target: types.maybe(types.reference(base)),
          }),
        ),
        defaultValue: [],
      },
    },
    {
      explicitIdentifier: 'trackId',
    },
  )

// note that multiple displayed tracks could use the same configuration.
const minTrackHeight = 20
const defaultTrackHeight = 100
const BaseTrack = types
  .model('BaseTrack', {
    id: ElementId,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      defaultTrackHeight,
    ),
  })
  .volatile(() => ({
    ReactComponent: undefined as any,
    rendererTypeName: '',
    scrollTop: 0,
    showAbout: false,
    error: undefined as Error | string | undefined,
    userBpPerPxLimit: undefined as undefined | number,
  }))
  .views(self => ({
    get rpcSessionId() {
      return self.id
    },

    get name() {
      return getConf(self, 'name')
    },

    get RenderingComponent(): React.FC<{
      model: typeof self
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

    get TrackBlurb(): React.FC<{ model: typeof self }> | null {
      return null
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
      const session: any = getSession(self)
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
     * the PluggableElementType for the currently defined adapter
     */
    get adapterType() {
      const adapterConfig = getConf(self, 'adapter')
      const session = getSession(self)
      if (!adapterConfig)
        throw new Error(`no adapter configuration provided for ${self.type}`)
      const adapterType = session.pluginManager.getAdapterType(
        adapterConfig.type,
      )
      if (!adapterType)
        throw new Error(`unknown adapter type ${adapterConfig.type}`)
      return adapterType
    },

    /**
     * if a track-level message should be displayed instead of the blocks,
     * make this return a react component
     */
    get TrackMessageComponent() {
      return undefined as undefined | React.FC<any>
    },

    get viewMenuActions(): MenuItem[] {
      return []
    },

    /**
     * set limit to config amount, or user amount if they force load,
     */
    get maxViewBpPerPx() {
      return self.userBpPerPxLimit || getConf(self, 'maxDisplayedBpPerPx')
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
      self.error = e
    },

    setScrollTop(scrollTop: number) {
      self.scrollTop = scrollTop
    },

    setShowAbout(show: boolean) {
      self.showAbout = show
    },
    // sets the new bpPerPxLimit if user chooses to force load
    setUserBpPerPxLimit(limit: number) {
      self.userBpPerPxLimit = limit
    },
    // base track reload does nothing, see specialized tracks for details
    reload() {},
  }))
  .views(self => ({
    /**
     * @param region -
     * @returns falsy if the region is fine to try rendering. Otherwise,
     *  return a react node + string of text.
     *  string of text describes why it cannot be rendered
     *  react node allows user to force load at current setting
     */
    regionCannotBeRendered(/* region */) {
      const view = getContainingView(self) as LinearGenomeViewModel
      if (view && view.bpPerPx > self.maxViewBpPerPx) {
        return (
          <>
            <Typography component="span" variant="body2">
              Zoom in to see features or{' '}
            </Typography>
            <Button
              data-testid="reload_button"
              onClick={() => {
                self.setUserBpPerPxLimit(view.bpPerPx)
                self.reload()
              }}
              size="small"
              variant="outlined"
            >
              Force Load
            </Button>
            <Typography component="span" variant="body2">
              (force load may be slow)
            </Typography>
          </>
        )
      }
      return undefined
    },

    // distinct set of track items that are particular to this track type for
    // base, there are none
    //
    // note: this attribute is helpful when composing together multiple
    // subtracks so that you don't repeat the "about this track" from each
    // child track
    get composedTrackMenuItems(): MenuItem[] {
      return []
    },
  }))

export const BaseTrackConfig = generateBaseTrackConfig(BaseTrack)

const BaseTrackWithReferences = types
  .compose(
    BaseTrack,
    types.model({
      configuration: BaseTrackConfig,
    }),
  )
  .actions(self => ({
    activateConfigurationUI() {
      const session = getSession(self)
      const view = getContainingView(self)
      if (isSessionModelWithConfigEditing(session)) {
        // @ts-ignore
        const newTrackConf = session.editTrackConfiguration(self.configuration)
        if (newTrackConf && newTrackConf !== self.configuration) {
          // @ts-ignore
          view.hideTrack(self.configuration)
          // @ts-ignore
          view.showTrack(newTrackConf)
        }
      }
    },
  }))
  .views(self => ({
    get canConfigure() {
      const session = getSession(self)
      return (
        isSessionModelWithConfigEditing(session) &&
        // @ts-ignore
        (session.adminMode ||
          // @ts-ignore
          session.sessionTracks.find(track => {
            return track.trackId === self.configuration.trackId
          }))
      )
    },
    get trackMenuItems(): MenuItem[] {
      return [
        {
          label: 'About this track',
          icon: InfoIcon,
          onClick: () => {
            self.setShowAbout(true)
          },
        },
      ]
    },
  }))

export type BaseTrackStateModel = typeof BaseTrackWithReferences
export type BaseTrackModel = Instance<BaseTrackStateModel>
export default BaseTrackWithReferences
