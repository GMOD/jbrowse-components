/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  types,
  getParent,
  isAlive,
  addDisposer,
  cast,
  Instance,
  getSnapshot,
} from 'mobx-state-tree'
import { Component } from 'react'
import { reaction } from 'mobx'
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'

import { Region } from '@gmod/jbrowse-core/mst-types'

import {
  assembleLocString,
  checkAbortSignal,
  isAbortException,
  getSession,
} from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getTrackAssemblyName,
} from '@gmod/jbrowse-core/util/tracks'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// the MST state of a single server-side-rendered block in a track
const blockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
  })
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(self => ({
    renderInProgress: undefined as AbortController | undefined,
    filled: false,
    data: undefined as any,
    html: '',
    error: undefined as string | undefined,
    message: undefined as string | undefined,
    maxHeightReached: false,
    ReactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined as any,
    renderProps: undefined as any,
  }))
  .actions(self => {
    let renderInProgress: undefined | AbortController
    return {
      afterAttach() {
        const track = getParent(self, 2)
        const renderDisposer = reaction(
          () => renderBlockData(self as any),
          data => renderBlockEffect(cast(self), data),
          {
            name: `${track.id}/${assembleLocString(self.region)} rendering`,
            delay: track.renderDelay,
            fireImmediately: true,
          },
        )
        addDisposer(self, renderDisposer)
      },
      setLoading(abortController: AbortController) {
        if (renderInProgress !== undefined) {
          if (!renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
        }
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = abortController
      },
      setMessage(messageText: string) {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        self.filled = false
        self.message = messageText
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = undefined
      },
      setRendered(
        data: any,
        html: any,
        maxHeightReached: boolean,
        renderingComponent: Component,
        renderProps: any,
      ) {
        self.filled = true
        self.message = undefined
        self.html = html
        self.data = data
        self.error = undefined
        self.maxHeightReached = maxHeightReached
        self.renderingComponent = renderingComponent
        self.renderProps = renderProps
        renderInProgress = undefined
      },
      setError(error: string) {
        console.error(error)
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.maxHeightReached = false
        self.error = error
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = undefined
      },
      reload() {
        self.renderInProgress = undefined
        self.filled = false
        self.data = undefined
        self.html = ''
        self.error = undefined
        self.message = undefined
        self.maxHeightReached = false
        self.ReactComponent = ServerSideRenderedBlockContent
        self.renderingComponent = undefined
        self.renderProps = undefined
        const data = renderBlockData(self as any)
        renderBlockEffect(cast(self), data)
      },
      beforeDestroy() {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        const track = getParent(self, 2)
        const view = getContainingView(track)
        const { rpcManager } = getSession(view) as any
        const { rendererType } = track
        const { renderArgs } = renderBlockData(cast(self))
        rendererType.freeResourcesInClient(
          rpcManager,
          JSON.parse(JSON.stringify(renderArgs)),
        )
      },
    }
  })

export default blockState
export type BlockStateModel = typeof blockState

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self: Instance<BlockStateModel>) {
  const track = getParent(self, 2)
  const view = getContainingView(track)
  const { rpcManager } = getSession(view) as any

  const assemblyName = getTrackAssemblyName(track)

  const { assemblyData } = getSession(self) as any
  const trackAssemblyData =
    (assemblyData && assemblyData.get(assemblyName)) || {}
  const trackAssemblyAliases = trackAssemblyData.aliases || []
  let cannotBeRenderedReason
  if (
    !(
      assemblyName === self.region.assemblyName ||
      trackAssemblyAliases.includes(self.region.assemblyName)
    )
  )
    cannotBeRenderedReason = 'region assembly does not match track assembly'
  else cannotBeRenderedReason = track.regionCannotBeRendered(self.region)
  const { renderProps } = track
  const { rendererType } = track
  const { config } = renderProps
  // This line is to trigger the mobx reaction when the config changes
  // It won't trigger the reaction if it doesn't think we're accessing it
  readConfObject(config)

  let sequenceConfig: { type?: string } = {}
  if (trackAssemblyData.sequence) {
    sequenceConfig = getSnapshot(trackAssemblyData.sequence.adapter)
  }

  return {
    rendererType,
    rpcManager,
    renderProps,
    cannotBeRenderedReason,
    trackError: track.error,
    renderArgs: {
      assemblyName,
      region: self.region,
      adapterType: track.adapterType.name,
      adapterConfig: getConf(track, 'adapter'),
      sequenceAdapterType: sequenceConfig.type,
      sequenceAdapterConfig: sequenceConfig,
      rendererType: rendererType.name,
      renderProps,
      sessionId: track.id,
      timeout: 1000000, // 10000,
    },
  }
}

interface RenderProps {
  trackError: string
  rendererType: any
  renderProps: { [key: string]: any }
  rpcManager: { call: Function }
  cannotBeRenderedReason: string
  renderArgs: { [key: string]: any }
}

async function renderBlockEffect(
  self: Instance<BlockStateModel>,
  props: RenderProps,
  allowRefetch = true,
) {
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
    const {
      html,
      maxHeightReached,
      ...data
    } = await rendererType.renderInClient(rpcManager, renderArgs)
    // if (aborter.signal.aborted) {
    //   console.log(...callId, 'request to abort render was ignored', html, data)
    checkAbortSignal(aborter.signal)
    self.setRendered(
      data,
      html,
      maxHeightReached,
      rendererType.ReactComponent,
      renderProps,
    )
  } catch (error) {
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
