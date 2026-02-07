import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import type { LinearComparativeViewModel } from '../LinearComparativeView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
    .volatile(() => ({
      /**
       * #volatile
       */
      renderInProgress: undefined as string | undefined,
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       */
      message: undefined as string | undefined,
      /**
       * #volatile
       */
      loadingStatus: undefined as string | undefined,
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
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
         * comparative displays don't have a track minimize UI so this is
         * always false
         */
        get isMinimized() {
          return false
        },
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
          }
        },
      }
    })
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
          self.message = messageText
          self.error = undefined
          stopToken = undefined
        },

        /**
         * #action
         * controlled by a reaction
         */
        setLoadingStatus(messageText: string) {
          self.loadingStatus = messageText
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
          ...(display.renderProps() as Record<string, unknown>),
          model: display,
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
  const { model, sessionId, adapterConfig, level } = renderProps
  const view = renderProps.view.views[level]!
  return {
    features: dedupe(
      (await rpcManager.call(sessionId, 'CoreGetFeatures', {
        regions: view.staticBlocks.contentBlocks,
        sessionId,
        adapterConfig,
        statusCallback: (arg: string) => {
          model.setLoadingStatus(arg)
        },
      })) as Feature[],
      f => f.id(),
    ),
  }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
