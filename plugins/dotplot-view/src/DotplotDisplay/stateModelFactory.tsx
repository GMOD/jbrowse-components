/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ThemeOptions } from '@mui/material'
import { types, Instance } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import {
  getContainingView,
  makeAbortableReaction,
  ReactRendering,
} from '@jbrowse/core/util'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'
import { renderBlockData, renderBlockEffect } from './renderDotplotBlock'
import { DotplotViewModel, ExportSvgOptions } from '../DotplotView/model'

/**
 * #stateModel DotplotDisplay
 * #category display
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
      get shouldDisplay() {
        const view = getContainingView(self)
        return (
          view.vview.bpPerPx === self.data.bpPerPxY &&
          view.hview.bpPerPx === self.data.bpPerPxX
        )
      },
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
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(opts: ExportSvgOptions & { theme: ThemeOptions }) {
        const props = renderBlockData(self)
        if (!props) {
          return null
        }

        const { rendererType, rpcManager, renderProps } = props
        const rendering = await rendererType.renderInClient(rpcManager, {
          ...renderProps,
          exportSVG: opts,
          theme: opts.theme || renderProps.theme,
        })
        const { hview, vview } = getContainingView(self) as DotplotViewModel
        const offX = -hview.offsetPx + rendering.offsetX
        const offY = -vview.offsetPx + rendering.offsetY
        return (
          <g transform={`translate(${offX} ${-offY})`}>
            <ReactRendering rendering={rendering} />
          </g>
        )
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController

      return {
        afterAttach() {
          makeAbortableReaction(
            self,
            () => renderBlockData(self),
            blockData => renderBlockEffect(blockData),
            {
              name: `${self.type} ${self.id} rendering`,
              delay: 500,
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
