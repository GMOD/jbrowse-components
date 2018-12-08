import {
  types,
  getSnapshot,
  getParent,
  getRoot,
  flow,
  isAlive,
  setLivelinessChecking,
} from 'mobx-state-tree'

import { autorun } from 'mobx'
import { ConfigurationReference, getConf } from '../../configuration'

import { Region } from '../../mst-types'
import { renderRegionWithWorker } from '../../render'

import { BaseTrack as LinearGenomeTrack } from '../LinearGenomeView/models/model'
import AlignmentsTrack, {
  AlignmentsTrackBlock,
} from './components/AlignmentsTrack'

setLivelinessChecking('error')

const BlockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
  })
  .volatile(() => ({
    filled: false,
    data: undefined,
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
    },

    get renderProps() {
      const view = getParent(self, 4) // view -> [tracks] -> [blocks]
      return { bpPerPx: view.bpPerPx }
    },
  }))
  .actions(self => ({
    afterAttach() {
      self.render()
    },
    render: flow(function* renderBlock() {
      if (!isAlive(self)) return
      const track = getParent(self, 2)
      const view = getParent(track, 2)
      const root = getParent(view, 2)
      try {
        // console.log('calling', self.region.toJSON())
        const { html, ...data } = yield renderRegionWithWorker(root.app, {
          region: self.region,
          adapterType: track.adapterType.name,
          adapterConfig: getConf(track, 'adapter'),
          rendererType: track.rendererType,
          renderProps: self.renderProps,
          sessionId: track.id,
          timeout: 10000,
        })
        if (!isAlive(self)) return
        self.filled = true
        self.data = data
        self.html = html
        // console.log('finished', self.region.toJSON(), self.html)
      } catch (error) {
        // the rendering failed for some reason
        console.error(error)
        self.error = error
      }
    }),
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
      function disposeBlockWatch() {
        if (blockWatchDisposer) blockWatchDisposer()
        blockWatchDisposer = undefined
      }
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
        beforeDetach: disposeBlockWatch,
        beforeDestroy: disposeBlockWatch,
      }
    }),
)

export default (pluginManager, configSchema) =>
  types.compose(
    'AlignmentsTrack',
    BlockBasedTrackState,
    types
      .model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedView: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
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
          const adapterType = pluginManager.getAdapterType(adapterConfig.type)
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
