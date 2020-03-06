/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, cast, Instance, getParent, addDisposer } from 'mobx-state-tree'
import { reaction } from 'mobx'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
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
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      mcscanAnchors: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/mcscan.anchors' },
      },
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      geneAdapter1: pluginManager.pluggableConfigSchemaType('adapter'),
      geneAdapter2: pluginManager.pluggableConfigSchemaType('adapter'),
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
        syntenyBlocks: syntenyBlockState,
      }),
    )
    .volatile(self => ({
      ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
    }))
    .views(self => ({
      get subtracks(): any[] {
        const subtracks: any[] = []
        const parentView = getParent(self, 2)
        parentView.views.forEach((subview: any) => {
          subview.tracks.forEach((subviewTrack: any) => {
            const subtrackId = getConf(subviewTrack, 'trackId')
            if (this.trackIds.includes(subtrackId)) {
              subtracks.push(subviewTrack)
            }
          })
        })
        return subtracks
      },

      get subtrackFeatures() {
        return new CompositeMap<string, Feature>(
          this.subtracks.map(t => t.features),
        )
      },

      get adapterConfig() {
        return {
          type: 'MCScanAnchorsAdapter',
          mcscanAnchorsLocation: getConf(self, 'mcscanAnchors'),
          geneAdapter1: getConf(self, 'geneAdapter1'),
          geneAdapter2: getConf(self, 'geneAdapter2'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => ({
      featurePassesFilters(feature: Feature) {
        return true
      },

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

type SyntenyTrack = ReturnType<typeof stateModelFactory>

function renderBlockData(self: Instance<SyntenyTrack>) {
  return {}
}

function renderBlockEffect(
  self: Instance<SyntenyTrack>,
  data: ReturnType<typeof renderBlockData>,
) {}

export type LinearSyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
