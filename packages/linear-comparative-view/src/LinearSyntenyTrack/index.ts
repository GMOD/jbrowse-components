import { types, Instance, resolveIdentifier } from 'mobx-state-tree'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'

import {
  configSchemaFactory as baseConfig,
  stateModelFactory as baseModel,
} from '../LinearComparativeTrack'
import LinearSyntenyTrackComponent from './components/LinearSyntenyTrack'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      mcscanAnchors: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/mcscan.anchors' },
      },
    },
    {
      baseConfiguration: baseConfig(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types.compose(
    baseModel(pluginManager, configSchema),
    types
      .model('LinearSyntenyTrack', {
        type: types.literal('LinearSyntenyTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .views(self => ({
        get subtracks() {
          const session = getSession(self) as any
          const type = session.pluginManager.pluggableConfigSchemaType('track')
          return this.trackIds.map(trackId =>
            resolveIdentifier(type, session, trackId),
          )
        },
        get trackIds() {
          return getConf(self, 'trackIds') as string[]
        },
      }))
      .volatile(self => ({
        ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
      })),
  )
}

export type LinearSyntenyTrack = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrack>
