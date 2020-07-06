/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, getParent, isAlive, cast, Instance } from 'mobx-state-tree'
import { Component } from 'react'
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { Region } from '@gmod/jbrowse-core/util/types/mst'

import {
  assembleLocString,
  makeAbortableReaction,
  getSession,
} from '@gmod/jbrowse-core/util'
import {
  getTrackAssemblyNames,
  getRpcSessionId,
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
  .volatile(() => ({
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
        const track = getParent<any>(self, 2)
        makeAbortableReaction(
          self as any,
          renderBlockData,
          renderBlockEffect as any, // reaction doesn't expect async here
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
      setRendered(
        props:
          | {
              data: any
              html: any
              maxHeightReached: boolean
              renderingComponent: Component
              renderProps: any
            }
          | undefined,
      ) {
        if (!props) {
          return
        }
        const {
          data,
          html,
          maxHeightReached,
          renderingComponent,
          renderProps,
        } = props
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
        getParent(self, 2).reload()
      },
      beforeDestroy() {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        const track = getParent(self, 2)
        const { rpcManager } = getSession(self)
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
export type BlockModel = Instance<BlockStateModel>
// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self: Instance<BlockStateModel>) {
  try {
    const { assemblyManager, rpcManager } = getSession(self)
    const track = getParent(self, 2)
    const assemblyNames = getTrackAssemblyNames(track)
    let cannotBeRenderedReason
    if (!assemblyNames.includes(self.region.assemblyName)) {
      let matchFound = false
      assemblyNames.forEach((assemblyName: string) => {
        const assembly = assemblyManager.get(assemblyName)
        if (assembly && assembly.aliases.includes(self.region.assemblyName))
          matchFound = true
      })
      if (!matchFound) {
        cannotBeRenderedReason = `region assembly (${self.region.assemblyName}) does not match track assemblies (${assemblyNames})`
      }
    }
    if (!cannotBeRenderedReason)
      cannotBeRenderedReason = track.regionCannotBeRendered(self.region)
    const { renderProps } = track
    const { rendererType } = track
    const { config } = renderProps
    // This line is to trigger the mobx reaction when the config changes
    // It won't trigger the reaction if it doesn't think we're accessing it
    readConfObject(config)

    const adapterConfig = getConf(track, 'adapter')

    const sessionId = getRpcSessionId(track)

    return {
      rendererType,
      rpcManager,
      renderProps,
      cannotBeRenderedReason,
      trackError: track.error,
      renderArgs: {
        assemblyName: self.region.assemblyName,
        regions: [self.region],
        adapterConfig,
        rendererType: rendererType.name,
        renderProps,
        sessionId,
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
    renderArgs,
    cannotBeRenderedReason,
    trackError,
  } = props as RenderProps
  if (!isAlive(self)) {
    return undefined
  }

  if (trackError) {
    self.setError(trackError)
  }
  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  }

  if (renderProps.notReady) {
    return undefined
  }

  const { html, maxHeightReached, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderArgs,
  )
  return {
    data,
    html,
    maxHeightReached,
    renderingComponent: rendererType.ReactComponent,
    renderProps,
  }
}
