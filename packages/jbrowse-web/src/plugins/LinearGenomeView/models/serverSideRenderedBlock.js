import { types, getParent, isAlive } from 'mobx-state-tree'

import { autorun, reaction } from 'mobx'
import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'
import { assembleLocString } from '../../../util'

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self) {
  const track = getParent(self, 2)
  const view = getParent(track, 2)
  const root = getParent(view, 2)
  const renderProps = { ...track.renderProps }
  const { rendererType } = track

  return {
    rendererType,
    app: root.app,
    renderProps,
    renderArgs: {
      region: self.region,
      adapterType: track.adapterType.name,
      adapterConfig: getConf(track, 'adapter'),
      rendererType: rendererType.name,
      renderProps,
      sessionId: track.id,
      timeout: 10000,
    },
  }
}
function renderBlockEffect(
  self,
  { rendererType, renderProps, app, renderArgs },
) {
  // console.log(getParent(self, 2).rendererType)
  if (!isAlive(self)) return
  self.setLoading()
  try {
    rendererType
      .renderInClient(app, renderArgs)
      .then(({ html, ...data }) => {
        if (!isAlive(self)) return
        self.setRendered(data, html, rendererType.ReactComponent, renderProps)
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
  // NOTE: all this stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    filled: false,
    data: undefined,
    html: '',
    error: undefined,
    reactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined,
    renderProps: undefined,
  }))
  .actions(self => {
    let renderDisposer
    return {
      afterAttach() {
        const track = getParent(self, 2)
        renderDisposer = reaction(
          () => renderBlockData(self),
          data => renderBlockEffect(self, data),
          {
            name: `${track.id}/${assembleLocString(self.region)} rendering`,
            delay: 50,
            fireImmediately: true,
          },
        )
      },
      setLoading() {
        self.filled = false
        self.html = ''
        self.data = undefined
        self.error = undefined
      },
      setRendered(data, html, renderingComponent, renderProps) {
        self.filled = true
        self.data = data
        self.html = html
        self.renderingComponent = renderingComponent
        self.renderProps = renderProps
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
