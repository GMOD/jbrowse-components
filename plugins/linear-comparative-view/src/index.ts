import PluginManager from '@gmod/jbrowse-core/PluginManager'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
import { autorun } from 'mobx'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import AddIcon from '@material-ui/icons/Add'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  getSession,
} from '@gmod/jbrowse-core/util'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
// eslint-disable-next-line import/no-extraneous-dependencies
import { parseCigar } from '@gmod/jbrowse-plugin-alignments/src/BamAdapter/MismatchParser'
import {
  configSchemaFactory as comparativeTrackConfigSchemaFactory,
  stateModelFactory as comparativeTrackStateModelFactory,
} from './LinearComparativeTrack'
import {
  configSchemaFactory as syntenyTrackConfigSchemaFactory,
  stateModelFactory as syntenyTrackStateModelFactory,
} from './LinearSyntenyTrack'
import {
  configSchema as MCScanAnchorsConfigSchema,
  AdapterClass as MCScanAnchorsAdapter,
} from './MCScanAnchorsAdapter'
import LinearSyntenyRenderer, {
  configSchema as linearSyntenyRendererConfigSchema,
  ReactComponent as LinearSyntenyRendererReactComponent,
} from './LinearSyntenyRenderer'

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
  syntenyId?: number
  uniqueId: string
  mate: {
    refName: string
    start: number
    end: number
    syntenyId?: number
    uniqueId?: string
  }
}

export default class extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearComparativeView')),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearSyntenyView')),
    )

    pluginManager.addTrackType(() => {
      const configSchema = comparativeTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        compatibleView: 'LinearComparativeView',
        name: 'LinearComparativeTrack',
        configSchema,
        stateModel: comparativeTrackStateModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addTrackType(() => {
      const configSchema = syntenyTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        compatibleView: 'LinearSyntenyView',
        name: 'LinearSyntenyTrack',
        configSchema,
        stateModel: syntenyTrackStateModelFactory(pluginManager, configSchema),
      })
    })
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          configSchema: MCScanAnchorsConfigSchema,
          AdapterClass: MCScanAnchorsAdapter,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new LinearSyntenyRenderer({
          name: 'LinearSyntenyRenderer',
          configSchema: linearSyntenyRendererConfigSchema,
          ReactComponent: LinearSyntenyRendererReactComponent,
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }

    const cb = (feature: Feature, track: IAnyStateTreeNode) => {
      return feature
        ? [
            {
              label: 'Linear read vs ref',
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
                  .map((aln, index) => {
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
                      uniqueId: `${feature.id()}_SA${index}`,
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
                features.forEach((f, index) => {
                  f.syntenyId = index
                  f.mate.syntenyId = index
                  f.mate.uniqueId = `${f.uniqueId}_mate`
                })
                features.sort((a, b) => a.clipPos - b.clipPos)

                // the config feature store includes synthetic mate features
                // mapped to the read assembly
                const configFeatureStore = features.concat(
                  // @ts-ignore
                  features.map(f => f.mate),
                )

                session.addView('LinearSyntenyView', {
                  type: 'LinearSyntenyView',
                  views: [
                    {
                      type: 'LinearGenomeView',
                      hideHeader: true,
                      offsetPx: 0,
                      bpPerPx: (end - start) / 800,
                      displayedRegions: features.map(f => {
                        return {
                          start: f.start,
                          end: f.end,
                          refName: f.refName,
                          assemblyName: trackAssembly,
                        }
                      }),
                    },
                    {
                      type: 'LinearGenomeView',
                      hideHeader: true,
                      offsetPx: 0,
                      bpPerPx: totalLength / 800,
                      displayedRegions: [
                        {
                          assemblyName: readAssembly,
                          start: 0,
                          end: totalLength,
                          refName: readName,
                        },
                      ],
                    },
                  ],
                  viewTrackConfigs: [
                    {
                      type: 'LinearSyntenyTrack',
                      assemblyNames,
                      adapter: {
                        type: 'FromConfigAdapter',
                        features: configFeatureStore,
                      },
                      renderer: {
                        type: 'LinearSyntenyRenderer',
                      },
                      trackId: trackName,
                    },
                  ],
                  tracks: [
                    { configuration: trackName, type: 'LinearSyntenyTrack' },
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
