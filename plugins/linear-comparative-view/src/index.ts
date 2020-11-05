import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getSession,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import AddIcon from '@material-ui/icons/Add'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
import { autorun } from 'mobx'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import {
  configSchemaFactory as linearComparativeDisplayConfigSchemaFactory,
  ReactComponent as LinearComparativeDisplayReactComponent,
  stateModelFactory as linearComparativeDisplayStateModelFactory,
} from './LinearComparativeDisplay'
import LinearComparativeViewFactory from './LinearComparativeView'
import {
  configSchemaFactory as linearSyntenyDisplayConfigSchemaFactory,
  stateModelFactory as linearSyntenyDisplayStateModelFactory,
} from './LinearSyntenyDisplay'
import LinearSyntenyRenderer, {
  configSchema as linearSyntenyRendererConfigSchema,
  ReactComponent as LinearSyntenyRendererReactComponent,
} from './LinearSyntenyRenderer'
import LinearSyntenyViewFactory from './LinearSyntenyView'
import {
  AdapterClass as MCScanAnchorsAdapter,
  configSchema as MCScanAnchorsConfigSchema,
} from './MCScanAnchorsAdapter'

const { parseCigar } = MismatchParser

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
  views?: View[]
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
    if (op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

function getLengthSansClipping(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'D' && op !== 'N') {
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
      pluginManager.jbrequire(LinearComparativeViewFactory),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearSyntenyViewFactory),
    )

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'SyntenyTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      return new TrackType({
        name: 'SyntenyTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'SyntenyTrack',
          configSchema,
        ),
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearComparativeDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearComparativeDisplay',
        configSchema,
        stateModel: linearComparativeDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearComparativeView',
        ReactComponent: LinearComparativeDisplayReactComponent,
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearSyntenyDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearSyntenyDisplay',
        configSchema,
        stateModel: linearSyntenyDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearSyntenyView',
        ReactComponent: LinearComparativeDisplayReactComponent,
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
                const clipPos = feature.get('clipPos')
                const cigar = feature.get('CIGAR')
                const flags = feature.get('flags')
                const SA: string =
                  (feature.get('tags')
                    ? feature.get('tags').SA
                    : feature.get('SA')) || ''
                const readName = feature.get('name')
                const readAssembly = `${readName}_assembly`
                const trackAssembly = getConf(track, 'assemblyNames')[0]
                const assemblyNames = [trackAssembly, readAssembly]
                const trackId = `track-${Date.now()}`
                const trackName = `${readName}_vs_${trackAssembly}`
                const supplementaryAlignments = SA.split(';')
                  .filter(aln => !!aln)
                  .map((aln, index) => {
                    const [saRef, saStart, saStrand, saCigar] = aln.split(',')
                    const saLengthOnRef = getLengthOnRef(saCigar)
                    const saLength = getLength(saCigar)
                    const saLengthSansClipping = getLengthSansClipping(saCigar)
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
                        end: saClipPos + saLengthSansClipping,
                        refName: readName,
                      },
                    }
                  })

                const feat = feature.toJSON()

                feat.mate = {
                  refName: readName,
                  start: clipPos,
                  end: clipPos + getLengthSansClipping(cigar),
                }

                // if secondary alignment or supplementary, calculate length from SA[0]'s CIGAR
                // which is the primary alignments. otherwise it is the primary alignment just use
                // seq.length if primary alignment
                const totalLength =
                  // eslint-disable-next-line no-bitwise
                  flags & 2048
                    ? getLength(supplementaryAlignments[0].CIGAR)
                    : getLength(cigar)

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

                const refLength = features.reduce(
                  (a, f) => a + f.end - f.start,
                  0,
                )

                session.addView('LinearSyntenyView', {
                  type: 'LinearSyntenyView',
                  views: [
                    {
                      type: 'LinearGenomeView',
                      hideHeader: true,
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
                      trackId,
                      name: trackName,
                    },
                  ],
                  tracks: [
                    {
                      configuration: trackId,
                      type: 'LinearSyntenyTrack',
                    },
                  ],
                  displayName: `${readName} vs ${trackAssembly}`,
                })
              },
            },
          ]
        : []
    }
    function addContextMenu(view: View) {
      if (view.type === 'LinearGenomeView') {
        view.tracks.forEach(track => {
          if (
            track.type === 'PileupTrack' &&
            !track.additionalContextMenuItemCallbacks.includes(cb)
          ) {
            track.addAdditionalContextMenuItemCallback(cb)
          } else if (
            track.type === 'AlignmentsTrack' &&
            track.PileupTrack &&
            !track.PileupTrack.additionalContextMenuItemCallbacks.includes(cb)
          ) {
            track.PileupTrack.addAdditionalContextMenuItemCallback(cb)
          }
        })
      }
    }
    autorun(() => {
      const session = pluginManager.rootModel?.session as Session | undefined
      if (session) {
        session.views.forEach(view => {
          if (view.views) {
            view.views.forEach(v => addContextMenu(v))
          } else {
            addContextMenu(view)
          }
        })
      }
    })
  }
}
