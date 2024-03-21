import {
  readConfObject,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  dedupe,
  Feature,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { LinearComparativeViewModel } from '../LinearComparativeView/model'

/**
 * #stateModel LinearComparativeDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
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
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        height: 100,

        /**
         * #property
         */
        type: types.literal('LinearComparativeDisplay'),
      }),
    )
    .volatile((/* self */) => ({
      features: undefined as Feature[] | undefined,
      message: undefined as string | undefined,
      renderInProgress: undefined as AbortController | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      renderProps() {
        return {
          displayModel: self,
          highResolutionScaling: 2,
          rpcDriverName: self.rpcDriverName,
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
        setError(error: unknown) {
          console.error(error)
          if (renderInProgress && !renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
          // the rendering failed for some reason
          self.message = undefined
          self.error = error
          renderInProgress = undefined
        },

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
        setRendered(args?: { features: Feature[] }) {
          if (!args) {
            return
          }
          const { features } = args
          const existingFeatures = self.features || []

          const featIds = new Set(existingFeatures.map(f => f.id()) || [])
          const newFeatIds = new Set(features?.map(f => f.id()) || [])

          let foundNewFeatureNotInExistingMap = false
          let foundExistingFeatureNotInNewMap = false
          for (const feat of features) {
            if (!featIds.has(feat.id())) {
              foundNewFeatureNotInExistingMap = true
              break
            }
          }
          for (const existingFeat of existingFeatures) {
            if (!newFeatIds.has(existingFeat.id())) {
              foundExistingFeatureNotInNewMap = true
              break
            }
          }

          self.message = undefined
          self.error = undefined
          renderInProgress = undefined

          if (
            foundNewFeatureNotInExistingMap ||
            foundExistingFeatureNotInNewMap ||
            !self.features
          ) {
            self.features = features
          }
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          // @ts-expect-error
          self,
          renderBlockData,
          renderBlockEffect,
          {
            delay: 1000,
            fireImmediately: true,
            name: `${self.type} ${self.id} rendering`,
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

  // Alternative to readConfObject(config) is below used because renderProps is
  // something under our control.  Compare to serverSideRenderedBlock
  readConfObject(self.configuration)

  const { adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)

  return parent.initialized
    ? {
        renderProps: {
          ...display.renderProps(),
          adapterConfig,
          self,
          sessionId,
          timeout: 1000000,
          view: parent,
        },
        rpcManager,
      }
    : undefined
}

async function renderBlockEffect(props: ReturnType<typeof renderBlockData>) {
  if (!props) {
    return
  }

  const { rpcManager, renderProps } = props
  const { adapterConfig } = renderProps
  const view0 = renderProps.view.views[0]

  const features = (await rpcManager.call('getFeats', 'CoreGetFeatures', {
    adapterConfig,
    regions: view0.staticBlocks.contentBlocks,
    sessionId: 'getFeats',
  })) as Feature[]

  return {
    features: dedupe(features, f => f.id()),
  }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
