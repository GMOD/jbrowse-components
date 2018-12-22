import { types, getParent, isAlive } from 'mobx-state-tree'

import { autorun } from 'mobx'
import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlock(self) {
  // console.log(getParent(self, 2).rendererType)
  if (!isAlive(self)) return
  self.filled = false
  self.html = ''
  self.data = undefined
  self.error = undefined
  try {
    const track = getParent(self, 2)
    const view = getParent(track, 2)
    const root = getParent(view, 2)
    // console.log('calling', self.region.toJSON())
    track.rendererType
      .renderInClient(root.app, {
        region: self.region,
        adapterType: track.adapterType.name,
        adapterConfig: getConf(track, 'adapter'),
        rendererType: track.rendererTypeName,
        renderProps: self.renderProps,
        sessionId: track.id,
        timeout: 10000,
      })
      .then(({ html, ...data }) => {
        if (!isAlive(self)) return
        self.setRendered(data, html)
      })
      .catch(self.setError)
  } catch (error) {
    self.setError(error)
  }
}

// the MST state of a single server-side-rendered block in a track
export default types
  .model('BlockState', {
    key: types.string,
    region: Region,
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
  })
  .volatile(() => ({
    filled: false,
    data: undefined,
    reactComponent: ServerSideRenderedBlockContent,
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
  .actions(self => {
    let renderDisposer
    return {
      afterAttach() {
        renderDisposer = autorun(() => renderBlock(self))
      },
      setRendered(data, html) {
        self.filled = true
        self.data = data
        self.html = html
      },
      setError(error) {
        // the rendering failed for some reason
        console.error(error)
        self.error = error
      },
      beforeDetach() {
        if (renderDisposer) {
          renderDisposer()
          renderDisposer = undefined
        }
      },
      beforeDestroy() {
        if (renderDisposer) {
          renderDisposer()
          renderDisposer = undefined
        }
      },
    }
  })
