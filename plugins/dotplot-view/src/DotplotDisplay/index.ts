/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getConf,
  readConfObject,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import React from 'react'

import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'
import { DotplotViewModel } from '../DotplotView/model'

export { default as ReactComponent } from './components/DotplotDisplay'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'DotplotDisplay',
    {
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'DotplotRenderer' },
      ),
    },
    { explicitIdentifier: 'displayId', explicitlyTyped: true },
  )
}

export function stateModelFactory(configSchema: any) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      types
        .model({
          type: types.literal('DotplotDisplay'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          renderInProgress: undefined as AbortController | undefined,
          filled: false,
          data: undefined as any,
          reactElement: undefined as React.ReactElement | undefined,
          message: undefined as string | undefined,
          renderingComponent: undefined as any,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
      get renderProps() {
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
            (blockData): any => {
              return blockData ? renderBlockEffect(blockData) : undefined
            },
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

        setLoading(abortController: AbortController) {
          self.filled = false
          self.message = undefined
          self.reactElement = undefined
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = abortController
        },
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
        setRendered(args: {
          data: any
          reactElement: React.ReactElement
          renderingComponent: React.Component
        }) {
          if (args === undefined) {
            return
          }
          const { data, reactElement, renderingComponent } = args
          self.filled = true
          self.message = undefined
          self.reactElement = reactElement
          self.data = data
          self.error = undefined
          self.renderingComponent = renderingComponent
          renderInProgress = undefined
        },
        setError(error: Error) {
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

function renderBlockData(self: DotplotDisplayModel) {
  const { rpcManager } = getSession(self)
  const { renderProps, rendererType } = self
  const { adapterConfig } = self
  const parent = getContainingView(self) as DotplotViewModel

  // Alternative to readConfObject(config) is below
  // used because renderProps is something under our control.
  // Compare to serverSideRenderedBlock
  readConfObject(self.configuration)
  getSnapshot(parent)

  if (parent.initialized) {
    const { viewWidth, viewHeight, borderSize, borderX, borderY } = parent
    return {
      rendererType,
      rpcManager,
      renderProps: {
        ...renderProps,
        view: getSnapshot(parent),
        width: viewWidth,
        height: viewHeight,
        borderSize,
        borderX,
        borderY,
      },
      renderArgs: {
        adapterConfig,
        rendererType: rendererType.name,
        sessionId: getRpcSessionId(self),
        timeout: 1000000, // 10000,
      },
    }
  }
  return undefined
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const { rendererType, rpcManager, renderArgs, renderProps } = props

  const { reactElement, ...data } = await (rendererType as any).renderInClient(
    rpcManager,
    {
      ...renderArgs,
      ...renderProps,
    },
  )

  return { reactElement, data, renderingComponent: rendererType.ReactComponent }
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
