import {
  types,
  getSnapshot,
  getParent,
  addDisposer,
  Instance,
} from 'mobx-state-tree'
import { autorun } from 'mobx'
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { getSession, getContainingView } from '@gmod/jbrowse-core/util'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { LayoutRecord } from '../LinearComparativeView/model'

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
        console.log(this.subtracks)
        return new CompositeMap<string, Feature>(
          this.subtracks.map(t => t.features),
        )
      },

      get layoutMatches() {
        const features = this.trackFeatures
        const alreadySeen = new Set<number>()
        const featNameMap: { [key: string]: Feature } = {}
        console.log('layoutMatches', self.anchors)

        if (!self.anchorsData || !self.anchors) {
          return []
        } // this finds candidate features that share the same name

        for (const feature of features.values()) {
          const n = self.anchors[feature.get('name')]
          featNameMap[feature.get('name')] = feature

          if (n !== undefined) {
            alreadySeen.add(n)
          }
        }

        const blocks = Array.from(alreadySeen)
        const ret = []

        for (const block of blocks) {
          const r = self.anchorsData[block]
          if (r) {
            const r1 = featNameMap[r.name1]
            const r2 = featNameMap[r.name2]
            if (!r1 || !r2) {
              // alt logic (r1 && r2) || !(r3 && r4)
              // eslint-disable-next-line no-continue
              continue
            }
            const s1 = r1.get('start')
            const e1 = r1.get('end')
            const s2 = r2.get('start')
            const e2 = r2.get('end')

            ret.push([
              {
                layout: [s1, 0, e1, 10] as LayoutRecord,
                feature: new SimpleFeature({
                  data: { uniqueId: `${block}-1`, start: s1, end: e1 },
                }),
                level: 1,
                refName: r1.get('refName') as string,
              },
              {
                layout: [s2, 0, e2, 10] as LayoutRecord,
                feature: new SimpleFeature({
                  data: { uniqueId: `${block}-2`, start: s2, end: e2 },
                }),
                level: 0,
                refName: r2.get('refName') as string,
              },
            ])
          }
        }
        console.log(ret)
        return ret
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
              try {
                const aborter = new AbortController()
                this.downloadAnchors({ signal: aborter.signal })
                // self.setLoading(aborter)
                // const stats = await getStats(aborter.signal)
                // if (isAlive(self)) {
                //   self.updateStats(stats)
                // }
              } catch (e) {
                console.error(e)
                // if (!isAbortException(e) && isAlive(self)) {
                //   self.setError(e)
                // }
              }
            },
            { delay: 1000 },
          ),
        )
      },
      async downloadAnchors(opts: { signal: AbortSignal }) {
        const anchors = getConf(self, 'mcscanAnchors')

        const text = (await openLocation(anchors).readFile('utf8')) as string
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
