import {
  readConfObject,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { types, getSnapshot, Instance, getParent } from 'mobx-state-tree'
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
import { stopStopToken } from '@jbrowse/core/util/stopToken'

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
        type: types.literal('LinearComparativeDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile((/* self */) => ({
      renderInProgress: undefined as string | undefined,
      features: undefined as Feature[] | undefined,
      message: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get level() {
        return getParent<{ height: number; level: number }>(self, 4).level
      },
      /**
       * #getter
       */
      get height() {
        return getParent<{ height: number; level: number }>(self, 4).height
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
      let stopToken: undefined | string

      return {
        /**
         * #action
         * controlled by a reaction
         */
        setLoading(newStopToken: string) {
          self.message = undefined
          self.error = undefined
          stopToken = newStopToken
        },

        /**
         * #action
         * controlled by a reaction
         */
        setMessage(messageText: string) {
          // TODO:ABORT(??)
          self.message = messageText
          self.error = undefined
          stopToken = undefined
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

          const featIds = new Set(existingFeatures.map(f => f.id()))
          const newFeatIds = new Set(features.map(f => f.id()))

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
          stopToken = undefined

          if (
            foundNewFeatureNotInExistingMap ||
            foundExistingFeatureNotInNewMap ||
            !self.features
          ) {
            self.features = features
          }
        },

        /**
         * #action
         * controlled by a reaction
         */
        setError(error: unknown) {
          console.error(error)
          if (stopToken !== undefined) {
            stopStopToken(stopToken)
          }
          // the rendering failed for some reason
          self.message = undefined
          self.error = error
          stopToken = undefined
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

  // Alternative to readConfObject(config) is below used because
  // renderProps is something under our control.  Compare to
  // serverSideRenderedBlock
  readConfObject(self.configuration)

  const { level, adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)
  return parent.initialized
    ? {
        rpcManager,
        renderProps: {
          ...display.renderProps(),
          level,
          view: parent,
          adapterConfig,
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

  const { rpcManager, renderProps } = props
  const { adapterConfig, level } = renderProps
  const view = renderProps.view.views[level]
  const features = (await rpcManager.call('getFeats', 'CoreGetFeatures', {
    regions: view.staticBlocks.contentBlocks,
    sessionId: 'getFeats',
    adapterConfig,
  })) as Feature[]

  return {
    features: dedupe(features, f => f.id()),
  }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
