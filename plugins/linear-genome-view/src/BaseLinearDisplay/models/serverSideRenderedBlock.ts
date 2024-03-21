/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  types,
  getParent,
  isAlive,
  cast,
  Instance,
  getSnapshot,
} from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocString,
  getSession,
  getContainingDisplay,
  getContainingView,
  getViewParams,
  makeAbortableReaction,
  Feature,
} from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types/mst'
import {
  AbstractDisplayModel,
  isRetryException,
} from '@jbrowse/core/util/types'

import {
  getTrackAssemblyNames,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'

// locals
import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// the MST state of a single server-side-rendered block in a display
const blockState = types
  .model('BlockState', {
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
    key: types.string,
    region: Region,
    reloadFlag: 0,
  })
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    ReactComponent: ServerSideRenderedBlockContent,
    error: undefined as unknown,
    features: undefined as Map<string, Feature> | undefined,
    filled: false,
    layout: undefined as any,
    maxHeightReached: false,
    message: undefined as string | undefined,
    reactElement: undefined as React.ReactElement | undefined,
    renderInProgress: undefined as AbortController | undefined,
    renderProps: undefined as any,
    status: '',
  }))
  .actions(self => {
    let renderInProgress: undefined | AbortController
    return {
      afterAttach() {
        const display = getContainingDisplay(self)
        setTimeout(() => {
          if (isAlive(self)) {
            makeAbortableReaction(
              self as any,
              renderBlockData,
              renderBlockEffect, // reaction doesn't expect async here
              {
                delay: display.renderDelay,
                fireImmediately: true,
                name: `${display.id}/${assembleLocString(
                  self.region,
                )} rendering`,
              },
              this.setLoading,
              this.setRendered,
              this.setError,
            )
          }
        }, display.renderDelay)
      },
      beforeDestroy() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            if (renderInProgress && !renderInProgress.signal.aborted) {
              renderInProgress.abort()
            }
            const display = getContainingDisplay(self)
            const { rpcManager } = getSession(self)
            const { rendererType } = display
            const { renderArgs } = renderBlockData(cast(self))
            // renderArgs can be undefined if an error occurred in this block
            if (renderArgs) {
              await rendererType.freeResourcesInClient(
                rpcManager,
                JSON.parse(JSON.stringify(renderArgs)),
              )
            }
          } catch (e) {
            console.error('Error while destroying block', e)
          }
        })()
      },
      doReload() {
        self.reloadFlag = self.reloadFlag + 1
      },
      reload() {
        self.renderInProgress = undefined
        self.filled = false
        self.reactElement = undefined
        self.features = undefined
        self.layout = undefined
        self.error = undefined
        self.message = undefined
        self.maxHeightReached = false
        self.ReactComponent = ServerSideRenderedBlockContent
        self.renderProps = undefined
        getParent<any>(self, 2).reload()
      },
      setError(error: unknown) {
        console.error(error)
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.reactElement = undefined
        self.features = undefined
        self.layout = undefined
        self.maxHeightReached = false
        self.error = error
        self.renderProps = undefined
        renderInProgress = undefined
        if (isRetryException(error as Error)) {
          this.reload()
        }
      },
      setLoading(abortController: AbortController) {
        if (
          renderInProgress !== undefined &&
          !renderInProgress.signal.aborted
        ) {
          renderInProgress.abort()
        }
        self.filled = false
        self.message = undefined
        self.reactElement = undefined
        self.features = undefined
        self.layout = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderProps = undefined
        renderInProgress = abortController
      },
      setMessage(messageText: string) {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        self.filled = false
        self.message = messageText
        self.reactElement = undefined
        self.features = undefined
        self.layout = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderProps = undefined
        renderInProgress = undefined
      },
      setRendered(
        props:
          | {
              reactElement: React.ReactElement
              features: Map<string, Feature>
              layout: any
              maxHeightReached: boolean
              renderProps: any
            }
          | undefined,
      ) {
        if (!props) {
          return
        }
        const {
          reactElement,
          features,
          layout,
          maxHeightReached,
          renderProps,
        } = props
        self.filled = true
        self.message = undefined
        self.reactElement = reactElement
        self.features = features
        self.layout = layout
        self.error = undefined
        self.maxHeightReached = maxHeightReached
        self.renderProps = renderProps
        renderInProgress = undefined
      },
      setStatus(message: string) {
        self.status = message
      },
    }
  })

export default blockState
export type BlockStateModel = typeof blockState
export type BlockModel = Instance<BlockStateModel>

// calls the render worker to render the block content not using a flow for
// this, because the flow doesn't work with autorun
export function renderBlockData(
  self: BlockModel,
  optDisplay?: AbstractDisplayModel,
) {
  try {
    const display = optDisplay || (getContainingDisplay(self) as any)
    const { assemblyManager, rpcManager } = getSession(display)
    const { adapterConfig, rendererType, error, parentTrack } = display
    const assemblyNames = getTrackAssemblyNames(parentTrack)
    const regionAsm = self.region.assemblyName
    if (
      !assemblyNames.includes(regionAsm) &&
      !assemblyNames.some(name => assemblyManager.get(name)?.hasName(regionAsm))
    ) {
      throw new Error(
        `region assembly (${regionAsm}) does not match track assemblies (${assemblyNames})`,
      )
    }

    const renderProps = display.renderProps()
    const { config } = renderProps

    // This line is to trigger the mobx reaction when the config changes
    // It won't trigger the reaction if it doesn't think we're accessing it
    readConfObject(config)

    const sessionId = getRpcSessionId(display)
    const layoutId = getContainingView(display).id
    const cannotBeRenderedReason = display.regionCannotBeRendered(self.region)

    return {
      cannotBeRenderedReason,
      displayError: error,
      renderArgs: {
        adapterConfig,
        assemblyName: self.region.assemblyName,
        blockKey: self.key,
        layoutId,
        regions: [getSnapshot(self.region)],
        reloadFlag: self.reloadFlag,
        rendererType: rendererType.name,
        sessionId,
        statusCallback: (message: string) => {
          if (isAlive(self)) {
            self.setStatus(message)
          }
        },
        timeout: 1000000, // 10000,
      },
      renderProps,
      rendererType,
      rpcManager,
    }
  } catch (e) {
    return { displayError: e }
  }
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
  signal: AbortSignal,
  self: BlockModel,
) {
  if (!props) {
    return
  }
  const {
    rendererType,
    renderProps,
    rpcManager,
    renderArgs,
    cannotBeRenderedReason,
    displayError,
  } = props
  if (!isAlive(self)) {
    return undefined
  }

  if (displayError) {
    self.setError(displayError)
    return undefined
  }
  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  }

  if (renderProps.notReady) {
    return undefined
  }

  const { reactElement, features, layout, maxHeightReached } =
    await rendererType.renderInClient(rpcManager, {
      ...renderArgs,
      ...renderProps,
      signal,
      viewParams: getViewParams(self),
    })
  return {
    features,
    layout,
    maxHeightReached,
    reactElement,
    renderProps,
  }
}
