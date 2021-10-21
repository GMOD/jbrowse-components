import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import AddIcon from '@material-ui/icons/Add'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  getSession,
} from '@jbrowse/core/util'

import { getConf } from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import TimelineIcon from '@material-ui/icons/Timeline'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { FileLocation } from '@jbrowse/core/util/types'
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
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'
import {
  AdapterGuesser,
  getFileName,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

const { parseCigar } = MismatchParser

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

function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}

function mergeIntervals<T extends { start: number; end: number }>(
  intervals: T[],
  w = 5000,
) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals
  }

  const stack = []
  let top = null

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => a.start - b.start)

  // push the 1st interval into the stack
  stack.push(intervals[0])

  // start from the next interval and merge if needed
  for (let i = 1; i < intervals.length; i++) {
    // get the top element
    top = stack[stack.length - 1]

    // if the current interval doesn't overlap with the
    // stack top element, push it to the stack
    if (top.end + w < intervals[i].start - w) {
      stack.push(intervals[i])
    }
    // otherwise update the end value of the top element
    // if end of current interval is higher
    else if (top.end < intervals[i].end) {
      top.end = Math.max(top.end, intervals[i].end)
      stack.pop()
      stack.push(top)
    }
  }

  return stack
}

interface BasicFeature {
  end: number
  start: number
  refName: string
}

function gatherOverlaps(regions: BasicFeature[]) {
  const groups = regions.reduce((memo, x) => {
    if (!memo[x.refName]) {
      memo[x.refName] = []
    }
    memo[x.refName].push(x)
    return memo
  }, {} as { [key: string]: BasicFeature[] })

  return Object.values(groups)
    .map(group => mergeIntervals(group.sort((a, b) => a.start - b.start)))
    .flat()
}

interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  seqLength: number
}

function onClick(feature: Feature, self: LinearPileupDisplayModel) {
  const session = getSession(self)
  try {
    const cigar = feature.get('CIGAR')
    const clipPos = getClip(cigar, 1)
    const flags = feature.get('flags')
    const origStrand = feature.get('strand')
    const readName = feature.get('name')
    const readAssembly = `${readName}_assembly_${Date.now()}`
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames')
    const assemblyNames = [trackAssembly, readAssembly]
    const trackId = `track-${Date.now()}`
    const trackName = `${readName}_vs_${trackAssembly}`
    const SA: string = getTag(feature, 'SA') || ''
    const supplementaryAlignments = SA.split(';')
      .filter(aln => !!aln)
      .map((aln, index) => {
        const [saRef, saStart, saStrand, saCigar] = aln.split(',')
        const saLengthOnRef = getLengthOnRef(saCigar)
        const saLength = getLength(saCigar)
        const saLengthSansClipping = getLengthSansClipping(saCigar)
        const saStrandNormalized = saStrand === '-' ? -1 : 1
        const saClipPos = getClip(saCigar, saStrandNormalized * origStrand)
        const saRealStart = +saStart - 1
        return {
          refName: saRef,
          start: saRealStart,
          end: saRealStart + saLengthOnRef,
          seqLength: saLength,
          clipPos: saClipPos,
          CIGAR: saCigar,
          assemblyName: trackAssembly,
          strand: origStrand * saStrandNormalized,
          uniqueId: `${feature.id()}_SA${index}`,
          mate: {
            start: saClipPos,
            end: saClipPos + saLengthSansClipping,
            refName: readName,
          },
        }
      })

    const feat = feature.toJSON()
    feat.strand = 1
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

    const features = [feat, ...supplementaryAlignments] as ReducedFeature[]

    features.sort((a, b) => a.clipPos - b.clipPos)

    const refLength = features.reduce((a, f) => a + f.end - f.start, 0)

    session.addView('DotplotView', {
      type: 'DotplotView',
      hview: {
        offsetPx: 0,
        bpPerPx: refLength / 800,
        displayedRegions: gatherOverlaps(
          features.map((f, index) => {
            const { start, end, refName } = f
            return {
              start,
              end,
              refName,
              index,
              assemblyName: trackAssembly,
            }
          }),
        ),
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
  } catch (e) {
    console.error(e)
    session.notify(`${e}`, 'error')
  }
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
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          AdapterClass: PAFAdapter,
        }),
    )
    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.paf/i
          const adapterName = 'PAFAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              pafLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => {
        return (adapterName: string) => {
          if (adapterName === 'PAFAdapter') {
            return 'SyntenyTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRender(pluginManager))

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(
            (self: LinearPileupDisplayModel) => {
              const superContextMenuItems = self.contextMenuItems
              return {
                views: {
                  contextMenuItems() {
                    const feature = self.contextMenuFeature
                    if (!feature) {
                      return superContextMenuItems()
                    }
                    const newMenuItems = [
                      ...superContextMenuItems(),
                      {
                        label: 'Dotplot of read vs ref',
                        icon: AddIcon,
                        onClick: () => onClick(feature, self),
                      },
                    ]

                    return newMenuItems
                  },
                },
              }
            },
          )

          ;(pluggableElement as DisplayType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('DotplotView', {})
        },
      })
    }
  }
}
