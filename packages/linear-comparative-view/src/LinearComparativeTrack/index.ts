/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  readConfObject,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { types, Instance, getParent, getSnapshot } from 'mobx-state-tree'
import {
  BaseTrackConfig,
  BaseTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { getSession, makeAbortableReaction } from '@gmod/jbrowse-core/util'
import jsonStableStringify from 'json-stable-stringify'
import LinearComparativeTrackComponent from './components/LinearComparativeTrack'
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeTrack',
    {
      viewType: 'LinearComparativeView',
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
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
          imageData: '',
          error: undefined as Error | undefined,
          message: undefined as string | undefined,
          viewOffsets: [] as number[],
          renderingComponent: undefined as any,
          ReactComponent: (LinearComparativeTrackComponent as unknown) as React.FC,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )
    .actions(self => {
      let renderInProgress: undefined | AbortController

      return {
        afterAttach() {
          makeAbortableReaction(
            self as any,
            'render',
            renderBlockData as any,
            renderBlockEffect as any,
            {
              name: `${self.type} ${self.id} rendering`,
              delay: 300,
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
          self.imageData = ''
          self.viewOffsets = getParent(self, 2).views.map(
            (view: any) => view.offsetPx,
          )
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
          self.imageData = ''
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
        setRendered(args: {
          data: any
          imageData: any
          renderingComponent: React.Component
        }) {
          const { data, imageData, renderingComponent } = args
          self.filled = true
          self.message = undefined
          self.imageData = imageData
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
          self.imageData = ''
          self.data = undefined
          self.error = error
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
      }
    })
}
function renderBlockData(self: LinearComparativeTrack) {
  try {
    const { rpcManager } = getSession(self) as any
    const track = self

    const { renderProps, rendererType } = track

    // Alternative to readConfObject(config) is below
    // used because renderProps is something under our control.
    // Compare to serverSideRenderedBlock
    readConfObject(self.configuration)

    const sequenceConfig: { type?: string } = {}

    const { adapterConfig } = self
    const adapterConfigId = jsonStableStringify(adapterConfig)
    const parentView = getParent(self, 2)
    return {
      rendererType,
      rpcManager,
      renderProps,
      trackError: '', // track.error,
      renderArgs: {
        adapterType: self.adapterType.name,
        adapterConfig,
        sequenceAdapterType: sequenceConfig.type,
        sequenceAdapterConfig: sequenceConfig,
        rendererType: rendererType.name,
        views: parentView.views.map((view: any) => {
          return {
            ...(getSnapshot(view) as any),
            regions: view.staticBlocks.getRegions(),
            staticBlocks: view.staticBlocks.getRegions(),
            dynamicBlocks: view.dynamicBlocks.getRegions(),
            displayedRegions: view.displayedRegions,
            features: JSON.stringify(view.features),
            // important params for overlays
            headerHeight: view.headerHeight,
            height: view.height,
            scaleBarHeight: view.scaleBarHeight,
            // details about inner tracks such as layoutFeatures for overlays
            tracks: view.tracks.map((t: any) => {
              return {
                ...(getSnapshot(t) as any),
                layoutFeatures: Array.from(t.layoutFeatures.entries()),
                height: t.height,
                scrollTop: t.scrollTop,
              }
            }),
          }
        }),
        width: 100,
        height: 100,
        renderProps,
        sessionId: adapterConfigId,
        timeout: 1000000, // 10000,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      trackError: error,
    }
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
  } else if (props.trackError) {
    throw new Error(props.trackError)
  }

  const { rendererType, rpcManager, renderArgs } = props

  const { imageData, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderArgs,
  )

  return { imageData, data, renderingComponent: rendererType.ReactComponent }
}
export type LinearComparativeTrackModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeTrack = Instance<LinearComparativeTrackModel>
