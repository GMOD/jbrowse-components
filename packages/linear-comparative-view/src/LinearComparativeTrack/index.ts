import {
  readConfObject,
  getConf,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types
    .compose(
      'LinearComparativeTrack',
      BaseTrack,
      types.model('LinearComparativeTrack', {
        type: types.literal('LinearComparativeTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .actions(self => {
      let renderInProgress: undefined | AbortController
      // eslint-disable-next-line @typescript-eslint/no-unused-vars

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

type LinearComparativeTrackModel = ReturnType<typeof stateModelFactory>
type LinearComparativeTrack = Instance<LinearComparativeTrackModel>

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
  }

  const { rendererType, rpcManager, renderArgs } = props

  const { imageData, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderArgs,
  )

  return { imageData, data, renderingComponent: rendererType.ReactComponent }
}
