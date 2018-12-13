import { types, getParent, flow, isAlive } from 'mobx-state-tree'

import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'

import { AlignmentsTrackBlock } from '../components/AlignmentsTrack'

// MST flow that calls the render worker to render the block content
export function flowRenderBlock(self) {
  return flow(function* renderBlock() {
    if (!isAlive(self)) return
    const track = getParent(self, 2)
    const view = getParent(track, 2)
    const root = getParent(view, 2)
    try {
      // console.log('calling', self.region.toJSON())
      const { html, ...data } = yield track.rendererType.renderInClient(
        root.app,
        {
          region: self.region,
          adapterType: track.adapterType.name,
          adapterConfig: getConf(track, 'adapter'),
          rendererType: track.rendererTypeName,
          renderProps: self.renderProps,
          sessionId: track.id,
          timeout: 10000,
        },
      )
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
  })
}

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
      const track = getParent(self, 2)
      return track.rendererType
    },

    get renderProps() {
      // view -> [tracks] -> [blocks]
      const track = getParent(self, 2)
      return track.renderProps
    },
  }))
  .actions(self => ({
    afterAttach() {
      self.render()
    },
    render: flowRenderBlock(self),
  }))
