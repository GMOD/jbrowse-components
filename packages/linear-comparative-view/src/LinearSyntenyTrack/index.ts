/* eslint-disable @typescript-eslint/no-explicit-any */
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

      //       get layoutMatches() {
      //         const features = this.trackFeatures
      //         const alreadySeen = new Set<number>()
      //         const featNameMap: { [key: string]: Feature } = {}

      //         if (!self.anchorsData || !self.anchors) {
      //           return []
      //         } // this finds candidate features that share the same name

      //         for (const feature of features.values()) {
      //           const n = self.anchors[feature.get('name')]
      //           featNameMap[feature.get('name')] = feature

      //           if (n !== undefined) {
      //             alreadySeen.add(n)
      //           }
      //         }

      //         const blocks = Array.from(alreadySeen)
      //         const ret = []

      //         for (const block of blocks) {
      //           const r = self.anchorsData[block]
      //           if (r) {
      //             const r1 = featNameMap[r.name1]
      //             const r2 = featNameMap[r.name2]
      //             if (!r1 || !r2) {
      //               // alt logic (r1 && r2) || !(r3 && r4)
      //               // eslint-disable-next-line no-continue
      //               continue
      //             }
      //             const s1 = r1.get('start')
      //             const e1 = r1.get('end')
      //             const s2 = r2.get('start')
      //             const e2 = r2.get('end')

      //             ret.push([
      //               {
      //                 layout: [s1, 0, e1, 10] as LayoutRecord,
      //                 feature: new SimpleFeature({
      //                   data: { uniqueId: `${block}-1`, start: s1, end: e1 },
      //                 }),
      //                 level: 1,
      //                 refName: r1.get('refName') as string,
      //               },
      //               {
      //                 layout: [s2, 0, e2, 10] as LayoutRecord,
      //                 feature: new SimpleFeature({
      //                   data: { uniqueId: `${block}-2`, start: s2, end: e2 },
      //                 }),
      //                 level: 0,
      //                 refName: r2.get('refName') as string,
      //               },
      //             ])
      //           }
      //         }
      //         return ret
      //       },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            const adapter = getAdapter(
              pluginManager,
              getConf(self, 'trackId'),
              self.adapterConfig.type,
              self.adapterConfig,
              null,
              null,
            ).dataAdapter
            const r = getParent(self, 2) as any
            const blockFeats = r.views.map(subview => {
              return Promise.all(
                subview.staticBlocks.map(async block => {
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
            })
            console.log(Promise.all(blockFeats))
          }),
        )
      },
    }))
}

export type LinearSyntenyTrack = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrack>
