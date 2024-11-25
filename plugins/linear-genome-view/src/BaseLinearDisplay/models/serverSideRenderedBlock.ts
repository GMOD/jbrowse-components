import type React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocString,
  getSession,
  getContainingDisplay,
  getContainingView,
  getViewParams,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  getTrackAssemblyNames,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { isRetryException } from '@jbrowse/core/util/types'

// locals
import { types, getParent, isAlive, cast } from 'mobx-state-tree'
import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'
import type { Feature } from '@jbrowse/core/util'
import type { AbstractDisplayModel, Region } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

export interface RenderedProps {
  reactElement: React.ReactElement
  features: Map<string, Feature>
  layout: any
  maxHeightReached: boolean
  renderProps: any
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
    stopToken: undefined as string | undefined,
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
    status: '',
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
  }))
  .actions(self => ({
    /**
     * #action
     */
    doReload() {
      self.reloadFlag = self.reloadFlag + 1
    },
    afterAttach() {
      const display = getContainingDisplay(self)
      setTimeout(() => {
        if (isAlive(self)) {
          makeAbortableReaction(
            self as any,
            renderBlockData,
            renderBlockEffect,
            {
              name: `${display.id}/${assembleLocString(self.region)} rendering`,
              delay: display.renderDelay,
              fireImmediately: true,
            },
            this.setLoading,
            this.setRendered,
            this.setError,
          )
        }
      }, display.renderDelay)
    },
    /**
     * #action
     */
    setStatus(message: string) {
      self.status = message
    },
    /**
     * #action
     */
    setLoading(newStopToken: string) {
      if (self.stopToken !== undefined) {
        stopStopToken(self.stopToken)
      }
      self.filled = false
      self.message = undefined
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.error = undefined
      self.maxHeightReached = false
      self.renderProps = undefined
      self.stopToken = newStopToken
    },
    /**
     * #action
     */
    setMessage(messageText: string) {
      if (self.stopToken !== undefined) {
        stopStopToken(self.stopToken)
      }
      self.filled = false
      self.message = messageText
      self.reactElement = undefined
      self.features = undefined
      self.layout = undefined
      self.error = undefined
      self.maxHeightReached = false
      self.renderProps = undefined
      self.stopToken = undefined
    },
    /**
     * #action
     */
    setRendered(props: RenderedProps | undefined) {
      if (!props) {
        return
      }
      const { reactElement, features, layout, maxHeightReached, renderProps } =
        props
      self.filled = true
      self.message = undefined
      self.reactElement = reactElement
      self.features = features
      self.layout = layout
      self.error = undefined
      self.maxHeightReached = maxHeightReached
      self.renderProps = renderProps
      self.stopToken = undefined
    },
    /**
     * #action
     */
    setError(error: unknown) {
      console.error(error)
      if (self.stopToken !== undefined) {
        stopStopToken(self.stopToken)
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
      self.stopToken = undefined
      if (isRetryException(error as Error)) {
        this.reload()
      }
    },
    /**
     * #action
     */
    reload() {
      self.stopToken = undefined
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
    beforeDestroy() {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          if (self.stopToken !== undefined) {
            stopStopToken(self.stopToken)
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

    // This line is to trigger the mobx reaction when the config changes It
    // won't trigger the reaction if it doesn't think we're accessing it
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
        regions: [self.region],
        adapterConfig,
        rendererType: rendererType.name,
        sessionId,
        layoutId,
        blockKey: self.key,
        reloadFlag: self.reloadFlag,
        timeout: 1000000, // 10000,
      },
    }
  } catch (e) {
    return { displayError: e }
  }
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
  stopToken: string | undefined,
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
  } else if (displayError) {
    self.setError(displayError)
    return undefined
  } else if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  } else if (renderProps.notReady) {
    return undefined
  } else {
    const { reactElement, features, layout, maxHeightReached } =
      await rendererType.renderInClient(rpcManager, {
        ...renderArgs,
        ...renderProps,
        viewParams: getViewParams(self),
        stopToken,
      })
    return {
      reactElement,
      features,
      layout,
      maxHeightReached,
      renderProps,
    }
  }
}
