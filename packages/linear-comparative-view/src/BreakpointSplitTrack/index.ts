/* eslint-disable @typescript-eslint/no-explicit-any,import/no-extraneous-dependencies */
import { types, Instance, getParent } from 'mobx-state-tree'

import { makeAbortableReaction } from '@gmod/jbrowse-core/util'
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
        return getParent(self, 2).height
      },
      get highResolutionScaling() {
        return 1
      },
      get renderProps() {
        return {
          trackModel: self,
          config: readConfObject(self.configuration, 'renderer'),
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
}

type SyntenyTrackModel = ReturnType<typeof stateModelFactory>
type SyntenyTrack = Instance<SyntenyTrackModel>

export type BreakpointSplitTrackStateModel = ReturnType<
  typeof stateModelFactory
>
