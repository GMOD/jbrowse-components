import type React from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocString,
  getContainingDisplay,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { isRetryException } from '@jbrowse/core/util/types'
import { getParent, isAlive, types } from '@jbrowse/mobx-state-tree'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent.tsx'

import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { AbstractDisplayModel, Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface RenderedProps {
  reactElement: React.ReactElement
  features: Map<string, Feature>
  layout: any
  maxHeightReached: boolean
  renderProps: any
  renderArgs: Record<string, unknown>
}
// the MST state of a single server-side-rendered block in a display
const blockState = types
  .model('BlockState', {
    /**
     * #property
     */
    key: types.string,
    /**
     * #property
     */
    region: types.frozen<Region>(),
    /**
     * #property
     */
    reloadFlag: 0,
    /**
     * #property
     */
    isLeftEndOfDisplayedRegion: false,
    /**
     * #property
     */
    isRightEndOfDisplayedRegion: false,
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    stopToken: undefined as StopToken | undefined,
    /**
     * #volatile
     */
    filled: false,
    /**
     * #volatile
     */
    reactElement: undefined as React.ReactElement | undefined,
    /**
     * #volatile
     */
    features: undefined as Map<string, Feature> | undefined,
    /**
     * #volatile
     */
    layout: undefined as any,
    /**
     * #volatile
     */
    blockStatusMessage: '',
    /**
     * #volatile
     */
    error: undefined as unknown,
    /**
     * #volatile
     */
    message: undefined as string | undefined,
    /**
     * #volatile
     */
    maxHeightReached: false,
    /**
     * #volatile
     */
    ReactComponent: ServerSideRenderedBlockContent,
    /**
     * #volatile
     */
    renderProps: undefined as any,
    /**
     * #volatile
     */
    renderArgs: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     * Whether a render is currently in flight (but data is not ready yet)
     */
    isRenderingPending: true,
    /**
     * #volatile
     * Cached reference to containing display for performance.
     * Avoids expensive getContainingDisplay() tree traversal in statusMessage
     * getter which is called frequently during rendering.
     */
    cachedDisplay: undefined as AbstractDisplayModel | undefined,
  }))
  .actions(self => {
    function stopCurrentToken() {
      if (self.stopToken !== undefined) {
        stopStopToken(self.stopToken)
        self.stopToken = undefined
      }
    }

    function clearRenderState() {
      self.filled = false
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.maxHeightReached = false
      self.renderProps = undefined
      self.renderArgs = undefined
    }

    return {
      /**
       * #action
       */
      doReload() {
        self.reloadFlag = self.reloadFlag + 1
      },

      /**
       * #action
       */
      setStatusMessage(message: string) {
        self.blockStatusMessage = message
      },
      /**
       * #action
       */
      setLoading(newStopToken: StopToken) {
        stopCurrentToken()
        self.isRenderingPending = true
        self.error = undefined
        self.message = undefined
        // Note: We intentionally do NOT clear reactElement/features/layout here
        // so that old content remains visible with a loading overlay while new
        // content is being rendered
        self.stopToken = newStopToken
      },
      /**
       * #action
       */
      setMessage(messageText: string) {
        stopCurrentToken()
        self.isRenderingPending = false
        self.message = messageText
        self.error = undefined
        clearRenderState()
      },
      /**
       * #action
       */
      setRendered(props: RenderedProps | undefined) {
        if (!props) {
          return
        }
        const {
          reactElement,
          features,
          layout,
          maxHeightReached,
          renderProps,
          renderArgs,
        } = props
        self.filled = true
        self.isRenderingPending = false
        self.message = undefined
        self.reactElement = reactElement
        self.features = features
        self.layout = layout
        self.error = undefined
        self.maxHeightReached = maxHeightReached
        self.renderProps = renderProps
        self.renderArgs = renderArgs
        self.stopToken = undefined
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error(error)
        stopCurrentToken()
        self.isRenderingPending = false
        self.message = undefined
        self.error = error
        clearRenderState()
        if (isRetryException(error as Error)) {
          this.reload()
        }
      },
      /**
       * #action
       */
      reload() {
        self.stopToken = undefined
        self.isRenderingPending = false
        self.error = undefined
        self.message = undefined
        self.ReactComponent = ServerSideRenderedBlockContent
        clearRenderState()
        getParent<any>(self, 2).reload()
      },
      setCachedDisplay(display: AbstractDisplayModel) {
        self.cachedDisplay = display
      },
      beforeDestroy() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            stopCurrentToken()
            // use stored renderArgs from last successful render instead of
            // recalculating via renderBlockData which is expensive
            if (self.renderArgs && self.cachedDisplay) {
              const { rpcManager } = getSession(self)
              const { rendererType } = self.cachedDisplay
              await rendererType.freeResourcesInClient(
                rpcManager,
                JSON.parse(JSON.stringify(self.renderArgs)),
              )
            }
          } catch (e) {
            console.error('Error while destroying block', e)
          }
        })()
      },
    }
  })
  .views(self => ({
    get statusMessage() {
      return self.isRenderingPending
        ? self.blockStatusMessage ||
            // @ts-expect-error
            self.cachedDisplay?.statusMessage ||
            'Loading'
        : undefined
    },
  }))
  .actions(self => ({
    afterAttach() {
      const display = self.cachedDisplay || getContainingDisplay(self)
      setTimeout(() => {
        if (isAlive(self)) {
          makeAbortableReaction(
            self as BlockModel,
            renderBlockData,
            renderBlockEffect,
            {
              name: `${display.id}/${assembleLocString(self.region)} rendering`,
              delay: display.renderDelay,
              fireImmediately: true,
            },
            self.setLoading,
            self.setRendered,
            self.setError,
          )
        }
      }, display.renderDelay)
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
  try {
    // Use optDisplay (for SVG export), cachedDisplay (set in addBlock), or
    // fall back to tree traversal
    const display = (optDisplay ||
      self.cachedDisplay ||
      getContainingDisplay(self)) as any
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
    const renderingProps = display.renderingProps?.() as
      | Record<string, unknown>
      | undefined
    const { config } = renderProps

    // This line is to trigger the mobx reaction when the config changes It
    // won't trigger the reaction if it doesn't think we're accessing it
    readConfObject(config)

    const sessionId = getRpcSessionId(display)
    const trackInstanceId = parentTrack.id
    const cannotBeRenderedReason = display.regionCannotBeRendered(self.region)

    // Get seq adapter refName for sequence fetching (e.g., for peptide rendering)
    const assembly = assemblyManager.get(self.region.assemblyName)
    const seqAdapterRefName = assembly?.getSeqAdapterRefName(
      self.region.refName,
    )

    return {
      rendererType,
      rpcManager,
      renderProps,
      renderingProps,
      cannotBeRenderedReason,
      displayError: error,
      renderArgs: {
        statusCallback: (message: string) => {
          if (isAlive(self)) {
            self.setStatusMessage(message)
          }
        },
        assemblyName: self.region.assemblyName,
        regions: [
          {
            ...(self.region as Omit<Region, symbol>),
            seqAdapterRefName,
          },
        ],
        adapterConfig,
        rendererType: rendererType.name,
        sessionId,
        trackInstanceId,
        blockKey: self.key,
        reloadFlag: self.reloadFlag,
        timeout: 1_000_000,
      },
    }
  } catch (e) {
    return {
      displayError: e,
    }
  }
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
  stopToken: StopToken | undefined,
  self: BlockModel,
) {
  if (!props || !isAlive(self)) {
    return undefined
  }
  const {
    rendererType,
    renderProps,
    renderingProps,
    rpcManager,
    renderArgs,
    cannotBeRenderedReason,
    displayError,
  } = props
  if (displayError) {
    self.setError(displayError)
    return undefined
  }
  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  }
  if (renderProps.notReady || !renderArgs) {
    return undefined
  }
  const { reactElement, features, layout, maxHeightReached } =
    await rendererType.renderInClient(rpcManager, {
      ...renderArgs,
      ...renderProps,
      renderingProps,
      stopToken,
    })
  return {
    reactElement,
    features,
    layout,
    maxHeightReached,
    renderProps,
    renderArgs,
  }
}
