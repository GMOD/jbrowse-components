import PluginManager from '@gmod/jbrowse-core/PluginManager'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
import { autorun } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
import Base1DView from '@gmod/jbrowse-core/util/Base1DViewModel'
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
  mate: {
    refName: string
    start: number
    end: number
    syntenyId?: number
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

    const cb = (feature: Feature, track: any) => {
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
                    // infer sequence length from SA tag's CIGAR
                    const saLength = getLength(saCigar)
                    const saClipPos = getClip(
                      saCigar,
                      saStrand === '-' ? -1 : 1,
                    )
                    const saRealStart = +saStart - 1 + saClipPos

                    return {
                      refName: saRef,
                      start: saRealStart,
                      end: saRealStart + saLengthOnRef,
                      seqLength: saLength,
                      clipPos: saClipPos,
                      CIGAR: saCigar,
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
                feat.seqLength = (feat.seq as string).length
                const features = [
                  feat,
                  ...supplementaryAlignments,
                ] as ReducedFeature[]
                features.forEach((f, index) => {
                  f.syntenyId = index
                  f.mate.syntenyId = index
                })
                features.concat(
                  // @ts-ignore
                  features.map(f => {
                    return f.mate
                  }),
                )

                features.sort((a, b) => a.clipPos - b.clipPos)
                const totalLength = features.reduce(
                  (accum, f) => accum + f.seqLength,
                  0,
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
                          end: totalLength + 1000, // todo properly calculate seq length by enumerating all CIGARs
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
                        features,
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
