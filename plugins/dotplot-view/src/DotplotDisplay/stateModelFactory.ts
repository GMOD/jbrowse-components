/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { types, Instance } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { makeAbortableReaction } from '@jbrowse/core/util'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'
import { renderBlockData, renderBlockEffect } from './renderDotplotBlock'

/**
 * #stateModel DotplotDisplay
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      types
        .model({
          /**
           * #property
           */
          type: types.literal('DotplotDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          warnings: [] as { message: string; effect: string }[],
          renderInProgress: undefined as AbortController | undefined,
          filled: false,
          data: undefined as any,
          reactElement: undefined as React.ReactElement | undefined,
          message: undefined as string | undefined,
          renderingComponent: undefined as any,
          ReactComponent2:
            ServerSideRenderedBlockContent as unknown as React.FC<any>,
        })),
    )
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
      /**
       * #method
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: self.configuration.renderer,
        }
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController

      return {
        afterAttach() {
          makeAbortableReaction(
            self as any,
            () => renderBlockData(self as any),
            (blockData): any =>
              blockData ? renderBlockEffect(blockData) : undefined,
            {
              name: `${self.type} ${self.id} rendering`,
              delay: 1000,
              fireImmediately: true,
            },
            this.setLoading,
            this.setRendered,
            this.setError,
          )
        },
        /**
         * #action
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
         */
        setRendered(args?: {
          data: any
          reactElement: React.ReactElement
          renderingComponent: React.Component
        }) {
          if (args === undefined) {
            return
          }
          const { data, reactElement, renderingComponent } = args
          self.warnings = data.warnings
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
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
