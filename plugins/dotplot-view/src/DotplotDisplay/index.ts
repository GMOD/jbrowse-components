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
          html: '',
          message: undefined as string | undefined,
          renderingComponent: undefined as any,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, 'renderer').type
      },
      get renderProps() {
        return {
          ...getParentRenderProps(self),
          displayModel: self,
        }
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController

      return {
        afterAttach() {
          makeAbortableReaction(
            self as any,
            renderBlockData,
            renderBlockEffect as any,
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
          self.html = ''
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
          self.html = ''
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
        setRendered(args: {
          data: any
          html: any
          renderingComponent: React.Component
        }) {
          const { data, html, renderingComponent } = args
          self.filled = true
          self.message = undefined
          self.html = html
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
          self.html = ''
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
  const display = self

  const { renderProps, rendererType } = display

  // Alternative to readConfObject(config) is below
  // used because renderProps is something under our control.
  // Compare to serverSideRenderedBlock
  readConfObject(self.configuration)

  const { adapterConfig } = self
  const parent = getContainingView(self) as DotplotViewModel
  getSnapshot(parent)
  const { viewWidth, viewHeight, borderSize, borderX, borderY } = parent

  return {
    rendererType,
    rpcManager,
    renderProps,
    renderArgs: {
      adapterConfig,
      rendererType: rendererType.name,
      renderProps: {
        ...renderProps,
        view: getSnapshot(parent),
        width: viewWidth,
        height: viewHeight,
        borderSize,
        borderX,
        borderY,
      },
      sessionId: getRpcSessionId(self),
      timeout: 1000000, // 10000,
    },
  }
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData> | undefined,
) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const { rendererType, rpcManager, renderArgs } = props

  const { html, ...data } = await (rendererType as any).renderInClient(
    rpcManager,
    renderArgs,
  )

  return { html, data, renderingComponent: rendererType.ReactComponent }
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
