/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { ignoreElements, tap, filter } from 'rxjs/operators'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@gmod/jbrowse-core/util/QuickLRU'
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { getAdapter } from '@gmod/jbrowse-core/util/dataAdapterCache'
import { getContainingView, checkAbortSignal } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeTrack'
import LinearSyntenyTrackComponent from './components/LinearSyntenyTrack'

interface Block {
  start: number
  end: number
  refName: string
  assemblyName: string
  key: string
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
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(self => ({
      ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
      blockFeatureCache: new AbortablePromiseCache({
        cache: new QuickLRU({ maxSize: 1000 }),
        fill: async (
          args: {
            dataAdapter: BaseAdapter
            block: Block
          },
          abortSignal: AbortSignal,
        ) => {
          const { block, dataAdapter } = args
          const { refName, start, end, assemblyName } = block
          return dataAdapter.getFeatures(
            { refName, start, end, assemblyName },
            { signal: abortSignal },
          )
        },
      }),
      // map of block.key -> map of feature id to feature
      blockFeatures: new Map() as Map<string, Map<string, Feature>>,
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

      // returns a restructuring of the self.blockFeatures stratified by view
      get syntenyTrackFeatures() {
        const parentView = getParent(self, 2) as any
        parentView.views.map((subview: any, index: number) => {
          return new CompositeMap<string, Feature>(
            subview.staticBlocks
              .filter((block: Block) => 'refName' in block)
              .map((block: Block) => self.blockFeatures.get(block.key)),
          )
        })
        return 0
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

      renderSynteny(arg: any) {},

      async fillBlockFeatures(param: {
        block: Block
        signal: AbortSignal
        dataAdapter: BaseAdapter
      }) {
        const { block, signal, dataAdapter } = param
        const features = new Map<string, Feature>()
        const featureObservable = self.blockFeatureCache.get(block.key, {
          dataAdapter,
          block,
        })
        featureObservable
          .pipe(
            tap(() => checkAbortSignal(signal)),
            filter((feature: Feature) => this.featurePassesFilters(feature)),
            tap((feature: Feature) => {
              const id = feature.id()
              if (!id) {
                throw new Error(`invalid feature id "${id}"`)
              }
              features.set(id, feature)
            }),
            ignoreElements(),
          )
          .toPromise()
          .then(() => this.setBlockFeatures(block.key, features))
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              const abortController = new AbortController()
              const { signal } = abortController
              const { dataAdapter } = getAdapter(
                pluginManager,
                getConf(self, 'trackId'),
                self.adapterConfig.type,
                self.adapterConfig,
                null,
                null,
              )

              const parentView = getParent(self, 2) as any

              parentView.views.forEach((subview: any, index: number) => {
                subview.staticBlocks
                  .filter((block: Block) => 'refName' in block)
                  .forEach((block: Block) => {
                    if (!self.blockFeatureCache.has(block.key)) {
                      this.fillBlockFeatures({ block, dataAdapter, signal })
                    }
                  })
              })
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(
            async () => {
              this.renderSynteny(self.blockFeatures)
            },
            { delay: 1000 },
          ),
        )
      },
      setBlockFeatures(blockKey: string, features: Map<string, Feature>) {
        self.blockFeatures.set(blockKey, features)
      },
    }))
}

export type LinearSyntenyTrack = ReturnType<typeof stateModelFactory>
export type LinearSyntenyTrackModel = Instance<LinearSyntenyTrack>

// ).map(f =>
//   f
//     .flat()
//     .sort(
//       (a: Feature, b: Feature) =>
//         a.get('syntenyId') - b.get('syntenyId'),
//     ),
// )

// function getMatches(l1: Feature[], l2: Feature[]) {
//   let i = 0
//   let j = 0
//   const res = []
//   while (i < l1.length && j < l2.length) {
//     const x = l1[i]
//     const y = l2[j]
//     const a = x.get('syntenyId')
//     const b = y.get('syntenyId')
//     if (a == b) {
//       res.push([x, y])
//       i++
//       j++
//     } else if (a < b) {
//       i++
//     } else {
//       j++
//     }
//   }
//   return res
// }
// console.log(getMatches(blockFeats[0], blockFeats[1]))

// console.log(blockFeats)
