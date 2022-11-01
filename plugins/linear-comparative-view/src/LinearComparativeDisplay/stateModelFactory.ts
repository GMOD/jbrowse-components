import React from 'react'
import {
  getConf,
  readConfObject,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import clone from 'clone'
import {
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { LinearComparativeViewModel } from '../LinearComparativeView/model'
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'

/**
 * #stateModel LinearComparativeDisplay
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearComparativeDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearComparativeDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        height: 100,
      }),
    )
    .volatile((/* self */) => ({
      renderInProgress: undefined as AbortController | undefined,
      filled: false,
      data: undefined as unknown,
      reactElement: undefined as React.ReactElement | undefined,
      message: undefined as string | undefined,
      renderingComponent: undefined as unknown,
      ReactComponent2: ServerSideRenderedBlockContent as unknown as React.FC,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
      /**
       * #getter
       */
      renderProps() {
        return {
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          highResolutionScaling: 2,
        }
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController

      return {
        /**
         * #action
         * controlled by a reaction
         */
        setLoading(abortController: AbortController) {
          self.filled = false
          self.message = undefined
          self.reactElement = undefined
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = abortController
        },
        /**
         * #action
         * controlled by a reaction
         */
        setMessage(messageText: string) {
          if (renderInProgress && !renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
          self.filled = false
          self.message = messageText
          self.reactElement = undefined
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
        /**
         * #action
         * controlled by a reaction
         */
        setRendered(args: {
          data: unknown
          reactElement: React.ReactElement
          renderingComponent: React.Component
        }) {
          const { data, reactElement, renderingComponent } = args
          self.filled = true
          self.message = undefined
          self.reactElement = reactElement
          self.data = data
          self.error = undefined
          self.renderingComponent = renderingComponent
          renderInProgress = undefined
        },
        /**
         * #action
         * controlled by a reaction
         */
        setError(error: unknown) {
          console.error(error)
          if (renderInProgress && !renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
          // the rendering failed for some reason
          self.filled = false
          self.message = undefined
          self.reactElement = undefined
          self.data = undefined
          self.error = error
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          // @ts-ignore
          self,
          renderBlockData,
          renderBlockEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            delay: 1000,
            fireImmediately: true,
          },
          self.setLoading,
          self.setRendered,
          self.setError,
        )
      },
    }))
}
function renderBlockData(self: LinearComparativeDisplay) {
  const { rpcManager } = getSession(self)
  const display = self
  const { rendererType } = display

  // Alternative to readConfObject(config) is below used because renderProps is
  // something under our control.  Compare to serverSideRenderedBlock
  readConfObject(self.configuration)

  const { adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)

  return {
    rendererType,
    rpcManager,
    renderProps: {
      ...display.renderProps(),
      view: clone(getSnapshot(parent)),
      adapterConfig,
      rendererType: rendererType.name,
      sessionId,
      timeout: 1000000,
    },
  }
}

async function renderBlockEffect(props: ReturnType<typeof renderBlockData>) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const { rendererType, rpcManager, renderProps } = props

  // @ts-ignore
  const { reactElement, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderProps,
  )

  return { reactElement, data, renderingComponent: rendererType.ReactComponent }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
