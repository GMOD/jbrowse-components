import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import AddIcon from '@material-ui/icons/Add'
import { autorun } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  getSession,
} from '@jbrowse/core/util'

import { getConf } from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { AbstractDisplayModel } from '@jbrowse/core/util/types'
import TimelineIcon from '@material-ui/icons/Timeline'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import {
  configSchemaFactory as dotplotDisplayConfigSchemaFactory,
  stateModelFactory as dotplotDisplayStateModelFactory,
  ReactComponent as DotplotDisplayReactComponent,
} from './DotplotDisplay'
import DotplotRenderer, {
  configSchema as dotplotRendererConfigSchema,
  ReactComponent as DotplotRendererReactComponent,
} from './DotplotRenderer'
import stateModelFactory from './DotplotView/model'

import {
  configSchema as PAFAdapterConfigSchema,
  AdapterClass as PAFAdapter,
} from './PAFAdapter'
import ComparativeRender from './DotplotRenderer/ComparativeRenderRpc'

const { parseCigar } = MismatchParser

interface Track {
  id: string
  type: string
  displays: {
    addAdditionalContextMenuItemCallback: Function
    additionalContextMenuItemCallbacks: Function[]
    id: string
    type: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PileupDisplay: any
  }[]
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
}

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'DotplotView',
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./DotplotView/components/DotplotView'),
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = dotplotDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'DotplotDisplay',
        configSchema,
        stateModel: dotplotDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'DotplotView',
        ReactComponent: DotplotDisplayReactComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new DotplotRenderer({
          name: 'DotplotRenderer',
          configSchema: dotplotRendererConfigSchema,
          ReactComponent: DotplotRendererReactComponent,
          pluginManager,
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

    const cb = (
      feature: Feature,
      display: AbstractDisplayModel & IAnyStateTreeNode,
    ) => {
      const { parentTrack } = display
      return feature
        ? [
            {
              label: 'Dotplot of read vs ref',
              icon: AddIcon,
              onClick: () => {
                const session = getSession(display)
                const clipPos = feature.get('clipPos')
                const cigar = feature.get('CIGAR')
                const flags = feature.get('flags')
                const SA: string =
                  (feature.get('tags')
                    ? feature.get('tags').SA
                    : feature.get('SA')) || ''
                const readName = feature.get('name')
                const readAssembly = `${readName}_assembly`
                const [trackAssembly] = getConf(parentTrack, 'assemblyNames')
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
                    const saRealStart = +saStart - 1
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

                // if secondary alignment or supplementary, calculate length
                // from SA[0]'s CIGAR which is the primary alignments.
                // otherwise it is the primary alignment just use seq.length if
                // primary alignment
                const totalLength = getLength(
                  flags & 2048 ? supplementaryAlignments[0].CIGAR : cigar,
                )

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
                    minimumBlockWidth: 0,
                    interRegionPaddingWidth: 0,
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
                    minimumBlockWidth: 0,
                    interRegionPaddingWidth: 0,
                    displayedRegions: [
                      {
                        assemblyName: readAssembly,
                        start: 0,
                        end: totalLength,
                        refName: readName,
                      },
                    ],
                  },
                  viewTrackConfigs: [
                    {
                      type: 'SyntenyTrack',
                      assemblyNames,
                      adapter: {
                        type: 'FromConfigAdapter',
                        features,
                      },
                      trackId,
                      name: trackName,
                    },
                  ],
                  viewAssemblyConfigs: [
                    {
                      name: readAssembly,
                      sequence: {
                        type: 'ReferenceSequenceTrack',
                        trackId: `${readName}_${Date.now()}`,
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
                      configuration: trackId,
                      type: 'SyntenyTrack',
                      displays: [
                        {
                          type: 'DotplotDisplay',
                          configuration: `${trackId}-DotplotDisplay`,
                        },
                      ],
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
          if (track.type === 'AlignmentsTrack') {
            track.displays.forEach(display => {
              if (
                display.type === 'LinearPileupDisplay' &&
                !display.additionalContextMenuItemCallbacks.includes(cb)
              ) {
                display.addAdditionalContextMenuItemCallback(cb)
              } else if (
                display.type === 'LinearAlignmentsDisplay' &&
                display.PileupDisplay &&
                !display.PileupDisplay.additionalContextMenuItemCallbacks.includes(
                  cb,
                )
              ) {
                display.PileupDisplay.addAdditionalContextMenuItemCallback(cb)
              }
            })
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
