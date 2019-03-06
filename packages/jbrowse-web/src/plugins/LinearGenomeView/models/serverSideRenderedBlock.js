import {
  types,
  getParent,
  isAlive,
  getRoot,
  addDisposer,
} from 'mobx-state-tree'

import { reaction } from 'mobx'
import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'
import {
  assembleLocString,
  checkAbortSignal,
  isAbortException,
} from '../../../util'
import { getContainingView } from '../../../util/tracks'

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self) {
  const track = getParent(self, 2)
  const view = getContainingView(track)
  const { rpcManager } = getRoot(view)
  const renderProps = { ...track.renderProps }
  const { rendererType } = track

  return {
    rendererType,
    rpcManager,
    renderProps,
    renderArgs: {
      region: self.region,
      adapterType: track.adapterType.name,
      adapterConfig: getConf(track, 'adapter'),
      rendererType: rendererType.name,
      renderProps,
      sessionId: track.id,
      timeout: 1000000, // 10000,
    },
  }
}
async function renderBlockEffect(
  self,
  { rendererType, renderProps, rpcManager, renderArgs },
) {
  // console.log(getContainingView(self).rendererType)
  if (renderProps.notReady) return
  if (!isAlive(self)) return
  if (self.renderInProgress) self.renderInProgress.abort()
  const aborter = new AbortController()
  self.setLoading(aborter)
  try {
    renderArgs.signal = aborter.signal
    const callId = [
      assembleLocString(renderArgs.region),
      renderArgs.rendererType,
    ]
    const { html, ...data } = await rendererType.renderInClient(
      rpcManager,
      renderArgs,
    )
    if (aborter.signal.aborted) {
      console.log(...callId, 'request to abort render was ignored', html, data)
    }
    checkAbortSignal(aborter.signal)
    self.setRendered(data, html, rendererType.ReactComponent, renderProps)
  } catch (error) {
    if (isAbortException(error)) return
    console.error(error)
    if (isAlive(self)) self.setError(error)
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
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    filled: false,
    data: undefined,
    html: '',
    error: undefined,
    reactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined,
    renderProps: undefined,
    renderInProgress: undefined,
  }))
  .actions(self => ({
    afterAttach() {
      const track = getContainingView(self)
      const renderDisposer = reaction(
        () => renderBlockData(self),
        data => renderBlockEffect(self, data),
        {
          name: `${track.id}/${assembleLocString(self.region)} rendering`,
          delay: track.renderDelay,
          fireImmediately: true,
        },
      )
      addDisposer(self, renderDisposer)
    },
    setLoading(abortController) {
      if (self.renderInProgress) self.renderInProgress.abort()
      self.filled = false
      self.html = ''
      self.data = undefined
      self.error = undefined
      self.renderInProgress = abortController
    },
    setRendered(data, html, renderingComponent, renderProps) {
      self.filled = true
      self.data = data
      self.html = html
      self.renderingComponent = renderingComponent
      self.renderProps = renderProps
    },
    setError(error) {
      if (self.renderInProgress) self.renderInProgress.abort()
      // the rendering failed for some reason
      self.error = error
      self.renderInProgress = undefined
      self.data = undefined
      self.filled = false
      self.html = ''
    },
    beforeDestroy() {
      if (self.renderInProgress) self.renderInProgress.abort()
    },
  }))
