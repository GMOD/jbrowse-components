/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getConf,
  readConfObject,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  BaseTrackConfig,
  BaseTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import {
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@gmod/jbrowse-core/util'
import { getRpcSessionId } from '@gmod/jbrowse-core/util/tracks'
import LinearComparativeTrackComponent from './components/LinearComparativeTrack'
import { LinearComparativeViewModel } from '../LinearComparativeView/model'
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeTrack',
    {
      viewType: 'LinearComparativeView',
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types
    .compose(
      'LinearComparativeTrack',
      BaseTrack,
      types
        .model('LinearComparativeTrack', {
          type: types.literal('LinearComparativeTrack'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(self => ({
          // avoid circular typescript reference by casting to generic functional component
          renderInProgress: undefined as AbortController | undefined,
          filled: false,
          data: undefined as any,
          html: '',
          error: undefined as Error | undefined,
          message: undefined as string | undefined,
          renderingComponent: undefined as any,
          ReactComponent: (LinearComparativeTrackComponent as unknown) as React.FC,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, 'renderer').type
      },
      get adapterConfig() {
        return getConf(self, 'adapter')
      },
      get renderProps() {
        return {
          trackModel: self,
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
            self.setLoading,
            self.setRendered,
            self.setError,
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
function renderBlockData(self: LinearComparativeTrack) {
  const { rpcManager } = getSession(self) as any
  const track = self

  const { renderProps, rendererType } = track

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
    renderProps,
    renderArgs: {
      adapterConfig,
      rendererType: rendererType.name,
      renderProps: {
        ...renderProps,
        view: getSnapshot(parent),
      },
      sessionId,
      timeout: 1000000,
    },
  }
}

async function renderBlockEffect(
  props: ReturnType<typeof renderBlockData>,
  signal: AbortSignal,
  self: LinearComparativeTrack,
  allowRefetch = false,
) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const { rendererType, rpcManager, renderArgs } = props

  const { html, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderArgs,
  )

  return { html, data, renderingComponent: rendererType.ReactComponent }
}

export type LinearComparativeTrackModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeTrack = Instance<LinearComparativeTrackModel>
