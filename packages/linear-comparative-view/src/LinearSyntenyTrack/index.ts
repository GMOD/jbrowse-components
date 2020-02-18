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

export interface AnchorsData {
  [key: number]: {
    name1: string
    name2: string
    score: number
  }
}

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
  return types
    .compose(
      baseModel(pluginManager, configSchema),
      types.model('LinearSyntenyTrack', {
        type: types.literal('LinearSyntenyTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(self => ({
      ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
      anchors: undefined as { [key: string]: number } | undefined,
      anchorsData: undefined as AnchorsData | undefined,
    }))
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
    .actions(self => ({
      async downloadAnchors() {
        const anchors = getConf(self, 'mcscanAnchors')

        const data = await fetch(anchors)
        const text = await data.text()
        const m: { [key: string]: number } = {}
        const r: AnchorsData = {}

        text.split('\n').forEach((line: string, index: number) => {
          if (line.length) {
            if (line !== '###') {
              const [name1, name2, score] = line.split('\t')
              m[name1] = index
              m[name2] = index
              r[index] = { name1, name2, score: +score }
            }
          }
        })

        this.setAnchorsData(m, r)
      },

      setAnchorsData(
        anchors: { [key: string]: number },
        anchorsData: AnchorsData,
      ) {
        self.anchors = anchors
        self.anchorsData = anchorsData
      },
    }))
}

export type LinearSyntenyTrack = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrack>
