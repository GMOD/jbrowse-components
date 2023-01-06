import React from 'react'
import {
  getConf,
  readConfObject,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  Feature,
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
      features: undefined as Feature[] | undefined,
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
          self.message = undefined
          self.error = undefined
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
          self.message = messageText
          self.error = undefined
          renderInProgress = undefined
        },

        /**
         * #action
         * controlled by a reaction
         */
        setRendered(args?: {
          features: Feature[]
          renderingComponent: React.Component
        }) {
          if (!args) {
            return
          }
          const { features, renderingComponent } = args

          const featIds = new Set(self.features?.map(f => f.id()) || [])
          let foundFeatureNotInMap = false
          for (let i = 0; i < features.length; i++) {
            if (!featIds.has(features[i].id())) {
              foundFeatureNotInMap = true
              break
            }
          }
          self.message = undefined
          self.error = undefined
          renderInProgress = undefined
          self.renderingComponent = renderingComponent
          if (foundFeatureNotInMap) {
            self.features = features
          }
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
          self.message = undefined
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

  return parent.initialized
    ? {
        rendererType,
        rpcManager,
        renderProps: {
          ...display.renderProps(),
          view: parent,
          adapterConfig,
          rendererType: rendererType.name,
          sessionId,
          timeout: 1000000,
          self,
        },
      }
    : undefined
}

async function renderBlockEffect(props: ReturnType<typeof renderBlockData>) {
  if (!props) {
    return
  }

  const { rendererType, rpcManager, renderProps } = props
  const { adapterConfig } = renderProps

  // @ts-ignore
  const view0 = renderProps.view.views[0]

  const features = await rpcManager.call('getFeats', 'CoreGetFeatures', {
    regions: view0.staticBlocks.contentBlocks,
    sessionId: 'getFeats',
    adapterConfig,
  })

  return {
    features,
    renderingComponent: rendererType.ReactComponent,
  }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
