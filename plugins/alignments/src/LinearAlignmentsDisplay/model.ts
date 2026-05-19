import { lazy } from 'react'

import {
  YSCALEBAR_LABEL_OFFSET,
  computeCoverageTicks,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isFeature,
  isSessionModelWithWidgets,
  measureText,
} from '@jbrowse/core/util'
import { getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { observable } from 'mobx'

import { buildLaidOutChainMap } from './computeChainLayout.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { buildLaidOutPileupMap } from '../RenderPileupDataRPC/sortLayout.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import {
  arcsToRegionResult,
  computeArcsFromPileupData,
} from '../features/arcs/compute.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getShowMenuItem,
  getSortByMenuItem,
} from '../shared/menus/index.ts'
import { getColorForModification } from '../util.ts'
import { CIGAR_TYPE_LABELS } from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'

import type {
  ColorPalette,
  RenderState as AlignmentsRenderState,
} from './components/AlignmentsRenderer.ts'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type { ArcDirection, LinkedReadsMode } from './constants.ts'
import type { CigarHitResult } from '../shared/hitTestTypes.ts'
import type { AlignmentsBackend } from './components/rendererTypes.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types'
import type { ArcsDataResult } from '../features/arcs/compute.ts'
import type { IndicatorHitResult } from '../features/indicator/types.ts'
import type { LegendItem } from '../shared/legendUtils.ts'
import type {
  ArcColorByType,
  ColorBy,
  FilterBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

type LGV = LinearGenomeViewModel

export type { ArcColorByType } from '../shared/types'

const arcColorByTypes = types.enumeration<ArcColorByType>('ArcColorByType', [
  'insertSizeAndOrientation',
  'insertSize',
  'orientation',
  'samplot',
])

export {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  textWidthForNumber,
} from './constants.ts'
export type { InsertionType } from './constants.ts'

export type { Region } from '@jbrowse/core/util'

function getSequenceAdapter(
  session: AbstractSessionModel,
  region: Region,
): Record<string, unknown> | undefined {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  if (!sequenceAdapterConfig) {
    return undefined
  }
  return getSnapshot(sequenceAdapterConfig)
}

interface FetchFeatureDetailsSelf {
  adapterConfig: Record<string, unknown>
  loadedRegions: ReadonlyMap<number, Region>
  getFeatureInfoById: (
    id: string,
  ) => { refName: string; start: number; end: number } | undefined
}

async function fetchFeatureDetails(
  self: FetchFeatureDetailsSelf,
  featureId: string,
) {
  const session = getSession(self)
  const info = self.getFeatureInfoById(featureId)
  if (!info) {
    return undefined
  }
  const loaded = [...self.loadedRegions.values()].find(
    r => r.refName === info.refName,
  )
  if (!loaded) {
    throw new Error(`no loaded region found for refName ${info.refName}`)
  }
  const region = {
    refName: info.refName,
    start: info.start,
    end: info.end,
    assemblyName: loaded.assemblyName,
  }
  const sequenceAdapter = getSequenceAdapter(session, region)
  const sessionId = getRpcSessionId(self)
  const { feature } = await session.rpcManager.call(
    sessionId,
    'GetPileupFeatureDetails',
    {
      sessionId,
      adapterConfig: self.adapterConfig,
      sequenceAdapter,
      regions: [region],
      featureId,
    },
  )
  if (!feature) {
    return undefined
  }
  return new SimpleFeature(feature)
}

const AlignmentsComponent = lazy(
  () => import('./components/PileupComponent.tsx'),
)

const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

const AdvancedSettingsDialog = lazy(
  () => import('./components/AdvancedSettingsDialog.tsx'),
)

export const ColorScheme = {
  normal: 0,
  strand: 1,
  mappingQuality: 2,
  insertSize: 3,
  firstOfPairStrand: 4,
  pairOrientation: 5,
  insertSizeAndOrientation: 6,
  modifications: 7,
  tag: 8,
  baseQuality: 9,
  insertSizeGradient: 10,
} as const

// Single home for each mode-enum's user-visible labels, so menu code never
// has to reverse-engineer a label from the stored value.
const ARC_DIRECTION_OPTIONS: { value: ArcDirection; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'up', label: 'Pointing up' },
  { value: 'down', label: 'Pointing down' },
]

const LINKED_READS_OPTIONS: { value: LinkedReadsMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'normal', label: 'Normal' },
  { value: 'bezier', label: 'Bezier' },
]

// Build a radio-style submenu from an (value, label) options list and an
// enum-typed setter. Reusable across all linked-reads / arc-direction
// pickers.
function radioModeSubMenu<T extends string>(
  options: { value: T; label: string }[],
  current: T,
  setMode: (m: T) => void,
) {
  return options.map(({ value, label }) => ({
    label,
    type: 'radio' as const,
    checked: current === value,
    onClick: () => {
      setMode(value)
    },
  }))
}

/**
 * State model factory for LinearAlignmentsDisplay
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ConfigOverrideMixin(),
      types.model({
        type: types.literal('LinearAlignmentsDisplay'),
        configuration: ConfigurationReference(configSchema),
        linkedReads: types.optional(
          types.enumeration<'off' | 'normal' | 'bezier'>('LinkedReadsMode', [
            'off',
            'normal',
            'bezier',
          ]),
          'off',
        ),
        showCoverage: true,
        coverageHeight: 45,
        showMismatches: true,
        showInterbaseIndicators: true,
        showYScalebar: true,
        drawSingletons: true,
        drawProperPairs: true,
        flipStrandLongReadChains: true,
        lineWidthSetting: types.maybe(types.number),
        drawInter: true,
        drawLongRange: true,
        arcColorByType: types.optional(
          arcColorByTypes,
          'insertSizeAndOrientation',
        ),
        pairedArcs: types.optional(
          types.enumeration<ArcDirection>('PairedArcsMode', [
            'off',
            'up',
            'down',
          ]),
          'off',
        ),
        sashimiArcs: types.optional(
          types.enumeration<ArcDirection>('SashimiArcsMode', [
            'off',
            'up',
            'down',
          ]),
          'up',
        ),
        sashimiArcsHeight: 40,
        arcsHeight: 40,
        showSoftClipping: false,
        jexlFilters: types.optional(types.array(types.string), []),
      }),
    )
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      (snap: Record<string, unknown> | undefined) =>
        migrateAlignmentsSnapshot(snap),
    )
    .volatile(() => ({
      featureIdUnderMouse: undefined as undefined | string,
      mouseoverExtraInformation: undefined as TooltipPayload | undefined,
      contextMenuFeature: undefined as Feature | undefined,
      contextMenuCoord: undefined as [number, number] | undefined,
      contextMenuCigarHit: undefined as CigarHitResult | undefined,
      contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined,
      contextMenuRefName: undefined as string | undefined,
      rpcDataMap: observable.map<number, PileupDataResult>(),
      currentRangeY: [0, 600] as [number, number],
      highlightedChainIds: [] as string[],
      selectedChainIds: [] as string[],

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      colorTagMap: {} as Record<string, string>,
      visibleModifications: observable.map<string, ModificationTypeWithColor>(
        {},
      ),
      simplexModifications: new Set<string>(),
      modificationsReady: false,
      overCigarItem: false,
      colorPalette: null as ColorPalette | null,
    }))
    // `isChainMode` is its own getter — it's used in many places as a
    // domain concept ("are we drawing the chain layout?") that reads
    // better than the equivalent `linkedReads === 'normal'`.
    .views(self => ({
      get isChainMode() {
        return self.linkedReads === 'normal'
      },
    }))
    .views(self => ({
      get featureWidgetType() {
        return {
          type: 'AlignmentsFeatureWidget',
          id: 'alignmentFeature',
        }
      },

      get selectedFeatureId() {
        const { selection } = getSession(self)
        if (isFeature(selection)) {
          return selection.id()
        }
        return undefined
      },

      get DisplayMessageComponent() {
        return AlignmentsComponent
      },

      get TooltipComponent() {
        return AlignmentsTooltip
      },

      get visibleModificationTypes() {
        return [...self.visibleModifications.keys()]
      },

      get colorBy(): ColorBy {
        return self.getConfWithOverride<ColorBy>('colorBy')
      },

      get filterBy(): FilterBy {
        return self.getConfWithOverride<FilterBy>('filterBy')
      },

      get featureHeightSetting(): number {
        return self.getConfWithOverride<number>('featureHeight')
      },

      get noSpacingSetting(): boolean | undefined {
        return self.getOverride<boolean>('noSpacing')
      },

      get featureSpacing(): number {
        const noSpacing = self.getOverride<boolean>('noSpacing')
        if (noSpacing !== undefined) {
          return noSpacing ? 0 : 2
        }
        return self.getConfWithOverride<number>('featureSpacing')
      },

      get maxHeight(): number {
        return self.getConfWithOverride<number>('maxHeight')
      },

      get chainIdMap() {
        const map = new Map<number, string[]>()
        if (self.linkedReads !== 'off') {
          for (const data of self.rpcDataMap.values()) {
            if (!data.readChainIndices) {
              continue
            }
            for (let i = 0; i < data.readIds.length; i++) {
              const chainIdx = data.readChainIndices[i]!
              let ids = map.get(chainIdx)
              if (!ids) {
                ids = []
                map.set(chainIdx, ids)
              }
              const id = data.readIds[i]
              if (id !== undefined) {
                ids.push(id)
              }
            }
          }
        }
        return map
      },

      get mismatchAlpha(): boolean {
        return !!self.getOverride<boolean>('mismatchAlpha')
      },

      get showLegend(): boolean | undefined {
        return self.getOverride<boolean>('showLegend')
      },

      get regionTooLarge() {
        return self.regionTooLargeState
      },

      get sortedBy() {
        return self.getOverride<SortedBy>('sortedBy')
      },

      get coverageScaleType() {
        return self.getConfWithOverride<string>('scaleType')
      },

      get coverageAutoscaleType() {
        return self.getConfWithOverride<string>('autoscale')
      },

      get coverageMinScore() {
        const v = self.getConfWithOverride<number>('minScore')
        return v !== Number.MIN_VALUE ? v : undefined
      },

      get coverageMaxScore() {
        const v = self.getConfWithOverride<number>('maxScore')
        return v !== Number.MAX_VALUE ? v : undefined
      },

      get coverageNumStdDev() {
        return self.getConfWithOverride<number>('numStdDev')
      },

      get coverageIsLog() {
        return this.coverageScaleType === 'log'
      },

      get coverageStats() {
        if (!self.showCoverage) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return undefined
        }
        return computeVisibleCoverageStats(
          view.dynamicBlocks.contentBlocks,
          b => self.rpcDataMap.get(b.displayedRegionIndex!),
        )
      },

      get coverageDomain(): [number, number] | undefined {
        return this.coverageStats
          ? getNiceDomain({
              domain: domainFromStats(
                this.coverageStats,
                this.coverageAutoscaleType,
                this.coverageNumStdDev,
              ),
              bounds: [this.coverageMinScore, this.coverageMaxScore],
              scaleType: this.coverageScaleType,
            })
          : undefined
      },

      get coverageTicks(): YScaleTicks | undefined {
        return this.coverageDomain
          ? computeCoverageTicks(
              this.coverageDomain[1],
              self.coverageHeight,
              this.coverageScaleType,
            )
          : undefined
      },

      get legendItems(): LegendItem[] {
        return getReadDisplayLegendItems(self.getOverride<ColorBy>('colorBy'))
      },

      get laidOutPileupMap() {
        if (self.linkedReads !== 'off') {
          return buildLaidOutChainMap(self.rpcDataMap, self.linkedReads)
        }
        return buildLaidOutPileupMap({
          dataMap: self.rpcDataMap,
          sortedBy: this.sortedBy,
          showSoftClipping: self.showSoftClipping,
        })
      },

      get maxY() {
        let max = 0
        for (const data of this.laidOutPileupMap.values()) {
          if (data.maxY > max) {
            max = data.maxY
          }
        }
        return max
      },

      get arcsRpcDataMap(): Map<number, ArcsDataResult> {
        if (self.pairedArcs === 'off' || self.rpcDataMap.size === 0) {
          return new Map()
        }
        const allRegionInfos = [...self.loadedRegions.entries()].map(
          ([displayedRegionIndex, r]) => ({
            refName: r.refName,
            start: r.start,
            end: r.end,
            displayedRegionIndex,
          }),
        )
        const { arcs, lines } = computeArcsFromPileupData(
          self.rpcDataMap,
          allRegionInfos,
          {
            colorByType: self.arcColorByType,
            drawInter: self.drawInter,
            drawLongRange: self.drawLongRange,
          },
        )
        const out = new Map<number, ArcsDataResult>()
        for (const ri of allRegionInfos) {
          if (self.rpcDataMap.has(ri.displayedRegionIndex)) {
            out.set(
              ri.displayedRegionIndex,
              arcsToRegionResult(arcs, lines, ri.refName, self.height),
            )
          }
        }
        return out
      },
    }))
    .views(self => ({
      get modificationThreshold() {
        return self.colorBy.modifications?.threshold ?? 10
      },

      /**
       * Calculate color scheme index from colorBy setting
       */
      get colorSchemeIndex(): number {
        switch (self.colorBy.type) {
          case 'normal':
            return ColorScheme.normal
          case 'strand':
            return ColorScheme.strand
          case 'mappingQuality':
            return ColorScheme.mappingQuality
          case 'insertSize':
            return ColorScheme.insertSize
          case 'insertSizeGradient':
            return ColorScheme.insertSizeGradient
          case 'firstOfPairStrand':
          case 'stranded':
            return ColorScheme.firstOfPairStrand
          case 'pairOrientation':
            return ColorScheme.pairOrientation
          case 'insertSizeAndOrientation':
            return ColorScheme.insertSizeAndOrientation
          case 'modifications':
          case 'methylation':
            return ColorScheme.modifications
          case 'tag':
            return ColorScheme.tag
          case 'baseQuality':
            return ColorScheme.baseQuality
          case 'perBaseQuality':
            // Per-base quality paints colored rects on top of a neutral
            // read body via the main-thread overlay (drawPerBaseQuality);
            // shader uses normal coloring for the background pass.
            return ColorScheme.normal
          default:
            return ColorScheme.normal
        }
      },

      get showModifications(): boolean {
        const t = self.colorBy.type
        return t === 'modifications' || t === 'methylation'
      },

      get showPerBaseQuality(): boolean {
        return self.colorBy.type === 'perBaseQuality'
      },

      get totalPileupHeight() {
        return self.maxY * (self.featureHeightSetting + self.featureSpacing)
      },

      get readIdIndexMap() {
        const map = new Map<
          string,
          { displayedRegionIndex: number; idx: number }
        >()
        for (const [displayedRegionIndex, rpcData] of self.rpcDataMap) {
          for (let i = 0; i < rpcData.readIds.length; i++) {
            const id = rpcData.readIds[i]
            if (id !== undefined) {
              map.set(id, { displayedRegionIndex, idx: i })
            }
          }
        }
        return map
      },
    }))
    .views(self => ({
      get lineWidth(): number {
        return self.lineWidthSetting ?? 1
      },

      findFeatureInRpcData(featureId: string) {
        const entry = self.readIdIndexMap.get(featureId)
        if (!entry) {
          return undefined
        }
        const { displayedRegionIndex, idx } = entry
        const rpcData = self.laidOutPileupMap.get(displayedRegionIndex)
        if (!rpcData) {
          return undefined
        }
        const start = rpcData.readPositions[idx * 2]
        const end = rpcData.readPositions[idx * 2 + 1]
        if (start !== undefined && end !== undefined) {
          return {
            displayedRegionIndex,
            idx,
            rpcData,
            start,
            end,
          }
        }
        return undefined
      },
    }))
    .views(self => ({
      /**
       * Compatibility getter for BreakpointSplitView overlay which reads
       * display.scrollTop to position SVG curves. The WebGL display manages
       * Y scrolling via currentRangeY[0] rather than the inherited scrollTop.
       */
      get scrollTop() {
        return self.currentRangeY[0]
      },

      get coverageDisplayHeight() {
        return (
          (self.showCoverage ? self.coverageHeight : 0) +
          (self.pairedArcs === 'down' ? self.arcsHeight : 0) +
          (self.sashimiArcs === 'down' && self.showCoverage
            ? self.sashimiArcsHeight
            : 0)
        )
      },
    }))
    .views(self => ({
      get pileupViewportHeight() {
        return Math.max(0, self.height - self.coverageDisplayHeight)
      },

      get scalebarOverlapLeft() {
        const view = getContainingView(self) as {
          trackLabelsSetting?: string
        }
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },

      get showOutlineSetting() {
        return self.getOverride<boolean>('showOutline') ?? self.isChainMode
      },

      get visibleLabels(): VisibleLabel[] {
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return []
        }
        return computeVisibleLabels({
          view,
          laidOutPileupMap: self.laidOutPileupMap,
          height: self.height,
          featureHeightSetting: self.featureHeightSetting,
          featureSpacing: self.featureSpacing,
          showMismatches: self.showMismatches,
          topOffset: self.coverageDisplayHeight,
          rangeY: self.currentRangeY,
        })
      },

      searchFeatureByID(
        featureId: string,
      ): [number, number, number, number] | undefined {
        const hit = self.findFeatureInRpcData(featureId)
        if (!hit) {
          return undefined
        }
        const { rpcData, idx, start, end } = hit
        const yRow = rpcData.readYs[idx]
        if (yRow === undefined) {
          return undefined
        }
        const rowHeight = self.featureHeightSetting + self.featureSpacing
        const top = yRow * rowHeight
        return [start, top, end, top + self.featureHeightSetting]
      },

      getFeatureInfoById(featureId: string) {
        const hit = self.findFeatureInRpcData(featureId)
        if (!hit) {
          return undefined
        }
        const { displayedRegionIndex, idx, rpcData, start, end } = hit
        const view = getContainingView(self) as LGV
        const flags = rpcData.readFlags[idx]
        return {
          id: featureId,
          name: rpcData.readNames[idx] ?? '',
          start,
          end,
          flags,
          mapq: rpcData.readMapqs[idx],
          strand: flags !== undefined && flags & 16 ? -1 : 1,
          refName:
            view.displayedRegions[displayedRegionIndex]?.refName ?? 'unknown',
        }
      },
    }))
    .views(self => ({
      get scrollableHeight() {
        return Math.max(0, self.totalPileupHeight - self.pileupViewportHeight)
      },

      // Only the tag NAME is sent to the worker (to extract per-read
      // sortTagValues). Wrapping as its own getter means rpcProps only
      // re-notifies when the tag itself changes — not when sort
      // position or sort type flips between non-tag flavors.
      get sortTag() {
        return self.sortedBy?.type === 'tag' ? self.sortedBy.tag : undefined
      },

      // Fields that invalidate the fetched pileup/chain data. Worker-
      // bound (filterBy, colorBy, …) plus the one main-thread decision
      // field that selects between pileup and chain RPC (linkedReads).
      // Arc-only fields (arcColorByType, drawInter, drawLongRange) are
      // NOT here — they are tracked by the arcsRpcDataMap computed
      // getter and do not require a refetch. Non-tag sort changes are
      // handled main-thread by laidOutPileupMap.
      rpcProps() {
        return {
          filterBy: self.filterBy,
          colorBy: self.colorBy,
          colorTagMap: self.colorTagMap,
          sortTag: this.sortTag,
          showSoftClipping: self.showSoftClipping,
          drawSingletons: self.drawSingletons,
          drawProperPairs: self.drawProperPairs,
          linkedReads: self.linkedReads,
        }
      },

      get renderState(): AlignmentsRenderState | undefined {
        const view = getContainingView(self) as LGV
        const palette = self.colorPalette
        if (!view.initialized || !palette) {
          return undefined
        }
        return {
          rangeY: self.currentRangeY,
          colorScheme: self.colorSchemeIndex,
          featureHeight: self.featureHeightSetting,
          featureSpacing: self.featureSpacing,
          showCoverage: self.showCoverage,
          coverageHeight: self.coverageHeight,
          coverageYOffset: YSCALEBAR_LABEL_OFFSET,
          coverageMaxDepth: self.coverageDomain?.[1],
          coverageIsLog: self.coverageIsLog,
          showMismatches: self.showMismatches,
          showSoftClipping: self.showSoftClipping,
          showInterbaseIndicators: self.showInterbaseIndicators,
          showModifications: self.showModifications,
          showPerBaseQuality: self.showPerBaseQuality,
          showOutline: self.showOutlineSetting,
          pairedArcs: self.pairedArcs,
          arcsHeight: self.arcsHeight,
          pileupTopOffset: self.coverageDisplayHeight,
          canvasWidth: view.width,
          canvasHeight: self.height,
          highlightedFeatureId: self.featureIdUnderMouse,
          selectedFeatureId: self.selectedFeatureId,
          highlightedChainIds: self.highlightedChainIds,
          selectedChainIds: self.selectedChainIds,
          colors: palette,
          linkedReads: self.linkedReads,
          flipStrandLongReadChains: self.flipStrandLongReadChains,
          arcLineWidth: self.lineWidth,
          arcColorByType: self.arcColorByType,
          arcsYDomainBp: this.arcsYDomainBp,
          bpRangeX: [0, 0],
        }
      },

      // Floored at 1000bp to avoid near-zero division when all pairs are concordant.
      get arcsYDomainBp(): number | undefined {
        if (self.arcColorByType !== 'samplot') {
          return undefined
        }
        let maxBp = 0
        for (const data of self.arcsRpcDataMap.values()) {
          if (data.maxFlatArcYBp > maxBp) {
            maxBp = data.maxFlatArcYBp
          }
        }
        return Math.max(1000, maxBp)
      },

      get insertSizeTicks(): YScaleTicks | undefined {
        const domain = this.arcsYDomainBp
        if (self.pairedArcs === 'off' || domain === undefined) {
          return undefined
        }
        // Match the renderer's arcsCtxHeight / arcTop: pointing-up overlays
        // the coverage area (band = coverageHeight, top = 0), pointing-down
        // gets its own band below coverage (band = arcsHeight, top = covH).
        // Fall back to 0 when coverage is hidden.
        const covH = self.showCoverage ? self.coverageHeight : 0
        const isDown = self.pairedArcs === 'down'
        return computeInsertSizeTicks({
          arcsYDomainBp: domain,
          arcsHeight: isDown ? self.arcsHeight : covH,
          pairedArcsDown: isDown,
          arcsTop: isDown ? covH : 0,
        })
      },
    }))
    .views(self => ({
      get featureUnderMouse() {
        const featId = self.featureIdUnderMouse
        if (!featId) {
          return undefined
        }
        const info = self.getFeatureInfoById(featId)
        if (!info) {
          return undefined
        }
        return new SimpleFeature({
          uniqueId: info.id,
          name: info.name || info.id,
          start: info.start,
          end: info.end,
          refName: info.refName,
          strand: info.strand,
          flags: info.flags,
          score: info.mapq,
          MAPQ: info.mapq,
        })
      },
    }))
    .actions(self => {
      const superSetError = self.setError
      const superSetRegionTooLarge = self.setRegionTooLarge
      function setCurrentRangeY(rangeY: [number, number]) {
        const cur = self.currentRangeY
        if (cur[0] !== rangeY[0] || cur[1] !== rangeY[1]) {
          self.currentRangeY = rangeY
        }
      }
      function addModification(modType: string) {
        if (!self.visibleModifications.has(modType)) {
          self.visibleModifications.set(modType, {
            type: modType,
            base: '',
            strand: '',
            color: getColorForModification(modType),
          })
        }
      }
      function clearHoverState() {
        self.featureIdUnderMouse = undefined
        self.mouseoverExtraInformation = undefined
        self.overCigarItem = false
        if (self.highlightedChainIds.length > 0) {
          self.highlightedChainIds = []
        }
      }
      return {
        setError(error?: unknown) {
          superSetError(error)
          if (error) {
            clearHoverState()
          }
        },

        setRegionTooLarge(val: boolean, reason?: string) {
          superSetRegionTooLarge(val, reason)
          if (val) {
            clearHoverState()
          }
        },

        setRpcData(
          displayedRegionIndex: number,
          data: PileupDataResult | null,
        ) {
          if (data) {
            self.rpcDataMap.set(displayedRegionIndex, data)
            for (const modType of data.detectedModifications) {
              addModification(modType)
            }
          } else {
            self.rpcDataMap.delete(displayedRegionIndex)
          }
        },

        clearDisplaySpecificData() {
          self.rpcDataMap.clear()
          self.currentRangeY = [0, 0]
          self.setRegionTooLarge(false)
        },

        setOverCigarItem(flag: boolean) {
          self.overCigarItem = flag
        },

        setColorPalette(palette: ColorPalette | null) {
          self.colorPalette = palette
        },

        setScrollTop(scrollTop: number) {
          setCurrentRangeY([scrollTop, scrollTop + self.pileupViewportHeight])
        },

        setCurrentRangeY,

        setHighlightedChainIds(ids: string[]) {
          self.highlightedChainIds = ids
        },

        clearHighlights() {
          if (self.highlightedChainIds.length > 0) {
            self.highlightedChainIds = []
          }
        },

        clearMouseoverState() {
          clearHoverState()
        },

        clearSelection() {
          const session = getSession(self)
          if (isFeature(session.selection)) {
            session.clearSelection()
          }
          if (self.selectedChainIds.length > 0) {
            self.selectedChainIds = []
          }
        },

        setSelectedChainIds(ids: string[]) {
          self.selectedChainIds = ids
        },

        setColorScheme(colorBy: ColorBy) {
          const current = self.getOverride<ColorBy>('colorBy')
          if (colorBy.type !== 'tag' || colorBy.tag !== current?.tag) {
            self.colorTagMap = {}
          }
          self.setOverride('colorBy', colorBy)
        },

        updateColorTagMap(uniqueTag: string[]) {
          const colorPalette = [
            '#90caf9',
            '#f48fb1',
            '#a5d6a7',
            '#fff59d',
            '#ffab91',
            '#ce93d8',
            '#80deea',
            '#c5e1a5',
            '#ffe082',
            '#bcaaa4',
          ]
          const map = { ...self.colorTagMap }
          let totalKeys = Object.keys(map).length
          let added = false
          for (const value of uniqueTag) {
            if (!map[value]) {
              map[value] = colorPalette[totalKeys % colorPalette.length]!
              totalKeys++
              added = true
            }
          }
          self.colorTagMap = map
          return added
        },

        setFilterBy(filterBy: FilterBy) {
          self.setOverride('filterBy', filterBy)
        },

        setShowOutline(show: boolean | undefined) {
          self.setOverride('showOutline', show)
        },

        toggleSoftClipping() {
          self.showSoftClipping = !self.showSoftClipping
        },

        toggleMismatchAlpha() {
          self.setOverride(
            'mismatchAlpha',
            !self.getOverride<boolean>('mismatchAlpha'),
          )
        },

        setSortedBy(type: string, tag?: string) {
          const view = getContainingView(self) as LGV
          const { centerLineInfo } = view
          if (!centerLineInfo) {
            return
          }
          const { refName, assemblyName, offset } = centerLineInfo
          const centerBp = Math.round(offset)
          if (centerBp < 0 || !refName) {
            return
          }
          self.setOverride('sortedBy', {
            type,
            pos: centerBp,
            refName,
            assemblyName,
            tag,
          })
        },

        setSortedByAtPosition(type: string, pos: number, refName: string) {
          const view = getContainingView(self) as LGV
          const assemblyName = view.assemblyNames[0]
          if (!assemblyName) {
            return
          }
          self.setOverride('sortedBy', {
            type,
            pos,
            refName,
            assemblyName,
          })
        },

        clearSelected() {
          self.clearOverride('sortedBy')
        },

        setMaxHeight(n?: number) {
          self.setOverride('maxHeight', n)
        },

        setCoverageScaleType(val: string) {
          self.setOverride('scaleType', val)
        },

        setCoverageAutoscaleType(val: string) {
          self.setOverride('autoscale', val)
        },

        setCoverageMinScore(val?: number) {
          self.setOverride('minScore', val)
        },

        setCoverageMaxScore(val?: number) {
          self.setOverride('maxScore', val)
        },

        setFeatureHeight(height?: number) {
          self.setOverride('featureHeight', height)
          self.currentRangeY = [0, 0]
        },

        setNoSpacing(flag?: boolean) {
          self.setOverride('noSpacing', flag)
          self.currentRangeY = [0, 0]
        },

        // duck-typed by LGV/BreakpointSplitView/LinearComparativeView "Compact all tracks"
        setCompactness(level: 'normal' | 'compact' | 'super-compact') {
          if (level === 'compact') {
            self.setOverride('featureHeight', 3)
            self.setOverride('noSpacing', true)
          } else if (level === 'super-compact') {
            self.setOverride('featureHeight', 1)
            self.setOverride('noSpacing', true)
          } else {
            self.setOverride('featureHeight', 7)
            self.setOverride('noSpacing', false)
          }
          self.currentRangeY = [0, 0]
        },

        setSashimiArcs(mode: ArcDirection) {
          self.sashimiArcs = mode
        },

        setPairedArcs(mode: ArcDirection) {
          self.pairedArcs = mode
        },

        setShowCoverage(show: boolean) {
          self.showCoverage = show
        },

        setCoverageHeight(height: number) {
          self.coverageHeight = height
        },

        setArcsHeight(height: number) {
          self.arcsHeight = height
        },

        setSashimiArcsHeight(height: number) {
          self.sashimiArcsHeight = height
        },

        setLineWidth(width: number) {
          self.lineWidthSetting = width
        },

        setDrawInter(draw: boolean) {
          self.drawInter = draw
        },

        setDrawLongRange(draw: boolean) {
          self.drawLongRange = draw
        },

        setColorByType(type: ArcColorByType) {
          self.arcColorByType = type
        },

        setShowMismatches(show: boolean) {
          self.showMismatches = show
        },

        setShowYScalebar(show: boolean) {
          self.showYScalebar = show
        },

        setShowLegend(show: boolean | undefined) {
          self.setOverride('showLegend', show)
        },

        setDrawSingletons(flag: boolean) {
          self.drawSingletons = flag
        },

        setDrawProperPairs(flag: boolean) {
          self.drawProperPairs = flag
        },

        setShowInterbaseIndicators(show: boolean) {
          self.showInterbaseIndicators = show
        },

        setFlipStrandLongReadChains(flag: boolean) {
          self.flipStrandLongReadChains = flag
        },

        setLinkedReads(mode: 'off' | 'normal' | 'bezier') {
          const wasOff = self.linkedReads === 'off'
          const willBeOff = mode === 'off'
          self.linkedReads = mode
          if (wasOff !== willBeOff) {
            clearHoverState()
            if (willBeOff) {
              self.setOverride('colorBy', { type: 'normal' })
            } else {
              self.clearOverride('showOutline')
              self.setOverride('colorBy', { type: 'insertSizeAndOrientation' })
            }
            self.invalidateLoadedRegions()
          }
        },

        updateVisibleModifications(uniqueModifications: string[]) {
          for (const modType of uniqueModifications) {
            addModification(modType)
          }
        },

        setSimplexModifications(simplex: string[]) {
          const currentSet = self.simplexModifications
          if (
            simplex.length === currentSet.size &&
            simplex.every(s => currentSet.has(s))
          ) {
            return
          }
          self.simplexModifications = new Set(simplex)
        },

        setModificationsReady(flag: boolean) {
          self.modificationsReady = flag
        },

        setFeatureIdUnderMouse(feature?: string) {
          self.featureIdUnderMouse = feature
        },

        setMouseoverExtraInformation(extra?: TooltipPayload) {
          self.mouseoverExtraInformation = extra
        },

        setHoverState(state: {
          overCigarItem: boolean
          featureIdUnderMouse: string | undefined
          mouseoverExtraInformation: TooltipPayload | undefined
        }) {
          self.overCigarItem = state.overCigarItem
          self.featureIdUnderMouse = state.featureIdUnderMouse
          self.mouseoverExtraInformation = state.mouseoverExtraInformation
        },

        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },

        setContextMenuCoord(coord?: [number, number]) {
          self.contextMenuCoord = coord
        },

        setContextMenuCigarHit(hit?: CigarHitResult) {
          self.contextMenuCigarHit = hit
        },

        setContextMenuIndicatorHit(hit?: IndicatorHitResult) {
          self.contextMenuIndicatorHit = hit
        },

        setContextMenuRefName(refName?: string) {
          self.contextMenuRefName = refName
        },

        selectFeature(feature: Feature) {
          const session = getSession(self)
          session.setSelection(feature)
          if (isSessionModelWithWidgets(session)) {
            const { type, id } = self.featureWidgetType
            session.showWidget(
              session.addWidget(type, id, {
                featureData: feature.toJSON(),
                view: getContainingView(self),
                track: getContainingTrack(self),
              }),
            )
          }
        },
      }
    })
    .actions(self => ({
      startGpuBackendLifecycle(backend: AlignmentsBackend) {
        self.installGpuDisplay<AlignmentsBackend>(backend, {
          upload: b => {
            b.sync({
              laidOutPileupMap: self.laidOutPileupMap,
              arcsRpcDataMap: self.arcsRpcDataMap,
            })
          },
          render: b => {
            const state = self.renderState
            if (!state || self.laidOutPileupMap.size === 0) {
              return false
            }
            return b.renderBlocks(self.renderBlocks, state)
          },
        })
      },
    }))
    .actions(self => {
      async function fetchAndDo(
        featureId: string,
        onFeat: (feat: SimpleFeature) => void,
      ) {
        const session = getSession(self)
        try {
          const feat = await fetchFeatureDetails(self, featureId)
          if (isAlive(self) && feat) {
            onFeat(feat)
          }
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      }
      return {
        async selectFeatureById(featureId: string) {
          await fetchAndDo(featureId, feat => {
            self.selectFeature(feat)
          })
        },
        async setContextMenuFeatureById(featureId: string) {
          await fetchAndDo(featureId, feat => {
            self.setContextMenuFeature(feat)
          })
        },
      }
    })
    .actions(self => {
      async function fetchAlignmentData(
        adapterConfig: Record<string, unknown>,
        sequenceAdapter: Record<string, unknown> | undefined,
        region: Region,
        stopToken: StopToken,
        method: 'RenderPileupData' | 'RenderChainData',
      ) {
        const sessionId = getRpcSessionId(self)
        return getSession(self).rpcManager.call(sessionId, method, {
          sessionId,
          adapterConfig,
          sequenceAdapter,
          regions: [region],
          ...self.rpcProps(),
          stopToken,
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        })
      }

      async function fetchFeaturesForRegion(
        adapterConfig: Record<string, unknown>,
        region: Region,
        displayedRegionIndex: number,
        stopToken: StopToken,
      ) {
        const session = getSession(self)
        const sequenceAdapter = getSequenceAdapter(session, region)

        const result = await fetchAlignmentData(
          adapterConfig,
          sequenceAdapter,
          region,
          stopToken,
          self.linkedReads !== 'off' ? 'RenderChainData' : 'RenderPileupData',
        )

        return { displayedRegionIndex, result }
      }

      return {
        getByteEstimateConfig() {
          const view = getContainingView(self) as LGV
          return {
            adapterConfig: self.adapterConfig,
            fetchSizeLimit: self.getConfWithOverride<number>('fetchSizeLimit'),
            userByteSizeLimit: self.userByteSizeLimit,
            visibleBp: view.visibleBp,
          }
        },

        async fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          await self.fetchRegions(needed, async (ctx: FetchContext) => {
            const promises = needed.map(({ region, displayedRegionIndex }) =>
              fetchFeaturesForRegion(
                self.adapterConfig,
                region,
                displayedRegionIndex,
                ctx.stopToken,
              ),
            )
            const results = await Promise.all(promises)
            if (ctx.isStale()) {
              return
            }

            const newDataMap = new Map<number, PileupDataResult>()
            let newTagColorsAdded = false
            self.setModificationsReady(true)
            for (const r of results) {
              if (r.result.newTagValues) {
                if (self.updateColorTagMap(r.result.newTagValues)) {
                  newTagColorsAdded = true
                }
              }
              self.setSimplexModifications(r.result.simplexModifications)
              newDataMap.set(r.displayedRegionIndex, r.result)
            }
            // Two loops are intentional: all updateColorTagMap calls must
            // complete before any setRpcData fires, so colorTagMap is fully
            // populated when the first render reads it.
            for (const [displayedRegionIndex, data] of newDataMap) {
              self.setRpcData(displayedRegionIndex, data)
            }
            if (newTagColorsAdded && self.colorBy.type === 'tag') {
              self.invalidateLoadedRegions()
            }
          })
        },
      }
    })
    .views(self => ({
      /**
       * Track menu items
       */
      trackMenuItems() {
        const colorByMenu = getColorByMenuItem(self, {
          showLinkedReads: self.linkedReads !== 'off',
          includeModifications: true,
          includeTagOption: true,
          arcsState: self,
        })

        const items: MenuItem[] = [
          getShowMenuItem(self),
          getFiltersMenuItem(self, { showPairFilters: self.isChainMode }),
          getSortByMenuItem(self),
          colorByMenu,
          getGroupByMenuItem(self),
          {
            label: 'Read connections...',
            type: 'subMenu' as const,
            subMenu: [
              {
                label: 'Linked reads',
                type: 'subMenu' as const,
                subMenu: radioModeSubMenu(
                  LINKED_READS_OPTIONS,
                  self.linkedReads,
                  v => {
                    self.setLinkedReads(v)
                  },
                ),
              },
              {
                label: 'Paired arcs',
                type: 'subMenu' as const,
                subMenu: [
                  ...radioModeSubMenu(
                    ARC_DIRECTION_OPTIONS,
                    self.pairedArcs,
                    v => {
                      self.setPairedArcs(v)
                    },
                  ),
                  { type: 'divider' as const },
                  {
                    label: 'Samplot mode (flat lines, Y = |insert size|)',
                    type: 'checkbox' as const,
                    checked: self.arcColorByType === 'samplot',
                    onClick: () => {
                      self.setColorByType(
                        self.arcColorByType === 'samplot'
                          ? 'insertSizeAndOrientation'
                          : 'samplot',
                      )
                    },
                  },
                ],
              },
              {
                label: 'Sashimi arcs',
                type: 'subMenu' as const,
                subMenu: radioModeSubMenu(
                  ARC_DIRECTION_OPTIONS,
                  self.sashimiArcs,
                  v => {
                    self.setSashimiArcs(v)
                  },
                ),
              },
            ],
          },
          getFeatureHeightMenuItem(self),
          {
            label: 'Coverage...',
            icon: EqualizerIcon,
            type: 'subMenu' as const,
            subMenu: [
              {
                label: 'Show coverage',
                type: 'checkbox' as const,
                checked: self.showCoverage,
                onClick: () => {
                  self.setShowCoverage(!self.showCoverage)
                },
              },
            ],
          },
          {
            label: 'Advanced...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                AdvancedSettingsDialog,
                { model: self, handleClose },
              ])
            },
          },
        ]

        return items
      },

      contextMenuItems() {
        const feat = self.contextMenuFeature
        const cigarHit = self.contextMenuCigarHit
        const indicatorHit = self.contextMenuIndicatorHit
        const items: MenuItem[] = []

        if (cigarHit) {
          const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
          const isInterbase =
            cigarHit.type === 'insertion' ||
            cigarHit.type === 'softclip' ||
            cigarHit.type === 'hardclip'
          const sortType = isInterbase ? cigarHit.type : 'basePair'
          const sortLabel = isInterbase
            ? `Sort by ${typeLabel.toLowerCase()} at position`
            : 'Sort by base at position'
          items.push({
            label: typeLabel,
            type: 'subMenu',
            subMenu: [
              {
                label: sortLabel,
                icon: SwapVertIcon,
                onClick: () => {
                  if (self.contextMenuRefName) {
                    self.setSortedByAtPosition(
                      sortType,
                      cigarHit.position,
                      self.contextMenuRefName,
                    )
                  }
                },
              },
              {
                label: `Open ${typeLabel.toLowerCase()} details`,
                icon: MenuOpenIcon,
                onClick: () => {
                  if (self.contextMenuRefName) {
                    openCigarWidget(self, cigarHit, self.contextMenuRefName)
                  }
                },
              },
            ],
          })
        }

        if (indicatorHit) {
          items.push({
            label: 'Interbase',
            type: 'subMenu',
            subMenu: [
              {
                label: `Sort by ${indicatorHit.indicatorType} at position`,
                icon: SwapVertIcon,
                onClick: () => {
                  if (self.contextMenuRefName) {
                    self.setSortedByAtPosition(
                      indicatorHit.indicatorType,
                      indicatorHit.position,
                      self.contextMenuRefName,
                    )
                  }
                },
              },
            ],
          })
        }

        if (feat) {
          items.push(
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                const session = getSession(self)
                if (isSessionModelWithWidgets(session)) {
                  const featureWidget = session.addWidget(
                    'AlignmentsFeatureWidget',
                    'alignmentFeature',
                    {
                      featureData: feat.toJSON(),
                      view: getContainingView(self),
                      track: getContainingTrack(self),
                    },
                  )
                  session.showWidget(featureWidget)
                  session.setSelection(feat)
                }
              },
            },
            {
              label: 'Copy info to clipboard',
              icon: ContentCopyIcon,
              onClick: async () => {
                const session = getSession(self)
                try {
                  const { uniqueId, ...rest } = feat.toJSON()
                  const { default: copy } = await import('copy-to-clipboard')
                  await copy(JSON.stringify(rest, null, 4))
                  session.notify('Copied to clipboard', 'success')
                } catch (e) {
                  console.error(e)
                  session.notifyError(`${e}`, e)
                }
              },
            },
          )
        }

        return items
      },
    }))
    .actions(self => ({
      reload() {
        self.clearAllRpcData()
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearAlignmentsDisplayModel, opts)
      },
    }))
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// interface (not type alias) breaks the circular reference TypeScript would
// encounter through React.lazy → PileupComponent → useAlignmentsBase → model
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearAlignmentsDisplayModel extends Instance<LinearAlignmentsDisplayStateModel> {}
