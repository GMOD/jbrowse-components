/* eslint-disable @typescript-eslint/no-explicit-any,no-plusplus */
import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { toArray } from 'rxjs/operators'
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getAdapter } from '@gmod/jbrowse-core/util/dataAdapterCache'
import { getContainingView } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
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
      geneAdapter1: pluginManager.pluggableConfigSchemaType('adapter'),
      geneAdapter2: pluginManager.pluggableConfigSchemaType('adapter'),
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
      loadedBlocks: [] as Feature[][],
    }))
    .views(self => ({
      get subtrackViews() {
        return this.subtracks.map(subtrack =>
          getContainingView(subtrack),
        ) as any[]
      },
      get subtracks(): any[] {
        const subtracks: any[] = []
        const parentView = getParent(self, 2)
        // @ts-ignore
        parentView.views.forEach(subview => {
          subview.tracks.forEach((subviewTrack: any) => {
            if (this.trackIds.includes(getConf(subviewTrack, 'trackId'))) {
              subtracks.push(subviewTrack)
            }
          })
        })
        return subtracks
      },

      get trackFeatures() {
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
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              const adapter = getAdapter(
                pluginManager,
                getConf(self, 'trackId'),
                self.adapterConfig.type,
                self.adapterConfig,
                null,
                null,
              ).dataAdapter
              const r = getParent(self, 2) as any
              const blockFeats = (
                await Promise.all(
                  r.views.map((subview: any) => {
                    return Promise.all(
                      subview.staticBlocks.map(async (block: any) => {
                        if (block.refName !== undefined) {
                          const { refName, start, end, assemblyName } = block
                          const observable = adapter.getFeatures({
                            refName,
                            start,
                            end,
                            assemblyName,
                          })
                          return observable.pipe(toArray()).toPromise()
                        }
                        // might be an interregion padding block, return empty
                        return []
                      }),
                    )
                  }),
                )
              ).map(f =>
                f
                  .flat()
                  .sort(
                    (a: Feature, b: Feature) =>
                      a.get('syntenyId') - b.get('syntenyId'),
                  ),
              )

              function getMatches(l1: Feature[], l2: Feature[]) {
                let i = 0
                let j = 0
                const res = []
                while (i < l1.length && j < l2.length) {
                  const x = l1[i]
                  const y = l2[j]
                  const a = x.get('syntenyId')
                  const b = y.get('syntenyId')
                  if (a == b) {
                    res.push([x, y])
                    i++
                    j++
                  } else if (a < b) {
                    i++
                  } else {
                    j++
                  }
                }
                return res
              }
              console.log(getMatches(blockFeats[0], blockFeats[1]))

              console.log(blockFeats)
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type LinearSyntenyTrack = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrack>
