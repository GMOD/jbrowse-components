import React from 'react'
import {
  types,
  getSnapshot,
  getParent,
  getRoot,
  onPatch,
  flow,
} from 'mobx-state-tree'

import { autorun } from 'mobx'
import Plugin, { TrackType } from '../../Plugin'
import {
  ConfigurationSchema,
  ConfigurationReference,
  getConf,
} from '../../configuration'
import {
  BaseTrack as LinearGenomeTrack,
  BaseTrackConfig as LinearGenomeTrackConfig,
} from '../LinearGenomeView/models/model'
import AlignmentsTrack, {
  AlignmentsTrackBlock,
} from './components/AlignmentsTrack'

import { Region } from '../../mst-types'
import { renderRegionWithWorker } from '../../render'
import pileupRenderer from './pileupRenderer'

function delay(time) {
  return new Promise((resolve, reject) => {
    window.setTimeout(resolve, time)
  })
}

const BlockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
    data: types.frozen(),
  })
  .volatile(self => ({
    alive: true,
    filled: false,
    reactComponent: AlignmentsTrackBlock,
    html: '',
    error: undefined,
  }))
  .views(self => ({
    get rendererType() {
      const { pluginManager } = getRoot(self)
      const track = getParent(self, 2)
      const RendererType = pluginManager.getRendererType(track.rendererType)
      if (!RendererType)
        throw new Error(`renderer "${track.rendererType} not found`)
      if (!RendererType.ReactComponent)
        throw new Error(
          `renderer ${
            track.rendererType
          } has no ReactComponent, it may not be completely implemented yet`,
        )
      return RendererType

      // const html = renderToString(
      //   <RendererType.ReactComponent data={features} {...renderProps} />,
      // )
    },

    get renderProps() {
      return {}
    },
  }))
  .actions(self => ({
    afterAttach() {
      self.render()
    },
    render: flow(function* renderBlock() {
      const track = getParent(self, 2)
      const view = getParent(track, 2)
      const root = getParent(view, 2)
      try {
        // console.log('calling', self.region.toJSON())
        const { features, html } = yield renderRegionWithWorker(
          root.pluginManager,
          {
            region: self.region,
            adapterType: track.adapterType.name,
            adapterConfig: getConf(track, 'adapter'),
            rendererType: track.rendererType,
            renderProps: {},
            sessionId: track.id,
            timeout: 10000,
          },
        )
        if (!self.alive) return
        self.filled = true
        self.data = features
        self.html = html
        // console.log('finished', self.region.toJSON(), self.html)
      } catch (error) {
        // the rendering failed for some reason
        console.error(error)
        self.error = error
      }
    }),
    beforeDetach() {
      self.alive = false
    },
    beforeDestroy() {
      self.alive = false
    },
  }))

const BlockBasedTrackState = types.compose(
  'BlockBasedTrackState',
  LinearGenomeTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .actions(self => {
      let blockWatchDisposer
      return {
        afterAttach() {
          const view = getParent(self, 2)
          // watch the parent's blocks to update our block state when they change
          blockWatchDisposer = autorun(() => {
            // create any blocks that we need to create
            const blocksPresent = {}
            view.blocks.forEach(block => {
              blocksPresent[block.key] = true
              if (!self.blockState.has(block.key))
                self.blockState.set(
                  block.key,
                  BlockState.create({
                    key: block.key,
                    region: block,
                  }),
                )
            })
            // delete any blocks we need to delete
            self.blockState.forEach((value, key) => {
              if (!blocksPresent[key]) self.blockState.delete(key)
            })
          })
        },
        beforeDetach() {
          if (blockWatchDisposer) blockWatchDisposer()
        },
      }
    }),
)

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'AlignmentsTrack',
        {
          adapter: types.union(
            ...pluginManager.getElementTypeMembers('adapter', 'configSchema'),
          ),
          defaultView: {
            type: 'string',
            defaultValue: 'pileup',
          },
        },
        { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
      )

      const stateModel = types.compose(
        'AlignmentsTrack',
        BlockBasedTrackState,
        types
          .model({
            type: types.literal('AlignmentsTrack'),
            configuration: ConfigurationReference(configSchema),
            // the renderer that the user has selected in the UI, empty string
            // if they have not made any selection
            selectedView: types.optional(types.string, ''),
          })
          .volatile(self => ({
            reactComponent: AlignmentsTrack,
          }))
          // .actions(self => ({
          //   afterAttach() {
          //     onPatch(self, patch => {
          //       console.log('patch', self.name, patch)
          //     })
          //   },
          // }))
          .views(self => ({
            // the renderer type is based on the "view" selected in the UI: pileup, coverage, etc
            get rendererType() {
              const defaultView = getConf(self, 'defaultView')
              const viewName = self.selectedView || defaultView
              const rendererType = { pileup: 'PileupRenderer' }[viewName]
              if (!rendererType)
                throw new Error(`unknown alignments view name ${viewName}`)
              return rendererType
            },

            get adapterType() {
              const adapterConfig = getConf(self, 'adapter')
              if (!adapterConfig)
                throw new Error(
                  `no adapter configuration provided for ${self.type}`,
                )
              const adapterType = pluginManager.getAdapterType(
                adapterConfig.type,
              )
              if (!adapterType)
                throw new Error(`unknown adapter type ${adapterConfig.type}`)
              return adapterType
            },

            get adapter() {
              // TODO: refactor this someplace else to make this code shareable
              const adapter = new self.adapterType.AdapterClass(
                getSnapshot(self.configuration.adapter),
              )
              return adapter
            },
          })),
      )

      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel,
        RenderingComponent: AlignmentsTrack,
      })
    })

    pluginManager.addRendererType(pileupRenderer)
  }
}
