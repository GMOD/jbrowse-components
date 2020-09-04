import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import AddIcon from '@material-ui/icons/Add'
import { autorun } from 'mobx'
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
import { IAnyStateTreeNode } from 'mobx-state-tree'
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
  additionalContextMenuItemCallbacks: Function[]
  id: string
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function getLength(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'D') {
      length += len
    }
  }
  return length
}

function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(cigar.match(/(\d+)[SH]$/) || [])[1] || 0
    : +(cigar.match(/^(\d+)([SH])/) || [])[1] || 0
}

interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  seqLength: number
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

    const cb = (feature: Feature, track: IAnyStateTreeNode) => {
      return feature
        ? [
            {
              label: 'Dotplot of read vs ref',
              icon: AddIcon,
              onClick: () => {
                const session = getSession(track)
                const start = feature.get('start')
                const clipPos = feature.get('clipPos')
                const end = feature.get('end')
                const seq = feature.get('seq')
                const cigar = feature.get('CIGAR')
                const SA: string =
                  (feature.get('tags')
                    ? feature.get('tags').SA
                    : feature.get('SA')) || ''
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
                    const saLength = getLength(saCigar)
                    const saStrandNormalized = saStrand === '-' ? -1 : 1
                    const saClipPos = getClip(saCigar, saStrandNormalized)
                    const saRealStart = +saStart - 1 + saClipPos
                    return {
                      refName: saRef,
                      start: saRealStart,
                      end: saRealStart + saLengthOnRef,
                      seqLength: saLength,
                      clipPos: saClipPos,
                      CIGAR: saCigar,
                      assemblyName: trackAssembly,
                      strand: saStrandNormalized,
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

                // first in supplementaryAlignments is primary if this read
                // itself is not primary
                const totalLength = feat.secondary_alignment
                  ? getLength(supplementaryAlignments[0].CIGAR)
                  : getLength(cigar as string)

                // sanity check
                if (!feat.secondary_alignment && totalLength !== seq.length) {
                  console.warn(
                    `CIGAR calculation does not match feature seq on the
                    primary alignment ${seq.length} !== ${totalLength}`,
                  )
                }

                const features = [
                  feat,
                  ...supplementaryAlignments,
                ] as ReducedFeature[]

                features.sort((a, b) => a.clipPos - b.clipPos)

                const refLength = features.reduce(
                  (a, f) => a + f.end - f.start,
                  0,
                )

                session.addView('DotplotView', {
                  type: 'DotplotView',
                  hview: {
                    offsetPx: 0,
                    bpPerPx: refLength / 800,
                    displayedRegions: features.map(f => {
                      return {
                        start: f.start,
                        end: f.end,
                        refName: f.refName,
                        assemblyName: trackAssembly,
                      }
                    }),
                  },
                  vview: {
                    offsetPx: 0,
                    bpPerPx: totalLength / 400,
                    displayedRegions: [
                      {
                        assemblyName: readAssembly,
                        start: 0,
                        end: totalLength + 1000, // todo properly calculate seq length by enumerating all CIGARs
                        refName: readName,
                      },
                    ],
                  },
                  viewTrackConfigs: [
                    {
                      type: 'DotplotTrack',
                      assemblyNames,
                      adapter: {
                        type: 'FromConfigAdapter',
                        features,
                      },
                      trackId: trackName,
                    },
                  ],
                  viewAssemblyConfigs: [
                    {
                      name: readAssembly,
                      sequence: {
                        type: 'ReferenceSequenceTrack',
                        trackId: `${readName}_track`,
                        adapter: {
                          type: 'FromConfigSequenceAdapter',
                          features: [feature.toJSON()],
                        },
                      },
                    },
                  ],
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

    autorun(() => {
      const session = pluginManager.rootModel?.session as Session | undefined
      if (session) {
        session.views.forEach(view => {
          if (view.type === 'LinearGenomeView') {
            view.tracks.forEach(track => {
              if (
                track.type === 'PileupTrack' &&
                !track.additionalContextMenuItemCallbacks.includes(cb)
              ) {
                track.addAdditionalContextMenuItemCallback(cb)
              } else if (
                track.type === 'AlignmentsTrack' &&
                !track.PileupTrack.additionalContextMenuItemCallbacks.includes(
                  cb,
                )
              ) {
                track.PileupTrack.addAdditionalContextMenuItemCallback(cb)
              }
            })
          }
        })
      }
    })
  }
}
