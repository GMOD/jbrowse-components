import React from 'react'
import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  makeAbortableReaction,
  ReactRendering,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from 'mobx-state-tree'

// locals
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'
import { renderBlockData, renderBlockEffect } from './renderDotplotBlock'
import type { DotplotViewModel, ExportSvgOptions } from '../DotplotView/model'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { ThemeOptions } from '@mui/material'
import type { Instance } from 'mobx-state-tree'

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
          /**
           * #volatile
           */
          stopToken: undefined as string | undefined,
          /**
           * #volatile
           */
          warnings: [] as { message: string; effect: string }[],
          /**
           * #volatile
           */
          filled: false,
          /**
           * #volatile
           */
          data: undefined as any,
          /**
           * #volatile
           */
          reactElement: undefined as React.ReactElement | undefined,
          /**
           * #volatile
           */
          message: undefined as string | undefined,
          /**
           * #volatile
           */
          renderingComponent: undefined as any,
          /**
           * #volatile
           */
          ReactComponent2:
            ServerSideRenderedBlockContent as unknown as React.FC<any>,
        })),
    )
    .views(self => ({
      get shouldDisplay() {
        const { vview, hview } = getContainingView(self) as DotplotViewModel
        return (
          vview.bpPerPx === self.data.bpPerPxY &&
          hview.bpPerPx === self.data.bpPerPxX
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
      async renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
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
    .actions(self => ({
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
      setLoading(stopToken?: string) {
        self.filled = false
        self.message = undefined
        self.reactElement = undefined
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
        self.stopToken = stopToken
      },
      /**
       * #action
       */
      setMessage(messageText: string) {
        self.filled = false
        self.message = messageText
        self.reactElement = undefined
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
        self.stopToken = undefined
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
        self.stopToken = undefined
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error(error)
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.reactElement = undefined
        self.data = undefined
        self.error = error
        self.renderingComponent = undefined
        self.stopToken = undefined
      },
    }))
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
