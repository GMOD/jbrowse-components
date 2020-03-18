/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, getParent, cast, Instance, getSnapshot } from 'mobx-state-tree'
import { Component } from 'react'
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import jsonStableStringify from 'json-stable-stringify'
import { Region } from '@gmod/jbrowse-core/mst-types'

import {
  assembleLocString,
  checkAbortSignal,
  getSession,
  makeAbortableReaction,
} from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getTrackAssemblyNames,
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
    error: undefined as Error | undefined,
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
        makeAbortableReaction(
          self,
          'render',
          renderBlockData as any,
          renderBlockEffect as any,
          {
            name: `${track.id}/${assembleLocString(self.region)} rendering`,
            delay: track.renderDelay,
            fireImmediately: true,
          },
          this.setLoading,
          this.setRendered,
          this.setError,
        )
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
      setRendered(args: {
        data: any
        html: any
        maxHeightReached: boolean
        renderingComponent: Component
        renderProps: any
      }) {
        const {
          data,
          html,
          maxHeightReached,
          renderingComponent,
          renderProps,
        } = args
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
      setError(error: Error) {
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
        if (renderInProgress) {
          renderInProgress.abort()
        }
        const aborter = new AbortController()
        this.setLoading(aborter)
        renderBlockEffect(data, aborter.signal, cast(self))
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
        rendererType
          .freeResourcesInClient(
            rpcManager,
            JSON.parse(JSON.stringify(renderArgs)),
          )
          .catch((e: Error) => {
            // just console.error if it's something while it's being destroyed
            console.warn('Error while destroying block', e)
          })
      },
    }
  })

export default blockState
export type BlockStateModel = typeof blockState

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self: Instance<BlockStateModel>) {
  try {
    const { assemblyData, rpcManager } = getSession(self) as any
    const track = getParent(self, 2)
    const assemblyNames = getTrackAssemblyNames(track)
    let cannotBeRenderedReason
    if (!assemblyNames.includes(self.region.assemblyName)) {
      let matchFound = false
      assemblyNames.forEach((assemblyName: string) => {
        const trackAssemblyData =
          (assemblyData && assemblyData.get(assemblyName)) || {}
        const trackAssemblyAliases = trackAssemblyData.aliases || []
        if (trackAssemblyAliases.includes(self.region.assemblyName))
          matchFound = true
      })
      if (!matchFound) {
        cannotBeRenderedReason = `region assembly (${self.region.assemblyName}) does not match track assemblies (${assemblyNames})`
      }
    }
    if (!cannotBeRenderedReason)
      cannotBeRenderedReason = track.regionCannotBeRendered(self.region)
    const trackAssemblyData =
      (assemblyData && assemblyData.get(self.region.assemblyName)) || {}
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
    const adapterConfig = getConf(track, 'adapter')
    // Only subtracks will have parent tracks with configs
    // They use parent's adapter config for matching sessionId
    const parentTrack = getParent(track)
    const adapterConfigId = parentTrack.configuration
      ? jsonStableStringify(getConf(parentTrack, 'adapter'))
      : jsonStableStringify(adapterConfig)

    return {
      rendererType,
      rpcManager,
      renderProps,
      cannotBeRenderedReason,
      trackError: track.error,
      renderArgs: {
        assemblyName: self.region.assemblyName,
        region: getSnapshot(self.region),
        adapterType: track.adapterType.name,
        adapterConfig,
        sequenceAdapterType: sequenceConfig.type,
        sequenceAdapterConfig: sequenceConfig,
        rendererType: rendererType.name,
        renderProps,
        sessionId: adapterConfigId,
        blockKey: self.key,
        timeout: 1000000, // 10000,
      },
    }
  } catch (error) {
    return {
      trackError: error,
    }
  }
}

interface RenderProps {
  trackError: Error
  rendererType: any
  renderProps: { [key: string]: any }
  rpcManager: { call: Function }
  cannotBeRenderedReason: string
  renderArgs: { [key: string]: any }
}

interface ErrorProps {
  trackError: string
}

async function renderBlockEffect(
  props: RenderProps | ErrorProps,
  signal: AbortSignal,
  self: Instance<BlockStateModel>,
) {
  const {
    rendererType,
    renderProps,
    rpcManager,
    cannotBeRenderedReason,
    renderArgs,
  } = props as RenderProps

  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  }

  renderArgs.signal = signal
  const { html, maxHeightReached, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderArgs,
  )
  checkAbortSignal(signal)
  return {
    data,
    html,
    maxHeightReached,
    renderingComponent: rendererType.ReactComponent,
    renderProps,
  }
}
