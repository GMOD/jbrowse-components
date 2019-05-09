import {
  types,
  getParent,
  isAlive,
  getRoot,
  addDisposer,
} from 'mobx-state-tree'

import { reaction } from 'mobx'
import { getConf } from '@gmod/jbrowse-core/configuration'

import { Region } from '@gmod/jbrowse-core/mst-types'

import {
  assembleLocString,
  checkAbortSignal,
  isAbortException,
} from '@gmod/jbrowse-core/util'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self) {
  const track = getParent(self, 2)
  const view = getContainingView(track)
  const { rpcManager } = getRoot(view)
  const renderProps = { ...track.renderProps }
  const { rendererType } = track
  const cannotBeRenderedReason = track.regionCannotBeRendered(self.region)
  return {
    rendererType,
    rpcManager,
    renderProps,
    cannotBeRenderedReason,
    trackError: track.error,
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

async function renderBlockEffect(self, props, allowRefetch = true) {
  const {
    trackError,
    rendererType,
    renderProps,
    rpcManager,
    cannotBeRenderedReason,
    renderArgs,
  } = props
  // console.log(getContainingView(self).rendererType)
  if (!isAlive(self)) return

  if (trackError) {
    self.setError(trackError)
    return
  }
  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return
  }

  const aborter = new AbortController()
  self.setLoading(aborter)
  if (renderProps.notReady) return

  try {
    renderArgs.signal = aborter.signal
    // const callId = [
    //   assembleLocString(renderArgs.region),
    //   renderArgs.rendererType,
    // ]
    const { html, ...data } = await rendererType.renderInClient(
      rpcManager,
      renderArgs,
    )
    // if (aborter.signal.aborted) {
    //   console.log(...callId, 'request to abort render was ignored', html, data)
    // }
    checkAbortSignal(aborter.signal)
    self.setRendered(data, html, rendererType.ReactComponent, renderProps)
  } catch (error) {
    if (!isAbortException(error)) console.error(error)
    if (isAbortException(error) && !aborter.signal.aborted) {
      // there is a bug in the underlying code and something is caching aborts. try to refetch once
      const track = getParent(self, 2)
      if (allowRefetch) {
        console.warn(`cached abort detected, refetching "${track.name}"`)
        renderBlockEffect(self, props, false)
        return
      }
      console.warn(`cached abort detected, failed to recover "${track.name}"`)
    }
    if (isAlive(self) && !isAbortException(error)) {
      // setting the aborted exception as an error will draw the "aborted" error, and we
      // have not found how to create a re-render if this occurs
      self.setError(error)
    }
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
      const track = getParent(self, 2)
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
      if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
        self.renderInProgress.abort()
      }
      self.filled = false
      self.message = undefined
      self.html = ''
      self.data = undefined
      self.error = undefined
      self.renderingComponent = undefined
      self.renderProps = undefined
      self.renderInProgress = abortController
    },
    setMessage(messageText) {
      if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
        self.renderInProgress.abort()
      }
      self.filled = false
      self.message = messageText
      self.html = ''
      self.data = undefined
      self.error = undefined
      self.renderingComponent = undefined
      self.renderProps = undefined
      self.renderInProgress = undefined
    },
    setRendered(data, html, renderingComponent, renderProps) {
      self.filled = true
      self.message = undefined
      self.html = html
      self.data = data
      self.error = undefined
      self.renderingComponent = renderingComponent
      self.renderProps = renderProps
      self.renderInProgress = undefined
    },
    setError(error) {
      if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
        self.renderInProgress.abort()
      }
      // the rendering failed for some reason
      self.filled = false
      self.message = undefined
      self.html = undefined
      self.data = undefined
      self.error = error
      self.renderingComponent = undefined
      self.renderProps = undefined
      self.renderInProgress = undefined
    },
    beforeDestroy() {
      if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
        self.renderInProgress.abort()
      }
    },
  }))
