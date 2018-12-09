import { types, getParent, getRoot, flow, isAlive } from 'mobx-state-tree'

import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'
import { renderRegionWithWorker } from '../../../render'

import { AlignmentsTrackBlock } from '../components/AlignmentsTrack'

// the MST state of a single server-side-rendered block in a track
export default types
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
