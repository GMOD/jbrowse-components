/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  cast,
  getSnapshot,
  getParent,
  isAlive,
  types,
  Instance,
} from 'mobx-state-tree'
import clone from 'clone'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocStringFast,
  getSession,
  getContainingDisplay,
  getContainingView,
  getViewParams,
  isRetryException,
  makeAbortableReaction,
  AbstractDisplayModel,
  Feature,
} from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types/mst'

import {
  getTrackAssemblyNames,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'

// locals
import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// the MST state of a single server-side-rendered block in a display
const blockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
    reloadFlag: 0,
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
  })
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    destroyed: false,
    filled: false,
    reactElement: undefined as React.ReactElement | undefined,
    features: undefined as Map<string, Feature> | undefined,
    layout: undefined as any,
    status: '',
    error: undefined as unknown,
    message: undefined as string | undefined,
    maxHeightReached: false,
    ReactComponent: ServerSideRenderedBlockContent,
  }))
  .actions(self => ({
    doReload() {
      self.reloadFlag = self.reloadFlag + 1
    },
    afterAttach() {
      const { id, renderDelay } = getContainingDisplay(self)
      // added after renderDelay to optimize some dynamicBlocks usage
      setTimeout(() => {
        if (self.destroyed) {
          return
        }
        makeAbortableReaction(
          self as any,
          renderBlockData,
          renderBlockEffect,
          {
            name: `${id}/${assembleLocStringFast(self.region)} rendering`,
            delay: renderDelay,
            fireImmediately: true,
          },
          () => this.setLoading(),
          () => {
            /* do nothing, handled by actions of renderBlockEffect */
          },
          e => this.setError(e),
        )
      }, renderDelay)
    },
    setStatus(message: string) {
      self.status = message
    },
    setLoading() {
      self.filled = false
      self.message = undefined
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.error = undefined
      self.maxHeightReached = false
    },
    setMessage(messageText: string) {
      self.filled = false
      self.message = messageText
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.error = undefined
      self.maxHeightReached = false
    },

    setRendered({
      layout,
      features,
      reactElement,
      maxHeightReached,
    }: {
      reactElement: React.ReactElement
      features: Map<string, Feature>
      layout: any
      maxHeightReached: boolean
    }) {
      self.filled = true
      self.message = undefined
      self.reactElement = reactElement
      self.features = features
      self.layout = layout
      self.error = undefined
      self.maxHeightReached = maxHeightReached
    },
    setError(error: unknown) {
      console.error(error)
      // the rendering failed for some reason
      self.filled = false
      self.message = undefined
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.maxHeightReached = false
      self.error = error
      if (isRetryException(error as Error)) {
        this.reload()
      }
    },
    reload() {
      self.filled = false
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.error = undefined
      self.message = undefined
      self.maxHeightReached = false
      getParent<any>(self, 2).reload()
    },
    beforeDestroy() {
      self.destroyed = true
      const display = getContainingDisplay(self)
      const { rpcManager } = getSession(self)
      const { rendererType } = display
      const { renderArgs } = renderBlockData(cast(self))
      // renderArgs can be undefined if an error occurred in this block
      rendererType
        ?.freeResourcesInClient(rpcManager, clone(renderArgs))
        .catch((e: Error) => {
          // just console.error if it's something while it's being destroyed
          console.warn('Error while destroying block', e)
        })
    },
  }))

export default blockState
export type BlockStateModel = typeof blockState
export type BlockModel = Instance<BlockStateModel>

// calls the render worker to render the block content not using a flow for
// this, because the flow doesn't work with autorun
export function renderBlockData(
  self: BlockModel,
  optDisplay?: AbstractDisplayModel,
) {
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
    rendererType,
    rpcManager,
    renderProps,
    cannotBeRenderedReason,
    displayError: error,
    renderArgs: {
      statusCallback: (message: string) => {
        if (isAlive(self)) {
          self.setStatus(message)
        }
      },
      assemblyName: self.region.assemblyName,
      regions: [getSnapshot(self.region)],
      adapterConfig,
      rendererType: rendererType.name,
      sessionId,
      layoutId,
      blockKey: self.key,
      reloadFlag: self.reloadFlag,
      timeout: 1000000,
    },
  } as const
}

export async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
  signal: AbortSignal,
  block: BlockModel,
) {
  if (!props) {
    return undefined
  }
  const {
    rendererType,
    renderProps,
    rpcManager,
    renderArgs,
    cannotBeRenderedReason,
    displayError,
  } = props

  if (props.displayError) {
    block.setError(displayError)
  } else if (cannotBeRenderedReason) {
    block.setMessage(cannotBeRenderedReason)
  } else if (!renderProps.notReady) {
    const res = await rendererType.renderInClient(rpcManager, {
      ...renderArgs,
      ...renderProps,
      viewParams: getViewParams(block),
      signal,
    })
    if (isAlive(block)) {
      block.setRendered(res)
    }
  }

  return undefined
}
