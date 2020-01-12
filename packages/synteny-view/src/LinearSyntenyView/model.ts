/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getSession } from '@gmod/jbrowse-core/util'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import { types, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getConf } from '@gmod/jbrowse-core/configuration'

export type LayoutRecord = [number, number, number, number]
export interface SimpleAnchorsData {
  [key: number]: {
    name1: string
    name2: string
    name3: string
    name4: string
    score: number
    strand: string
  }
}
export interface AnchorsData {
  [key: number]: {
    name1: string
    name2: string
    score: number
  }
}
export interface PafRecord {
  chr1: string
  start1: number
  end1: number
  strand1: string
  chr2: string
  start2: number
  end2: number
}

type LGV = Instance<LinearGenomeViewStateModel>
type ConfigRelationship = { type: string; target: string }

// Get the syntenyGroup type from the tracks configRelationships
function getSyntenyGroup(track: Instance<BaseTrackStateModel>) {
  const rels: ConfigRelationship[] = getConf(track, 'configRelationships') || []
  const t = rels.find(f => f.type === 'syntenyGroup')
  return t ? t.target : undefined
}

function getLength(cigar: string) {
  const recs = cigar.split(/([MIDNSHPX=])/)
  let lref = 0
  for (let c = 0; c < recs.length; c += 2) {
    const len = recs[c]
    const op = recs[c + 1]

    // soft clip, hard clip, and insertion don't count toward
    // the length on the reference
    if (op !== 'H' && op !== 'S' && op !== 'I') lref += +len
  }
  return lref
}

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const {
    types: jbrequiredTypes,
    getParent,
    onAction,
    addDisposer,
    getPath,
  } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const configSchema = ConfigurationSchema(
    'LinearSyntenyView',
    {
      anchors: {
        type: 'string',
        defaultValue: '',
      },
      simpleAnchors: {
        type: 'string',
        defaultValue: '',
      },
      paf: {
        type: 'string',
        defaultValue: '',
      },
      sam: {
        type: 'string',
        defaultValue: '',
      },
      middle: {
        type: 'boolean',
        defaultValue: false,
      },
      hideTiny: {
        type: 'boolean',
        defaultValue: false,
      },
      showAnchors: {
        type: 'boolean',
        defaultValue: true,
      },
      showSimpleAnchors: {
        type: 'boolean',
        defaultValue: true,
      },
      showPaf: {
        type: 'boolean',
        defaultValue: true,
      },
      showSam: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    { explicitlyTyped: true, implicitIdentifier: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = (jbrequiredTypes as Instance<typeof types>)
    .model('LinearSyntenyView', {
      id: ElementId,
      type: types.literal('LinearSyntenyView'),
      headerHeight: 0,
      width: 800,
      height: types.optional(
        types.refinement(
          'viewHeight',
          types.number,
          (n: number) => n >= minHeight,
        ),
        defaultHeight,
      ),
      displayName: 'synteny detail',
      configuration: configSchema,
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: false,
      interactToggled: false,
      views: types.array(pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel),
    })
    .volatile(self => ({
      anchors: undefined as { [key: string]: number } | undefined,
      simpleAnchors: undefined as { [key: string]: number } | undefined,
      minimap2Data: undefined as PafRecord[] | undefined,
      samData: undefined as PafRecord[] | undefined,
      simpleAnchorsData: undefined as SimpleAnchorsData | undefined,
      anchorsData: undefined as AnchorsData | undefined,
    }))
    .views(self => ({
      get controlsWidth() {
        return self.views.length ? self.views[0].controlsWidth : 0
      },

      get refNames() {
        return (self.views || []).map(v => [
          ...new Set(v.staticBlocks.map(m => m.refName)),
        ])
      },

      // Looks at the syntenyGroup type in the configRelationships and determines
      // all the unique ones
      get syntenyGroups(): string[] {
        const groups = new Set<string>()
        self.views.forEach(view => {
          view.tracks.forEach(track => {
            const g = getSyntenyGroup(track)
            if (g) groups.add(g)
          })
        })
        return Array.from(groups)
      },

      get assemblyNames() {
        return [...new Set(self.views.map(v => v.assemblyNames).flat())]
      },

      // Get tracks with a given syntenyGroup across multiple views
      getSyntenyGroupTracks(syntenyGroup: string) {
        return self.views.map(view =>
          view.tracks.find(track => getSyntenyGroup(track) === syntenyGroup),
        )
      },

      // Get tracks with a given syntenyGroup across multiple views
      getSyntenyTrackFromView(view: LGV, syntenyGroup: string) {
        return view.tracks.find(
          track => getSyntenyGroup(track) === syntenyGroup,
        )
      },

      // Get a composite map of featureId->feature map for a track
      // across multiple views
      getTrackFeatures(syntenyGroup: string) {
        const tracks = this.getSyntenyGroupTracks(syntenyGroup).filter(f => !!f)
        return new CompositeMap<string, Feature>(tracks.map(t => t.features))
      },

      get allMatchedSyntenyFeatures() {
        return Object.fromEntries(
          this.syntenyGroups.map(group => [
            group,
            this.getMatchedSyntenyFeatures(group),
          ]),
        )
      },

      get allMatchedAnchorFeatures() {
        return Object.fromEntries(
          this.syntenyGroups.map(group => [
            group,
            this.getAnchorFeatures(group),
          ]),
        )
      },

      get allMatchedSimpleAnchorFeatures() {
        return Object.fromEntries(
          this.syntenyGroups.map(group => [
            group,
            this.getSimpleAnchorFeatures(group),
          ]),
        )
      },

      getFeaturesOverlappingBlock(
        data: PafRecord[] | undefined,
        assembly: number,
        block: { start: number; end: number; refName: string },
      ) {
        return (data || []).filter(row => {
          if (assembly === 0) {
            if (block.refName === row.chr1) {
              return doesIntersect2(
                block.start,
                block.end,
                row.start1,
                row.end1,
              )
            }
          } else if (assembly === 1) {
            if (block.refName === row.chr2) {
              return doesIntersect2(
                block.start,
                block.end,
                row.start2,
                row.end2,
              )
            }
          }
          return false
        })
      },

      getFeatures(data: any) {
        const r1t = self.views[0].staticBlocks.map(block => {
          return this.getFeaturesOverlappingBlock(data, 0, block)
        })
        const r1 = r1t.flat().map((row, i) => {
          return [
            {
              layout: [row.start1, 0, row.end1, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-1-1`,
                  start: row.start1,
                  end: row.end1,
                },
              }),
              level: 0,
              refName: row.chr1,
            },
            {
              layout: [row.start2, 0, row.end2, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-1-2`,
                  start: row.start2,
                  end: row.end2,
                },
              }),
              level: 1,
              refName: row.chr2,
            },
          ]
        })

        const r2t = self.views[1].staticBlocks.map(block => {
          return this.getFeaturesOverlappingBlock(data, 1, block)
        })

        const r2 = r2t.flat().map((row, i) => {
          return [
            {
              layout: [row.start1, 0, row.end1, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-2-1`,
                  start: row.start1,
                  end: row.end1,
                },
              }),
              level: 0,
              refName: row.chr1,
            },
            {
              layout: [row.start2, 0, row.end2, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-2-2`,
                  start: row.start2,
                  end: row.end2,
                },
              }),
              level: 1,
              refName: row.chr2,
            },
          ]
        })

        return r1.concat(r2)
      },

      // This finds candidate syntenic connections
      get minimap2Features() {
        return this.getFeatures(self.minimap2Data)
      },

      // This finds candidate syntenic connections
      get samFeatures() {
        return this.getFeatures(self.samData)
      },

      // This finds candidate syntenic connections from MCSCan x.y.anchors file
      getAnchorFeatures(syntenyGroup: string) {
        const features = this.getTrackFeatures(syntenyGroup)
        const alreadySeen = new Set<number>()
        const featNameMap: { [key: string]: Feature } = {}

        if (!self.anchorsData || !self.anchors) {
          return []
        }

        // this finds candidate features that share the same name
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
        return ret
      },

      // This finds candidate syntenic connections from MCSCan x.y.anchors.simple file
      getSimpleAnchorFeatures(syntenyGroup: string) {
        const features = this.getTrackFeatures(syntenyGroup)
        const alreadySeen = new Set<number>()
        const featNameMap: { [key: string]: Feature } = {}

        if (!self.simpleAnchorsData || !self.simpleAnchors) {
          return []
        }

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          const n = self.simpleAnchors[feature.get('name')]
          featNameMap[feature.get('name')] = feature

          if (n !== undefined) {
            alreadySeen.add(n)
          }
        }

        const blocks = Array.from(alreadySeen)
        const ret = []

        for (const block of blocks) {
          const r = self.simpleAnchorsData[block]
          if (r) {
            const r1 = featNameMap[r.name1]
            const r2 = featNameMap[r.name2]
            const r3 = featNameMap[r.name3]
            const r4 = featNameMap[r.name4]
            if (!r1 || !r2 || !r3 || !r4) {
              // alt logic (r1 && r2) || !(r3 && r4)
              // eslint-disable-next-line no-continue
              continue
            }
            const s1 = Math.min(r1.get('start'), r2.get('start'))
            const e1 = Math.max(r1.get('end'), r2.get('end'))
            const s2 = Math.min(r3.get('start'), r4.get('start'))
            const e2 = Math.max(r3.get('end'), r4.get('end'))

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
                refName: r3.get('refName') as string,
              },
            ])
          }
        }
        return ret
      },

      // This finds candidate syntenic connections
      getMatchedSyntenyFeatures(syntenyGroup: string) {
        const features = this.getTrackFeatures(syntenyGroup)
        const candidates: { [key: string]: Feature[] } = {}
        const alreadySeen = new Set<string>()

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          if (!alreadySeen.has(feature.id())) {
            const n = feature.get('name')
            if (!candidates[n]) {
              candidates[n] = []
            }
            candidates[n].push(feature)
          }
          alreadySeen.add(feature.id())
        }

        return Object.values(candidates).filter(v => v.length > 1)
      },

      getMatchedFeaturesInLayout(syntenyGroup: string, features: Feature[][]) {
        const tracks = this.getSyntenyGroupTracks(syntenyGroup)
        return features.map(c =>
          c.map((feature: Feature) => {
            let layout: LayoutRecord | undefined
            let refName = ''
            const level = tracks.findIndex(track => {
              if (track) {
                layout = track.layoutFeatures.get(feature.id())
                refName = (track.featToBlock[feature.id()] || {}).refName
                return layout
              }
              return undefined
            })
            return {
              feature,
              refName,
              layout,
              level,
            }
          }),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(
            self,
            ({
              name,
              path,
              args,
            }: {
              name: string
              path: string
              args: any[]
            }) => {
              if (self.linkViews) {
                if (['horizontalScroll', 'zoomTo'].includes(name)) {
                  this.onSubviewAction(name, path, args)
                }
              }
            },
          ),
        )

        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const simpleAnchors = getConf(self, 'simpleAnchors')
                const anchors = getConf(self, 'anchors')
                const pafData = getConf(self, 'paf')
                const samData = getConf(self, 'sam')
                if (simpleAnchors) {
                  const data = await fetch(simpleAnchors)
                  const text = await data.text()
                  const m: { [key: string]: number } = {}
                  const r: SimpleAnchorsData = {}
                  text.split('\n').forEach((line: string, index: number) => {
                    if (line.length) {
                      if (line !== '###') {
                        const [
                          name1,
                          name2,
                          name3,
                          name4,
                          score,
                          strand,
                        ] = line.split('\t')
                        m[name1] = index
                        m[name2] = index
                        m[name3] = index
                        m[name4] = index
                        r[index] = {
                          name1,
                          name2,
                          name3,
                          name4,
                          score: +score,
                          strand,
                        }
                      }
                    }
                  })

                  this.setSimpleAnchorsData(m, r)
                }
                if (anchors) {
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
                }
                if (pafData) {
                  const data = await fetch(pafData)
                  const text = await data.text()
                  const m: PafRecord[] = []
                  text.split('\n').forEach((line: string, index: number) => {
                    if (line.length) {
                      const [
                        chr1,
                        ,
                        start1,
                        end1,
                        strand1,
                        chr2,
                        ,
                        start2,
                        end2,
                      ] = line.split('\t')
                      m[index] = {
                        chr1,
                        start1: +start1,
                        end1: +end1,
                        strand1,
                        chr2,
                        start2: +start2,
                        end2: +end2,
                      }
                    }
                  })

                  this.setMinimap2Data(m)
                }
                if (samData) {
                  const data = await fetch(samData)
                  const text = await data.text()
                  const m: PafRecord[] = []
                  text.split('\n').forEach((line: string, index: number) => {
                    if (line.length) {
                      // eslint-disable-next-line prefer-const
                      let [chr2, flag, chr1, start1, mapq, cigar] = line.split(
                        '\t',
                      )
                      const start = +start1 + 17027008
                      const start2 = 1458099
                      const recs = cigar.split(/([MIDNSHPX=])/)
                      let curR1 = start
                      let curR2 = start2
                      for (let i = 0; i < recs.length; i += 2) {
                        const len = +recs[i]
                        const op = recs[i + 1]
                        if (op === 'H') {
                          curR2 += len
                        } else if (op === 'M') {
                          m.push({
                            chr1,
                            start1: curR1,
                            end1: curR1 + len,
                            strand1: '+',
                            chr2,
                            start2: curR2,
                            end2: curR2 + len,
                          })
                          curR1 += len
                          curR2 += len
                        } else if (op === 'D') {
                          m.push({
                            chr1,
                            start1: curR1,
                            end1: curR1 + len,
                            strand1: '+',
                            chr2,
                            start2: curR2,
                            end2: curR2,
                          })
                          curR1 += len
                        } else if (op === 'I') {
                          m.push({
                            chr1,
                            start1: curR1,
                            end1: curR1,
                            strand1: '+',
                            chr2,
                            start2: curR2,
                            end2: curR2 + len,
                          })
                          curR2 += len
                        }
                      }
                    }
                  })

                  this.setSamData(m)
                }
              } catch (e) {
                console.error(e)
                throw e
              }
            },
            { delay: 1000 },
          ),
        )
      },

      onSubviewAction(actionName: string, path: string, args: any[]) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (ret.lastIndexOf(path) !== ret.length - path.length) {
            // @ts-ignore
            view[actionName](args[0])
          }
        })
      },

      setDisplayName(name: string) {
        self.displayName = name
      },

      setWidth(newWidth: number) {
        self.width = newWidth
        self.views.forEach(v => v.setWidth(newWidth))
      },

      removeView(view: LGV) {
        self.views.remove(view)
      },

      setSimpleAnchorsData(
        simpleAnchors: { [key: string]: number },
        simpleAnchorsData: SimpleAnchorsData,
      ) {
        self.simpleAnchors = simpleAnchors
        self.simpleAnchorsData = simpleAnchorsData
      },

      setAnchorsData(
        anchors: { [key: string]: number },
        anchorsData: AnchorsData,
      ) {
        self.anchors = anchors
        self.anchorsData = anchorsData
      },

      setMinimap2Data(minimap2Data: PafRecord[]) {
        self.minimap2Data = minimap2Data
      },

      setSamData(samData: PafRecord[]) {
        self.samData = samData
      },
      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      activateConfigurationUI() {
        // @ts-ignore
        getSession(self).editConfiguration(self.configuration)
      },

      toggleInteract() {
        self.interactToggled = !self.interactToggled
      },
      toggleIntraviewLinks() {
        self.showIntraviewLinks = !self.showIntraviewLinks
      },
      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session: any = getSession(self)
          const selector = session.addDrawerWidget(
            'HierarchicalTrackSelectorDrawerWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showDrawerWidget(selector)
          return selector
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },
    }))

  return { stateModel, configSchema }
}

export type LinearSyntenyView = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewStateModel = LinearSyntenyView['stateModel']
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
