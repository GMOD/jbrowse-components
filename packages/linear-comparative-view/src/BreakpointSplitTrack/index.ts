/* eslint-disable @typescript-eslint/no-explicit-any,import/no-extraneous-dependencies */
import { types, Instance, getParent, getSnapshot } from 'mobx-state-tree'
import jsonStableStringify from 'json-stable-stringify'
import { getSession, makeAbortableReaction } from '@gmod/jbrowse-core/util'
import {
  readConfObject,
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'

import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeTrack'
import BreakpointSplitTrackComponent from './components/BreakpointSplitTrack'
import ServerSideRenderedBlockContent from '../ServerSideRenderedBlockContent'

interface Block {
  start: number
  end: number
  refName: string
  assemblyName: string
  key: string
}

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'BreakpointSplitTrack',
    {
      viewType: 'BreakpointSplitView',
      linkedTrack: {
        type: 'string',
        defaultValue: '',
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types
    .compose(
      'BreakpointSplitTrack',
      baseModelFactory(pluginManager, configSchema),
      types
        .model('BreakpointSplitTrack', {
          type: types.literal('BreakpointSplitTrack'),
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
          ReactComponent: (BreakpointSplitTrackComponent as unknown) as React.FC,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )

    .views(self => ({
      // see link, can't have colliding name `width` so renamed to `effectiveWidth`
      // https://spectrum.chat/mobx-state-tree/general/types-compose-error~484a5bbe-a280-4fae-8ba7-eb14afc1257d
      get effectiveWidth() {
        return getParent(self, 2).views[0].viewingRegionWidth
      },
      get effectiveHeight() {
        return 100
      },
      get highResolutionScaling() {
        return 1
      },
      get renderProps() {
        return {
          trackModel: self,
          linkedTrack: getConf(self, 'linkedTrack'),
          middle: getConf(self, 'middle'),
          height: this.effectiveHeight,
          width: this.effectiveWidth,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return {
          name: self.configuration.adapter.type,
          assemblyNames: ['peach', 'grape'],
          ...getConf(self, 'adapter'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      function debounceEffect<T>(
        effect: (arg: T, r: any) => void,
        debounceMs: number,
      ) {
        let timer: NodeJS.Timeout
        return (arg: T, r: any) => {
          clearTimeout(timer)
          timer = setTimeout(() => effect(arg, r), debounceMs)
        }
      }
      return {
        afterAttach() {
          makeAbortableReaction(
            self as any,
            'render',
            renderBlockData as any,
            renderBlockEffect as any,
            {
              name: `${self.type} ${self.id} rendering`,
              delay: 2000,
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

type SyntenyTrackModel = ReturnType<typeof stateModelFactory>
type SyntenyTrack = Instance<SyntenyTrackModel>

function renderBlockData(self: SyntenyTrack) {
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
  self: Instance<SyntenyTrack>,
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

export type BreakpointSplitTrackStateModel = ReturnType<
  typeof stateModelFactory
>
