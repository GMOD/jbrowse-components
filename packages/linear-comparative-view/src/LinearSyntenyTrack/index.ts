/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, cast, Instance, getParent, addDisposer } from 'mobx-state-tree'
import jsonStableStringify from 'json-stable-stringify'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  readConfObject,
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { reaction } from 'mobx'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'

import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeTrack'
import LinearSyntenyTrackComponent from './components/LinearSyntenyTrack'
import ServerSideRenderedBlockContent from './components/ServerSideRenderedBlockContent'

interface Block {
  start: number
  end: number
  refName: string
  assemblyName: string
  key: string
}

const syntenyBlockState = types
  .model('SyntenyBlock', {
    key: types.string,
  })
  .volatile(self => ({
    renderInProgress: undefined as AbortController | undefined,
    filled: false,
    data: undefined as any,
    html: '',
    error: undefined as Error | undefined,
    message: undefined as string | undefined,
    ReactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined as any,
    renderProps: undefined as any,
  }))
  .actions(self => ({
    afterAttach() {
      this.setFilled()
    },
    setFilled() {
      self.filled = true
    },
  }))
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
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
      baseModelFactory(pluginManager, configSchema),
      types.model('LinearSyntenyTrack', {
        type: types.literal('LinearSyntenyTrack'),
        renderDelay: types.number,
        configuration: ConfigurationReference(configSchema),
        syntenyBlock: syntenyBlockState,
      }),
    )
    .volatile(self => ({
      // avoid circular typescript reference by casting to generic functional component
      ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
    }))
    .views(self => ({
      // get subtracks(): any[] {
      //   const subtracks: any[] = []
      //   const parentView = getParent(self, 2)
      //   parentView.views.forEach((subview: any) => {
      //     subview.tracks.forEach((subviewTrack: any) => {
      //       const subtrackId = getConf(subviewTrack, 'trackId')
      //       if (this.trackIds.includes(subtrackId)) {
      //         subtracks.push(subviewTrack)
      //       }
      //     })
      //   })
      //   return subtracks
      // },

      // get subtrackFeatures() {
      //   return new CompositeMap<string, Feature>(
      //     this.subtracks.map(t => t.features),
      //   )
      // },

      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return getConf(self, 'adapter')
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          reaction(
            () => renderBlockData(cast(self)),
            data => renderBlockEffect(cast(self), data),
            {
              name: `{track.id} rendering`,
              delay: self.renderDelay,
              fireImmediately: true,
            },
          ),
        )
      },
    }))
}

type SyntenyTrackModel = ReturnType<typeof stateModelFactory>
type SyntenyTrack = Instance<SyntenyTrackModel>

function renderBlockData(self: SyntenyTrack) {
  try {
    const { rpcManager } = getSession(self) as any
    const track = self

    // @ts-ignore
    const { renderProps, rendererType } = track
    const { config } = renderProps
    // This line is to trigger the mobx reaction when the config changes
    // It won't trigger the reaction if it doesn't think we're accessing it
    readConfObject(config)

    const sequenceConfig: { type?: string } = {}

    const { adapterConfig } = self
    const adapterConfigId = jsonStableStringify(adapterConfig)
    return {
      rendererType,
      rpcManager,
      renderProps,
      trackError: '', // track.error,
      renderArgs: {
        adapterType: adapterConfig.name,
        adapterConfig,
        sequenceAdapterType: sequenceConfig.type,
        sequenceAdapterConfig: sequenceConfig,
        rendererType: rendererType.name,
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

function renderBlockEffect(
  self: Instance<SyntenyTrack>,
  data: ReturnType<typeof renderBlockData>,
) {}

export type LinearSyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
