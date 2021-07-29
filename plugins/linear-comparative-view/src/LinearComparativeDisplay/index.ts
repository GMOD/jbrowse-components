/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getConf,
  readConfObject,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import {
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import React from 'react'
import { LinearComparativeViewModel } from '../LinearComparativeView/model'
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'

export { default as ReactComponent } from './components/LinearComparativeDisplay'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeDisplay',
    { renderer: pluginManager.pluggableConfigSchemaType('renderer') },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

export function stateModelFactory(configSchema: any) {
  return types
    .compose(
      'LinearComparativeDisplay',
      BaseDisplay,
      types.model({
        type: types.literal('LinearComparativeDisplay'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      }),
    )
    .volatile((/* self */) => ({
      renderInProgress: undefined as AbortController | undefined,
      filled: false,
      data: undefined as any,
      reactElement: undefined as React.ReactElement | undefined,
      message: undefined as string | undefined,
      renderingComponent: undefined as any,
      ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
    }))
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
      get renderProps() {
        return {
          rpcDriverName: self.rpcDriverName,
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
            renderBlockData as any,
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
function renderBlockData(self: LinearComparativeDisplay) {
  const { rpcManager } = getSession(self) as any
  const display = self

  const {
    renderProps,
    rendererType,
  }: { renderProps: any; rendererType: any } = display

  // Alternative to readConfObject(config) is below
  // used because renderProps is something under our control.
  // Compare to serverSideRenderedBlock
  readConfObject(self.configuration)

  const { adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)

  return {
    rendererType,
    rpcManager,
    renderProps: {
      ...renderProps,
      view: getSnapshot(parent),
    },
    renderArgs: {
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

  const { rendererType, rpcManager, renderProps, renderArgs } = props

  const { reactElement, ...data } = await rendererType.renderInClient(
    rpcManager,
    {
      ...renderArgs,
      ...renderProps,
    },
  )

  return { reactElement, data, renderingComponent: rendererType.ReactComponent }
}

export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
