/* eslint-disable @typescript-eslint/no-explicit-any */
import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import SomeIcon from '@material-ui/icons/Add'
import { autorun } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
import Base1DView from '@gmod/jbrowse-core/util/Base1DViewModel'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  getSession,
} from '@gmod/jbrowse-core/util'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import TimelineIcon from '@material-ui/icons/Timeline'
// eslint-disable-next-line import/no-extraneous-dependencies
import { parseCigar } from '@gmod/jbrowse-plugin-alignments/src/BamAdapter/MismatchParser'
import {
  configSchemaFactory as dotplotTrackConfigSchemaFactory,
  stateModelFactory as dotplotTrackStateModelFactory,
} from './DotplotTrack'
import DotplotRenderer, {
  configSchema as dotplotRendererConfigSchema,
  ReactComponent as DotplotRendererReactComponent,
} from './DotplotRenderer'

import {
  configSchema as PAFAdapterConfigSchema,
  AdapterClass as PAFAdapter,
} from './PAFAdapter'
import ComparativeRender from './DotplotRenderer/ComparativeRenderRpc'

interface Track {
  addAdditionalContextMenuItemCallback: Function
  id: string
  type: string
  PileupTrack: any
}
interface View {
  tracks: Track[]
  type: string
}
interface Session {
  views: View[]
}
function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let lengthOnRef = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'I') {
      lengthOnRef += len
    }
  }
  return lengthOnRef
}

function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(cigar.match(/(\d+)[SH]$/) || [])[1] || 0
    : +(cigar.match(/^(\d+)([SH])/) || [])[1] || 0
}

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./DotplotView')),
    )
    pluginManager.addTrackType(() => {
      const configSchema = dotplotTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DotplotTrack',
        compatibleView: 'DotplotView',
        configSchema,
        stateModel: dotplotTrackStateModelFactory(pluginManager, configSchema),
      })
    })

    pluginManager.addRendererType(
      () =>
        new DotplotRenderer({
          name: 'DotplotRenderer',
          configSchema: dotplotRendererConfigSchema,
          ReactComponent: DotplotRendererReactComponent,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'PAFAdapter',
          configSchema: PAFAdapterConfigSchema,
          AdapterClass: PAFAdapter,
        }),
    )

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRender(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('DotplotView', {})
        },
      })
    }

    const menuItems = (feature: Feature, track: any) => {
      return feature
        ? [
            {
              label: 'Dotplot of read vs ref',
              icon: SomeIcon,
              onClick: () => {
                const session = getSession(track)
                const start = feature.get('start')
                const clipPos = feature.get('clipPos')
                const end = feature.get('end')
                const SA: string =
                  (feature.get('tags')
                    ? feature.get('tags').SA
                    : feature.get('SA')) || ''
                const refName = feature.get('refName')
                const readName = feature.get('name')
                const readAssembly = `${readName}_assembly`
                const trackAssembly = getConf(track, 'assemblyNames')[0]
                const assemblyNames = [trackAssembly, readAssembly]
                const trackName = `${readName}_vs_${trackAssembly}`
                const supplementaryAlignments = SA.split(';')
                  .filter(aln => !!aln)
                  .map(aln => {
                    const [saRef, saStart, saStrand, saCigar] = aln.split(',')
                    const saLengthOnRef = getLengthOnRef(saCigar)
                    const saClipPos = getClip(
                      saCigar,
                      saStrand === '-' ? -1 : 1,
                    )
                    const saRealStart = +saStart - 1 + saClipPos

                    return {
                      refName: saRef,
                      start: saRealStart,
                      end: saRealStart + saLengthOnRef,
                      clipPos: saClipPos,
                      assemblyName: trackAssembly,
                      strand: saStrand,
                      uniqueId: Math.random(),
                      mate: {
                        start: saClipPos,
                        end: saClipPos + saLengthOnRef,
                        refName: readName,
                      },
                    }
                  })

                const feat = feature.toJSON()
                feat.mate = {
                  refName: readName,
                  start: clipPos,
                  end: end - start + clipPos,
                }
                const features = [feat, ...supplementaryAlignments] as {
                  refName: string
                  start: number
                  clipPos: number
                  end: number
                }[]

                features.sort((a, b) => a.clipPos - b.clipPos)
                const totalLength = features.reduce(
                  (accum, f: { end: number; start: number }) =>
                    accum + f.end - f.start,
                  0,
                )

                // @ts-ignore
                session.addAssemblyConf({
                  name: readAssembly,
                  sequence: {
                    type: 'ReferenceSequenceTrack',
                    trackId: `${readName}_track`,
                    adapter: {
                      type: 'FromConfigSequenceAdapter',
                      features: [feature.toJSON()],
                    },
                  },
                })

                const d1 = Base1DView.create({
                  offsetPx: 0,
                  bpPerPx: (end - start) / 800,
                  displayedRegions: [
                    {
                      start,
                      end,
                      refName,
                      assemblyName: trackAssembly,
                    },
                    ...supplementaryAlignments,
                  ],
                })
                const d2 = Base1DView.create({
                  offsetPx: 0,
                  bpPerPx: totalLength / 800,
                  displayedRegions: [
                    {
                      assemblyName: readAssembly,
                      start: 0,
                      end: totalLength + 1000, // todo properly calculate seq length by enumerating all CIGARs
                      refName: readName,
                    },
                  ],
                })

                // @ts-ignore
                session.addTrackConf({
                  type: 'DotplotTrack',
                  assemblyNames,
                  adapter: {
                    type: 'FromConfigAdapter',
                    features,
                  },
                  trackId: trackName,
                })

                session.addView('DotplotView', {
                  type: 'DotplotView',
                  hview: getSnapshot(d1),
                  vview: getSnapshot(d2),
                  assemblyNames,
                  tracks: [
                    {
                      configuration: trackName,
                      type: 'DotplotTrack',
                    },
                  ],
                  displayName: `${readName} vs ${trackAssembly}`,
                })
              },
            },
          ]
        : []
    }
    const { rootModel: { session } = {} } = pluginManager
    if (session) {
      const tracksAlreadyAddedTo: string[] = []
      autorun(() => {
        const { views } = (session as unknown) as Session
        views.forEach(view => {
          if (view.type === 'LinearGenomeView') {
            const { tracks } = view
            tracks.forEach(track => {
              const { type } = track
              if (!tracksAlreadyAddedTo.includes(track.id)) {
                if (type === 'PileupTrack') {
                  tracksAlreadyAddedTo.push(track.id)
                  track.addAdditionalContextMenuItemCallback(menuItems)
                } else if (type === 'AlignmentsTrack') {
                  tracksAlreadyAddedTo.push(track.id)
                  track.PileupTrack.addAdditionalContextMenuItemCallback(
                    menuItems,
                  )
                }
              }
            })
          }
        })
      })
    }
  }
}
