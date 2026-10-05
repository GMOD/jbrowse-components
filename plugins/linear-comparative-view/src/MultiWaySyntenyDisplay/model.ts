import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { legendIsReadable, pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { colorScaleIsEmpty } from '@jbrowse/core/ui/colorScale'
import {
  animationAllowed,
  doesIntersect2,
  getEnv,
  getPaletteHost,
  getSession,
  isObject,
  isFeature,
  morphClockMs,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import { measureText } from '@jbrowse/core/util/measureText'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  getTrackAssemblyNames,
  isSameAssemblyName,
  openAssemblyInLinearView,
} from '@jbrowse/core/util/tracks'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorEncodingOf,
  colorFieldOf,
  colorForField,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { getFeatureName } from '@jbrowse/plugin-canvas'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  layerColorScale,
  markColorOf,
  markLayerRequest,
  paintScalesOver,
  stepChannels,
} from '@jbrowse/plugin-marks'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { isThreshold } from '@jbrowse/render-core/marks'
import { sharedBackendKey } from '@jbrowse/render-core/sharedBackendKey'
import {
  PRESET_ATTRIBUTES,
  bandGroundColor,
  bandInk,
  bandPalette,
  colorableColumns,
  declaredAttributes,
  declaredRampOf,
  declaredLanesOf,
  featureAttributeRanges,
  lodMenuItems,
  lodTierAt,
  LodTierInfoMixin,
  orderAttributeLabels,
  paintedField,
  trackHasLodTiers,
  widenAttributeRanges,
} from '@jbrowse/synteny-core'

import { containingPanelStack } from '../LGVSyntenyDisplay/matePanelNavigation.ts'
import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import {
  syntenyRegionMenuItems,
  widestRegion,
} from '../LaunchSyntenyView/regionLaunchMenuItems.ts'
import { createSyntenyPicker } from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import { captureStackViewports } from '../SyntenyFollow/stackMove.ts'
import { isNamedRecord } from '../syntenyMate.ts'
import { NO_OPS, lanePairKey } from './alignmentOps.ts'
import { axisPlacement, axisSpan, displayedRegionSpans } from './anchorAxis.ts'
import LaneSelectionDialog from './components/LaneSelectionDialog.tsx'
import { composeLaneLinks } from './composeLaneLinks.ts'
import { geneColors } from './geneColor.ts'
import { annotationRank } from './laneAnnotation.ts'
import {
  decideLaneFrames,
  frameFromDecision,
  nudgeDecision,
} from './laneDecision.ts'
import {
  landLaneFetch,
  laneFetchAwaits,
  starAnchorOf,
  staleLaneSpecs,
} from './laneFetch.ts'
import { LABEL_FONT_SIZE, laneHeaderRows } from './laneHeader.ts'
import { GENE_LABEL_FONT_PX, placeLaneLabels } from './laneLabels.ts'
import {
  LANE_TEMPLATE_MAX_BP,
  barCellOf,
  laneLayerBpPerPx,
  coloredLaneLayer,
  laneLayerDomains,
  laneLayerOrigin,
  laneLayerSpecLane,
  laneLayersPx,
  layerBandTops,
} from './laneLayers.ts'
import {
  laneMapAt,
  laneMotionEase,
  laneTransitionsAfter,
  laneTransitionsRunning,
  lanesPastHalfway,
  shownFrame,
} from './laneMotion.ts'
import { lanePanelsForRegion } from './lanePanels.ts'
import {
  hiddenLanesOf,
  laneFilterOf,
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'
import {
  buildLanes,
  geneLabelRowPx,
  laneContentHeight,
  laneGeometry,
} from './laneStack.ts'
import {
  anchorlessGroupsOf,
  clipGroupToAnchor,
  groupFeatures,
  laneFetchRegion,
  laneFetchRegionMaxBp,
  laneOpeningsOf,
  mergeContiguousRegions,
  rowAssembliesOf,
  rowFrameX,
  tickIntervalFor,
} from './layoutMultiWay.ts'
import { laneColorKey, laneFieldKey, ribbonColorScales } from './legend.ts'
import { multiWayTrackMenuItems } from './menus.ts'
import {
  BANDS_KEY,
  boxesKey,
  buildBandCell,
  buildLaneCells,
  buildRibbonGeometry,
  buildTickGeometry,
  glyphHitAt,
  glyphsKey,
  outlineKey,
  ribbonFeatureId,
} from './multiwayGeometry.ts'
import { multiwayBlocks } from './multiwayMarks.ts'
import {
  drawnPx,
  laneMapOf,
  packedPx,
  ribbonPickState,
} from './multiwayRenderTypes.ts'

import type { SyntenyRenderState } from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { AlignmentOpsById, LaneLinks } from './alignmentOps.ts'
import type { AxisPlacement } from './anchorAxis.ts'
import type { LanePlacementRecord } from './composeLaneLinks.ts'
import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { GeneColorSettings, GeneColors } from './geneColor.ts'
import type { LaneGene } from './geneGlyph.ts'
import type {
  AnchorCoord,
  FrozenLanes,
  LaneDecision,
  LaneFlipPin,
} from './laneDecision.ts'
import type {
  HeldLane,
  HeldLaneGenes,
  HeldLaneGroups,
  HeldLaneLinks,
  LaneFetchSpec,
  LaneFetchState,
  LaneGenesFetchSpec,
  LaneGroupsFetchSpec,
  LaneLinksFetchSpec,
  LanePair,
  LaneWindow,
} from './laneFetch.ts'
import type { GeneLabel, NamedSpan, PlacedLaneLabel } from './laneLabels.ts'
import type {
  HeldLaneLayer,
  LaneLayerFetchSpec,
  LaneLayerSource,
} from './laneLayers.ts'
import type { LaneTransition } from './laneMotion.ts'
import type { LaneChoice, LaneFilter } from './laneSelection.ts'
import type { Lane, LaneStack } from './laneStack.ts'
import type {
  FetchRegion,
  PlacedGroup,
  RowFrame,
  Span,
} from './layoutMultiWay.ts'
import type { LaneGlyphColors, TickGeometry } from './multiwayGeometry.ts'
import type {
  BarLayer,
  LaneMap,
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  RibbonRef,
} from './multiwayRenderTypes.ts'
import type { AssemblyDescription } from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem, MouseState } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ColorSource } from '@jbrowse/plugin-marks'
import type { MarkColorScale } from '@jbrowse/render-core/marks'
import type {
  AttributeRange,
  DeclaredLane,
  DeclaredRamp,
  LodMode,
  SyntenyColorSnapshot,
} from '@jbrowse/synteny-core'
import type React from 'react'

export interface HoverTarget extends RibbonRef {
  label: string
  feature: Feature
}

const NO_FLIP_PINS: ReadonlyMap<string, LaneFlipPin> = new Map()
const NO_GENES: LaneGene[] = []

function regionKey(r: FetchRegion) {
  return `${r.refName}:${r.start}-${r.end}`
}

function drawnRect(
  map: LaneMap,
  [x1, x2]: Span,
  dragOffsetPx: number,
  top: number,
  height: number,
): HighlightRect {
  const a = drawnPx(map, x1)
  const b = drawnPx(map, x2)
  return {
    left: Math.min(a, b) + dragOffsetPx,
    top,
    width: Math.abs(b - a),
    height,
  }
}

function ribbonChannelNames(adapterConfig: Record<string, unknown>) {
  return [...PRESET_ATTRIBUTES, ...declaredAttributes(adapterConfig)]
}

// the widest a lane header's scale reads, so the key clears it at any zoom
const SCALE_COLUMN_PX =
  Math.ceil(measureText('8.88Mbp  88.8×', LABEL_FONT_SIZE)) + 4

/**
 * #stateModel MultiWaySyntenyDisplay
 * #displayFoundation GlobalFetchMixin
 * draws a multi-genome ortholog track as one lane per assembly inside a linear
 * genome view, with ribbons joining each gene's placements between adjacent
 * lanes
 */
export function stateModelFactory(
  configSchema: MultiWaySyntenyDisplayConfigModel,
) {
  return types
    .compose(
      'MultiWaySyntenyDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalFetchMixin(),
      LegendMixin(),
      LodTierInfoMixin(),
      types.model({
        /** #property */
        type: types.literal('MultiWaySyntenyDisplay'),
        /** #property */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * undefined means `configuredLanes`, or every lane where there are none
         */
        laneFilter: types.frozen<LaneFilter | undefined>(),
        /** #property */
        frozenLanes: types.frozen<FrozenLanes | undefined>(),
      }),
    )
    .volatile(() => ({
      /** #volatile */
      fetchedFeatures: undefined as
        | {
            anchor: string
            features: Feature[]
            ops: AlignmentOpsById
            lanes?: string[]
          }
        | undefined,
      /** #volatile */
      seenAttributeRanges: {} as Record<string, AttributeRange>,
      /** #volatile */
      laneGenes: {} as LaneFetchState<HeldLaneGenes>,
      /** #volatile */
      laneDescriptions: new Map<string, AssemblyDescription>(),
      /** #volatile */
      describedLanes: new Set<string>(),
      /** #volatile */
      lanesBeingDescribed: new Set<string>(),
      /** #volatile */
      releasedLanes: new Set<string>(),
      /**
       * #volatile
       * per adjacent mate-lane pair, at the lanes' own coordinates
       */
      laneLinks: {} as LaneFetchState<HeldLaneLinks>,
      /**
       * #volatile
       * per mate lane, a gene table's rows on the lane's own window
       */
      laneGroups: {} as LaneFetchState<HeldLaneGroups>,
      /** #volatile */
      laneLayerData: {} as LaneFetchState<HeldLaneLayer>,
      /** #volatile */
      hoverTarget: undefined as HoverTarget | undefined,
      /** #volatile */
      clickedTarget: undefined as RibbonRef | undefined,
      /** #volatile */
      laneDecisions: new Map<string, LaneDecision | undefined>(),
      /** #volatile */
      pinnedLaneContigs: new Map<string, string>(),
      /** #volatile */
      laneFlipPinsByAnchor: new Map<string, ReadonlyMap<string, LaneFlipPin>>(),
      /**
       * #volatile
       * the view's `offsetPx` the stack was last laid out against
       */
      renderOriginPx: 0,
      /** #volatile */
      laneTransitions: new Map<string, LaneTransition>(),
      /** #volatile */
      laneMotionClockMs: 0,
      /** #volatile */
      laneMotionHalfway: new Set<string>() as ReadonlySet<string>,
      /** #volatile */
      laneDragPx: new Map<string, number>() as ReadonlyMap<string, number>,
    }))
    .actions(self => {
      function ribbonColorSetting(): SyntenyColorSnapshot {
        return colorSnapshotOf(self.configuration.ribbonColor)
      }
      function observeRibbonFeatures(features: readonly Feature[]) {
        self.seenAttributeRanges = widenAttributeRanges(
          self.seenAttributeRanges,
          featureAttributeRanges(
            features,
            ribbonChannelNames(self.adapterConfig),
          ),
        )
      }
      return {
        /** #action */
        setFeatures(
          features: Feature[],
          anchor: string = containingLgv(self).assemblyNames[0]!,
          lanes?: string[],
          ops: AlignmentOpsById = NO_OPS,
        ) {
          self.fetchedFeatures = { anchor, features, ops, lanes }
          observeRibbonFeatures(features)
        },
        /** #action */
        beginDescribingLanes(names: string[]) {
          self.describedLanes = new Set([...self.describedLanes, ...names])
          self.lanesBeingDescribed = new Set([
            ...self.lanesBeingDescribed,
            ...names,
          ])
        },
        /** #action */
        endDescribingLanes(
          names: string[],
          descriptions: Record<string, AssemblyDescription>,
        ) {
          const ended = new Set(names)
          self.lanesBeingDescribed = new Set(
            [...self.lanesBeingDescribed].filter(name => !ended.has(name)),
          )
          if (Object.keys(descriptions).length > 0) {
            self.laneDescriptions = new Map([
              ...self.laneDescriptions,
              ...Object.entries(descriptions),
            ])
          }
        },
        /** #action */
        forgetUndescribedLanes() {
          self.describedLanes = new Set(
            [...self.describedLanes].filter(
              name =>
                self.laneDescriptions.has(name) ||
                self.lanesBeingDescribed.has(name),
            ),
          )
        },
        /**
         * #action
         * `specs` holds every lane the run was asked for, and `anchor` the
         * anchor the specs were built under
         */
        setLaneGenes(
          fetched: ReadonlyMap<string, HeldLaneGenes>,
          specs: LaneFetchSpec[],
          anchor: string,
        ) {
          self.laneGenes = landLaneFetch(self.laneGenes, fetched, specs, anchor)
        },
        /** #action */
        setLaneLayerData(
          fetched: ReadonlyMap<string, HeldLaneLayer>,
          specs: LaneFetchSpec[],
          anchor: string,
        ) {
          self.laneLayerData = landLaneFetch(
            self.laneLayerData,
            fetched,
            specs,
            anchor,
          )
        },
        /** #action */
        setLaneLinks(
          fetched: ReadonlyMap<string, HeldLaneLinks>,
          specs: LaneFetchSpec[],
          anchor: string,
        ) {
          self.laneLinks = landLaneFetch(self.laneLinks, fetched, specs, anchor)
          for (const { links } of fetched.values()) {
            observeRibbonFeatures(links)
          }
        },
        /** #action */
        setLaneGroups(
          fetched: ReadonlyMap<string, HeldLaneGroups>,
          specs: LaneFetchSpec[],
          anchor: string,
        ) {
          self.laneGroups = landLaneFetch(
            self.laneGroups,
            fetched,
            specs,
            anchor,
          )
          for (const { features } of fetched.values()) {
            observeRibbonFeatures(features)
          }
        },
        /**
         * #action
         * takes the whole pinned order, empty meaning densest-first; merge a
         * partial one with `mergeDomain` first
         */
        setDomain(domain: string[]) {
          setConf(self, 'domain', domain)
        },
        /**
         * #action
         * undefined restores `configuredLanes`, or every lane
         */
        setSelectedLanes(names: string[] | undefined) {
          self.laneFilter = laneFilterOf(names, [])
        },
        /** #action */
        setBridgeSkippedLanes(flag: boolean) {
          setConf(self, 'bridgeSkippedLanes', flag)
        },
        /** #action */
        setRibbonColorField(field: string) {
          setConf(
            self,
            'ribbonColor',
            colorForField(ribbonColorSetting(), field),
          )
          self.seenAttributeRanges = {}
          observeRibbonFeatures(self.fetchedFeatures?.features ?? [])
          for (const { links } of self.laneLinks.held?.values() ?? []) {
            observeRibbonFeatures(links)
          }
          for (const { features } of self.laneGroups.held?.values() ?? []) {
            observeRibbonFeatures(features)
          }
        },
        /** #action */
        setRibbonColorDomain(domain: string[]) {
          setConf(self, ['ribbonColor', 'domain'], domain)
        },
        /** #action */
        setHideUnlabelled(flag: boolean) {
          setConf(self, 'hideUnlabelled', flag)
        },
        /** #action */
        setDrawCurves(flag: boolean) {
          setConf(self, 'drawCurves', flag)
        },
        /** #action */
        setShowLaneTicks(flag: boolean) {
          setConf(self, 'showLaneTicks', flag)
        },
        /** #action */
        setSplitStrands(flag: boolean) {
          setConf(self, 'splitStrands', flag)
        },
        /** #action */
        setShowGeneLabels(flag: boolean) {
          setConf(self, 'showGeneLabels', flag)
        },
        /** #action */
        setGeneTextField(field: string) {
          setConf(self, 'text', field)
        },
        /** #action */
        setLodMode(mode: LodMode) {
          setConf(self, 'lodMode', mode)
        },
      }
    })
    .views(self => ({
      /** #getter */
      get declaredLanes(): DeclaredLane[] | undefined {
        const header = self.adapterHeader
        return header === undefined ? undefined : declaredLanesOf(header)
      },
      /** #getter */
      get starAnchor(): string | undefined {
        return starAnchorOf(self.adapterHeader)
      },
      /** #getter */
      get lgv() {
        return containingLgv(self)
      },
      /**
       * #getter
       * undefined while the view's anchor differs from the fetch's
       */
      get features() {
        const held = self.fetchedFeatures
        return held &&
          isSameAssemblyName(
            held.anchor,
            this.lgv.assemblyNames[0],
            getSession(self).assemblyManager,
          )
          ? held.features
          : undefined
      },
      /** #getter */
      get featureOps(): AlignmentOpsById {
        return (this.features && self.fetchedFeatures?.ops) ?? NO_OPS
      },
      /** #getter */
      get hoveredGroupKey() {
        return self.hoverTarget?.groupKey
      },
    }))
    .views(self => ({
      /** #getter */
      get lodMode(): LodMode {
        return getConf(self, 'lodMode')
      },
      /** #getter */
      get hasLodCapableAdapter() {
        return trackHasLodTiers(self.parentTrack)
      },
      /**
       * #getter
       * read off the settled zoom, so a passing gesture refetches nothing
       */
      get lodTier() {
        return lodTierAt(self, self.host.coarseBpPerPx, this.lodMode)
      },
      /** #getter */
      get liveLodTier() {
        return lodTierAt(self, self.lgv.bpPerPx, this.lodMode)
      },
    }))
    .views(self => ({
      /** #getter */
      get canvasWidth() {
        return self.lgv.width
      },
      /** #getter */
      get viewSignature() {
        const blocks = self.staticBlockSignature
        return blocks === undefined ? undefined : `${blocks}|${self.lodTier}`
      },
      /** #getter */
      get groups() {
        return self.features ? groupFeatures(self.features) : []
      },
      /**
       * #getter
       * each lane's holes, read off every fetched group rather than the
       * viewport's, so one appears once both its pieces arrive and not as
       * the second scrolls in
       */
      get laneOpenings() {
        return laneOpeningsOf(this.groups)
      },
      /** #getter */
      get featuresAreNameless() {
        return (
          self.features !== undefined &&
          self.features.length > 0 &&
          !self.features.some(isNamedRecord)
        )
      },
      /** #getter */
      get ribbonColor(): string {
        return getConf(self, ['ribbonColor', 'value'])
      },
      /** #getter */
      get domain(): string[] {
        return getConf(self, 'domain')
      },
      /** #getter */
      get ribbonColorField(): string {
        return paintedField({
          scale: getConf(self, ['ribbonColor', 'scale']),
          field: getConf(self, ['ribbonColor', 'field']),
        })
      },
      /** #getter */
      get ribbonColorAttributes(): string[] {
        return colorableColumns(declaredAttributes(self.adapterConfig))
      },
      /** #getter */
      get ribbonColorDomain(): string[] {
        return getConf(self, ['ribbonColor', 'domain'])
      },
      /** #getter */
      get ribbonRamp(): DeclaredRamp {
        return declaredRampOf(self.configuration.ribbonColor)
      },
      /** #getter */
      get ribbonAttributeRanges(): Record<string, AttributeRange> {
        return orderAttributeLabels(
          self.seenAttributeRanges,
          this.ribbonColorDomain,
          getConf(self, ['ribbonColor', 'range']),
        )
      },
      /** #getter */
      get hideUnlabelled(): boolean {
        return getConf(self, 'hideUnlabelled')
      },
      /** #getter */
      get drawCurves(): boolean {
        return getConf(self, 'drawCurves')
      },
      /** #getter */
      get bridgeSkippedLanes(): boolean {
        return getConf(self, 'bridgeSkippedLanes')
      },
      /** #getter */
      get showLaneTicks(): boolean {
        return getConf(self, 'showLaneTicks')
      },
      /** #getter */
      get splitStrands(): boolean {
        return getConf(self, 'splitStrands')
      },
      /** #getter */
      get showGeneLabels(): boolean {
        return getConf(self, 'showGeneLabels')
      },
      /**
       * #getter
       * a field, a jexl expression, or empty for the name-else-ID default
       */
      get geneTextField(): string {
        return getConf(self, 'text')
      },
      /** #getter */
      get geneLabelPx() {
        return geneLabelRowPx(getConf(self, 'showGeneLabels'))
      },
      /** #getter */
      get laneLayerHeights(): number[] {
        return self.configuration.laneLayers.map(layer => layer.height)
      },
      /** #getter */
      get layerPx() {
        return laneLayersPx(this.laneLayerHeights)
      },
      /** #getter */
      get geneColorSettings(): GeneColorSettings {
        return {
          color: colorSnapshotOf(self.configuration.color),
          utrColor: self.configuration.utrColor,
        }
      },
    }))
    .views(self => ({
      /** #getter */
      get geneColorEncoding() {
        return colorEncodingOf(self.geneColorSettings.color)
      },
      /**
       * #getter
       * The slots a categorical gene colour deals its values into.
       */
      get geneColorSlots() {
        return heldColorSlots(self, this.geneColorEncoding)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `''` while `color.value` paints
       */
      get geneColorField(): string {
        return colorFieldOf(self.geneColorEncoding)?.field ?? ''
      },
    }))
    .views(self => {
      const { jexl } = getEnv(self).pluginManager
      let boxes:
        | { features?: Feature[]; settings: string; colors: GeneColors }
        | undefined
      let lanes = new Map<
        string,
        { held: HeldLaneGenes; settings: string; colors: GeneColors }
      >()
      return {
        /** #getter */
        get boxColors(): GeneColors {
          const { features, geneColorSettings } = self
          const settings = JSON.stringify(geneColorSettings)
          if (
            boxes === undefined ||
            boxes.features !== features ||
            boxes.settings !== settings
          ) {
            boxes = {
              features,
              settings,
              colors: geneColors(
                self.configuration,
                self.geneColorEncoding,
                geneColorSettings.utrColor,
                jexl,
                self.geneColorSlots,
              ),
            }
          }
          return boxes.colors
        },
        /** #getter */
        get laneGeneColors(): ReadonlyMap<string, GeneColors> {
          const { geneColorSettings } = self
          const settings = JSON.stringify(geneColorSettings)
          const next = new Map<
            string,
            { held: HeldLaneGenes; settings: string; colors: GeneColors }
          >()
          for (const [lane, held] of self.laneGenes.held ?? []) {
            const prev = lanes.get(lane)
            next.set(
              lane,
              prev?.held === held && prev.settings === settings
                ? prev
                : {
                    held,
                    settings,
                    colors: geneColors(
                      self.configuration,
                      self.geneColorEncoding,
                      geneColorSettings.utrColor,
                      jexl,
                      self.geneColorSlots,
                    ),
                  },
            )
          }
          lanes = next
          return new Map([...next].map(([lane, { colors }]) => [lane, colors]))
        },
      }
    })
    .views(self => ({
      /** #getter */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
      /** #getter */
      get anchorAssemblyName() {
        return self.lgv.assemblyNames[0]!
      },
    }))
    .views(self => ({
      /** #getter */
      get adapterCapabilities(): readonly string[] {
        const type = self.adapterConfig.type
        return typeof type === 'string'
          ? getEnv(self).pluginManager.getAdapterType(type).adapterCapabilities
          : []
      },
    }))
    .views(self => ({
      /** #getter */
      get adapterDeclaresLanes(): boolean {
        return self.adapterCapabilities.includes('headerLanes')
      },
      /** #getter */
      get adapterPairsOnAnchor(): boolean {
        return self.adapterCapabilities.includes('lanePairsOnAnchor')
      },
      /**
       * #method
       * the canonical name, so two spellings of one assembly share a key
       */
      laneKey(assemblyName: string) {
        return (
          getSession(self).assemblyManager.getCanonicalAssemblyName(
            assemblyName,
          ) ?? assemblyName
        )
      },
    }))
    .views(self => ({
      /** #getter */
      get adjacentLanesAlignDirectly(): boolean {
        return self.adapterPairsOnAnchor || self.starAnchor === undefined
      },
      /** #getter */
      get pinnedLaneFlips(): ReadonlyMap<string, LaneFlipPin> {
        return (
          self.laneFlipPinsByAnchor.get(
            self.laneKey(self.anchorAssemblyName),
          ) ?? NO_FLIP_PINS
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the track's assemblies beside the anchor for a source that declares its
       * own lanes, empty for every other source
       */
      get configuredLanes(): string[] {
        const anchor = self.laneKey(self.anchorAssemblyName)
        return self.adapterDeclaresLanes
          ? getTrackAssemblyNames(self.parentTrack).filter(
              name => self.laneKey(name) !== anchor,
            )
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * undefined means every lane, and a hidden lane stays in force
       */
      get laneSelection(): readonly string[] | undefined {
        return lanesInForce(self.laneFilter, self.configuredLanes)
      },
      /** #getter */
      get hiddenLanes(): readonly string[] {
        return hiddenLanesOf(self.laneFilter)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * undefined unless the adapter declares its lanes, and lists each held
       * genome under every name the session knows it by
       */
      get fetchLaneSelection(): string[] | undefined {
        const selection = self.adapterDeclaresLanes
          ? self.laneSelection
          : undefined
        const { assemblyManager } = getSession(self)
        return (
          selection && [
            ...new Set(
              selection.flatMap(name => [
                name,
                ...((assemblyManager.has(name) &&
                  assemblyManager.get(name)?.allAliases) ||
                  []),
              ]),
            ),
          ]
        )
      },
    }))
    .views(self => ({
      /**
       * reads only user-controlled state, never a fetch's output, or it loops
       */
      rpcProps() {
        return { haplotypes: self.fetchLaneSelection }
      },
      /** #getter */
      get anchorAssembly() {
        return getSession(self).assemblyManager.get(self.anchorAssemblyName)
      },
      /** #getter */
      get anchorLocString() {
        const view = self.lgv
        return view.coarseVisibleLocStrings || view.visibleLocStrings
      },
      /** #method */
      holdsAssembly(assemblyName: string) {
        return getSession(self).assemblyManager.has(assemblyName)
      },
      /** #method */
      holdsTemporarily(assemblyName: string) {
        const { assemblyManager, temporaryAssemblies = [] } = getSession(self)
        const name =
          assemblyManager.getCanonicalAssemblyName(assemblyName) ?? assemblyName
        return temporaryAssemblies.some(
          conf => (conf as { name?: unknown }).name === name,
        )
      },
      /**
       * #getter
       * keyed by `laneKey`
       */
      get declaredLaneLabels() {
        const out = new Map<string, string>()
        for (const { name, label } of self.declaredLanes ?? []) {
          if (label !== undefined) {
            out.set(self.laneKey(name), label)
          }
        }
        return out
      },
      /** #method */
      laneLabel(assemblyName: string) {
        return this.holdsAssembly(assemblyName)
          ? getSession(self).assemblyManager.getDisplayName(assemblyName)
          : (this.declaredLaneLabels.get(self.laneKey(assemblyName)) ??
              assemblyName)
      },
      /**
       * #getter
       * the anchor is never a lane
       */
      get laneUniverse(): LaneChoice[] {
        const anchor = self.laneKey(self.anchorAssemblyName)
        const placed = new Set<string>()
        for (const group of self.groups) {
          for (const name of group.mates.keys()) {
            placed.add(self.laneKey(name))
          }
        }
        const selection = self.laneSelection
        const chosen = selection && new Set(selection.map(self.laneKey))
        const hidden = new Set(self.hiddenLanes.map(self.laneKey))
        const landed = self.features && self.fetchedFeatures?.lanes
        const asked = landed && new Set(landed.map(self.laneKey))
        const known = (key: string) =>
          self.features !== undefined && (asked === undefined || asked.has(key))
        const out = new Map<string, LaneChoice>()
        const offer = (lane: DeclaredLane) => {
          const key = self.laneKey(lane.name)
          if (key !== anchor && !out.has(key)) {
            const shown = this.laneLabel(lane.name)
            const label = shown === lane.name ? lane.label : shown
            out.set(key, {
              ...lane,
              ...(label === lane.name ? {} : { label }),
              placed: placed.has(key) || (known(key) ? false : undefined),
              drawn:
                (chosen === undefined || chosen.has(key)) && !hidden.has(key),
            })
          }
        }
        for (const lane of self.declaredLanes ?? []) {
          offer(lane)
        }
        for (const name of getTrackAssemblyNames(self.parentTrack)) {
          offer({ name })
        }
        for (const group of self.groups) {
          for (const name of group.mates.keys()) {
            offer({ name })
          }
        }
        return [...out.values()]
      },
      /**
       * #getter
       * a paralogy mate on the anchor assembly draws on its axis, not as a row
       */
      get rowAssemblies() {
        const drawn = new Set(
          this.laneUniverse
            .filter(lane => lane.drawn)
            .map(lane => self.laneKey(lane.name)),
        )
        return rowAssembliesOf(self.groups, self.domain, self.laneKey).filter(
          assemblyName => drawn.has(self.laneKey(assemblyName)),
        )
      },
      /** #getter */
      get lanesToDescribe(): string[] {
        return this.rowAssemblies.filter(
          name =>
            !self.describedLanes.has(name) &&
            (!this.holdsAssembly(name) || this.holdsTemporarily(name)),
        )
      },
      /** #getter */
      get laneAssemblyConfs() {
        const out = new Map<string, Record<string, unknown>>()
        for (const [lane, { assembly }] of self.laneDescriptions) {
          if (assembly && !self.releasedLanes.has(lane)) {
            out.set(lane, assembly)
          }
        }
        return out
      },
      /** #getter */
      get canReanchor() {
        const anchor = self.laneKey(self.anchorAssemblyName)
        const declared = self.declaredLanes ?? []
        return (
          self.starAnchor === undefined &&
          (declared.length === 0 ||
            declared.some(lane => self.laneKey(lane.name) === anchor))
        )
      },
      /** #getter */
      get visibleBpSpan() {
        const view = self.lgv
        return view.initialized ? view.width * view.bpPerPx : 0
      },
    }))
    .actions(self => ({
      /** #action */
      chooseLanes(names: string[]) {
        self.setSelectedLanes(
          pickedLanes(
            {
              picked: names,
              offered: self.laneUniverse.map(lane => lane.name),
              inForce: self.laneSelection,
              configured: self.configuredLanes,
            },
            self.laneKey,
          ),
        )
      },
      /** #action */
      hideLane(assemblyName: string) {
        self.laneFilter = withLaneHidden(
          self.laneFilter,
          assemblyName,
          self.laneKey,
        )
      },
      /** #action */
      showLane(assemblyName: string) {
        self.laneFilter = withLaneShown(
          self.laneFilter,
          self.configuredLanes,
          assemblyName,
          self.laneKey,
        )
      },
      /** #action */
      showHiddenLanes() {
        self.laneFilter = laneFilterOf(self.laneFilter?.only, [])
      },
    }))
    .actions(self => ({
      /** #action */
      openLaneSelection() {
        getSession(self).queueDialog(handleClose => [
          LaneSelectionDialog,
          { model: self, handleClose },
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each with the hull, in anchor bp, of the settled blocks it meets
       */
      get visibleGroupWindows() {
        const view = self.lgv
        const assembly = self.anchorAssembly
        return view.initialized && assembly
          ? self.groups.flatMap(group => {
              const refName = assembly.getCanonicalRefName2(
                group.anchor.refName,
              )
              const blocks = view.settledDynamicBlocks.filter(
                block =>
                  block.refName === refName &&
                  doesIntersect2(
                    block.start,
                    block.end,
                    group.anchor.start,
                    group.anchor.end,
                  ),
              )
              return blocks.length
                ? [
                    {
                      group,
                      start: Math.min(...blocks.map(block => block.start)),
                      end: Math.max(...blocks.map(block => block.end)),
                    },
                  ]
                : []
            })
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * uncut at the viewport edge, cut only at a displayed region's end
       */
      get visibleGroups() {
        const view = self.lgv
        const assembly = self.anchorAssembly
        return self.visibleGroupWindows.map(({ group }) => {
          const { refName, start, end } = group.anchor
          const shown = clipToDisplayedRegions(view, {
            refName: assembly?.getCanonicalRefName2(refName) ?? refName,
            start,
            end,
          })
          return shown
            ? clipGroupToAnchor(group, shown.start, shown.end)
            : group
        })
      },
      /**
       * #getter
       * the visible groups cut to the viewport, which each lane's frame fits
       */
      get fitGroups() {
        return self.visibleGroupWindows.map(({ group, start, end }) =>
          clipGroupToAnchor(group, start, end),
        )
      },
      /** #getter */
      get tickIntervalBp() {
        return tickIntervalFor(self.visibleBpSpan)
      },
      /** #getter */
      get scrollContentHeight() {
        return laneContentHeight(
          self.height,
          1 + self.rowAssemblies.length,
          self.geneLabelPx,
          self.layerPx,
        )
      },
      /**
       * #getter
       * keyed by each lane's own spelling, not by `laneKey`
       */
      get laneGeneTracks() {
        const session = getSession(self)
        const named = new Set<string>(getConf(self, 'laneGeneTracks'))
        const lanesByKey = new Map<string, string[]>()
        for (const lane of [self.anchorAssemblyName, ...self.rowAssemblies]) {
          const key = self.laneKey(lane)
          lanesByKey.set(key, [...(lanesByKey.get(key) ?? []), lane])
        }
        const best = new Map<
          string,
          { rank: number; track: AnyConfigurationModel }
        >()
        for (const track of allSessionTracks(session)) {
          const names = getConfAssemblyNamesOrNone(track)
          const type: unknown = readConfObject(track, ['adapter', 'type'])
          const rank = named.has(readConfObject(track, 'trackId') as string)
            ? -1
            : annotationRank(typeof type === 'string' ? type : undefined)
          if (names.length === 1 && rank !== undefined) {
            const key = self.laneKey(names[0]!)
            const held = best.get(key)
            if (
              lanesByKey.has(key) &&
              (held === undefined || rank < held.rank)
            ) {
              best.set(key, { rank, track })
            }
          }
        }
        const out = new Map<string, AnyConfigurationModel>()
        for (const [key, { track }] of best) {
          for (const lane of lanesByKey.get(key)!) {
            out.set(lane, track)
          }
        }
        return out
      },
    }))
    .views(self => ({
      /** #getter */
      get laneGeneAdapters() {
        const out = new Map<string, Record<string, unknown>>()
        for (const [lane, track] of self.laneGeneTracks) {
          out.set(lane, readConfObject(track, 'adapter'))
        }
        for (const [lane, { geneAdapter }] of self.laneDescriptions) {
          if (geneAdapter && !out.has(lane)) {
            out.set(lane, geneAdapter)
          }
        }
        return out
      },
    }))
    .views(self => ({
      /** #getter */
      get scrollViewportHeight() {
        return self.height
      },
      /**
       * #getter
       * in view px before the scroll offset; a flipped view gives x1 > x2
       */
      get anchorPlacements(): Map<string, AxisPlacement> {
        const view = self.lgv
        const assembly = self.anchorAssembly
        const out = new Map<string, AxisPlacement>()
        if (!view.initialized || !assembly) {
          return out
        }
        for (const group of self.visibleGroups) {
          const placement = axisPlacement(
            view,
            assembly.getCanonicalRefName2(group.anchor.refName),
            group.anchor.start,
            group.anchor.end,
          )
          if (placement) {
            out.set(group.key, placement)
          }
        }
        return out
      },
      /**
       * #getter
       * the px the view has scrolled since the stack was laid out
       */
      get dragOffsetPx() {
        const view = self.lgv
        return view.initialized ? self.renderOriginPx - view.offsetPx : 0
      },
      /** #getter */
      get anchorReversed() {
        return self.lgv.displayedRegionsOrientation === 'reversed'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the anchor placements in stack px, relative to `renderOriginPx`
       */
      get anchorSpans(): Map<string, Span> {
        const origin = self.renderOriginPx
        const out = new Map<string, Span>()
        for (const [key, { x1, x2 }] of self.anchorPlacements) {
          out.set(key, [x1 - origin, x2 - origin])
        }
        return out
      },
      /**
       * #getter
       * each group's viewport-cut centre, in view px before the scroll offset
       */
      get anchorAbsX(): Map<string, { coord: AnchorCoord; x: number }> {
        const view = self.lgv
        const assembly = self.anchorAssembly
        const out = new Map<string, { coord: AnchorCoord; x: number }>()
        if (!view.initialized || !assembly) {
          return out
        }
        for (const group of self.fitGroups) {
          const placement = axisPlacement(
            view,
            assembly.getCanonicalRefName2(group.anchor.refName),
            group.anchor.start,
            group.anchor.end,
          )
          if (placement) {
            out.set(group.key, {
              coord: placement.centre,
              x: (placement.x1 + placement.x2) / 2,
            })
          }
        }
        return out
      },
      /**
       * #method
       * undefined once the pivot is off the displayed regions
       */
      laneFrameOf(
        decision: LaneDecision,
        assemblyName: string,
      ): RowFrame | undefined {
        const pivot = self.lgv.bpToPx(decision.pivotAnchor)
        return pivot
          ? frameFromDecision(
              decision,
              pivot.offsetPx - self.renderOriginPx,
              self.visibleBpSpan,
              self.canvasWidth,
              self.anchorReversed,
              self.laneOpenings(assemblyName, decision.refName),
            )
          : undefined
      },
    }))
    .views(self => ({
      /** #getter */
      get rowFrames(): Map<string, RowFrame | undefined> {
        const out = new Map<string, RowFrame | undefined>()
        for (const assemblyName of self.rowAssemblies) {
          const decision = self.laneDecisions.get(assemblyName)
          const frame = decision && self.laneFrameOf(decision, assemblyName)
          const motion = frame && self.laneTransitions.get(assemblyName)
          const morphFrom = motion?.from.flatMap(seed => {
            const from = self.laneFrameOf(seed.decision, assemblyName)
            return from ? [{ frame: from, weight: seed.weight }] : []
          })
          out.set(
            assemblyName,
            frame && motion && morphFrom?.length === motion.from.length
              ? { ...frame, morphFrom }
              : frame,
          )
        }
        return out
      },
      /**
       * #getter
       * true only while the view, on the anchor the lanes froze on, still shows
       * part of the window they froze on
       */
      get lanesFrozen(): boolean {
        const frozen = self.frozenLanes
        return (
          frozen !== undefined &&
          self.laneKey(frozen.anchor) ===
            self.laneKey(self.anchorAssemblyName) &&
          self.lgv.dynamicBlocks.contentBlocks.some(block =>
            frozen.window.some(
              r =>
                r.refName === block.refName &&
                r.start < block.end &&
                block.start < r.end,
            ),
          )
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * empty unless `lanesFrozen`
       */
      get frozenDecisions(): ReadonlyMap<string, LaneDecision> {
        return new Map(
          self.lanesFrozen ? Object.entries(self.frozenLanes!.decisions) : [],
        )
      },
      /**
       * #method
       * in the px space anchored at `origin`; a lane in `frozen` keeps its own
       */
      laneDecisionsAt(
        origin: number,
        previous: ReadonlyMap<string, LaneDecision | undefined>,
        frozen: ReadonlyMap<string, LaneDecision>,
      ) {
        const view = self.lgv
        const { anchorAbsX } = self
        return decideLaneFrames({
          groups: self.fitGroups,
          assemblyNames: self.rowAssemblies,
          anchorX: new Map(
            [...anchorAbsX].map(([key, { x }]) => [key, x - origin]),
          ),
          anchorCoordOf: group => anchorAbsX.get(group.key)!.coord,
          pxOfAnchor: coord => {
            const px = view.bpToPx(coord)
            return px && px.offsetPx - origin
          },
          unitBp: self.visibleBpSpan,
          width: self.canvasWidth,
          anchorReversed: self.anchorReversed,
          previous,
          frozen,
          pinned: self.pinnedLaneContigs,
          pinnedFlips: self.pinnedLaneFlips,
          openingsOf: self.laneOpenings,
        })
      },
    }))
    .actions(self => {
      function setFrozenDecision(
        assemblyName: string,
        decision: LaneDecision | undefined,
      ) {
        const decisions = Object.fromEntries(self.frozenDecisions)
        if (decision) {
          decisions[assemblyName] = decision
        } else {
          delete decisions[assemblyName]
        }
        self.frozenLanes = { ...self.frozenLanes!, decisions }
      }
      function setLaneDragPx(assemblyName: string, dxPx: number | undefined) {
        const next = new Map(self.laneDragPx)
        if (dxPx === undefined) {
          next.delete(assemblyName)
        } else {
          next.set(assemblyName, dxPx)
        }
        self.laneDragPx = next
      }
      function setFlipPins(pins: ReadonlyMap<string, LaneFlipPin>) {
        self.laneFlipPinsByAnchor = new Map(self.laneFlipPinsByAnchor).set(
          self.laneKey(self.anchorAssemblyName),
          pins,
        )
      }
      function nudgeLane(assemblyName: string, dxPx: number) {
        const base = self.laneDecisions.get(assemblyName)
        if (self.lanesFrozen && base && dxPx !== 0) {
          const nudged = nudgeDecision(
            base,
            dxPx,
            (base.rung * self.visibleBpSpan) / self.canvasWidth,
            self.anchorReversed,
            self.laneOpenings(assemblyName, base.refName),
          )
          setFrozenDecision(assemblyName, nudged)
          self.laneDecisions = new Map(self.laneDecisions).set(
            assemblyName,
            nudged,
          )
        }
      }
      function realign(assemblyName: string) {
        if (self.lanesFrozen) {
          const previous = new Map(self.laneDecisions)
          previous.delete(assemblyName)
          const frozen = new Map(self.frozenDecisions)
          frozen.delete(assemblyName)
          setFrozenDecision(
            assemblyName,
            self
              .laneDecisionsAt(self.lgv.offsetPx, previous, frozen)
              .get(assemblyName),
          )
        }
      }
      return {
        /** #action */
        setLanesFrozen(flag: boolean) {
          self.frozenLanes = flag
            ? {
                anchor: self.anchorAssemblyName,
                decisions: Object.fromEntries(
                  [...self.laneDecisions].filter(
                    (entry): entry is [string, LaneDecision] => !!entry[1],
                  ),
                ),
                window: mergeContiguousRegions(
                  self.lgv.dynamicBlocks.contentBlocks,
                ),
              }
            : undefined
          self.laneDragPx = new Map()
        },
        /** #action */
        realignLane(assemblyName: string) {
          realign(assemblyName)
        },
        /**
         * #action
         * slides a mate lane `dxPx` screen px, only while the lanes are frozen
         */
        nudgeLane(assemblyName: string, dxPx: number) {
          nudgeLane(assemblyName, dxPx)
        },
        /** #action */
        setLaneDragPx(assemblyName: string, dxPx: number) {
          setLaneDragPx(assemblyName, dxPx)
        },
        /** #action */
        endLaneDrag(assemblyName: string) {
          const dxPx = self.laneDragPx.get(assemblyName)
          setLaneDragPx(assemblyName, undefined)
          if (dxPx !== undefined) {
            nudgeLane(assemblyName, dxPx)
          }
        },
        /**
         * #action
         * `undefined` lets the lane choose again
         */
        pinLaneContig(assemblyName: string, refName: string | undefined) {
          const pins = new Map(self.pinnedLaneContigs)
          if (refName === undefined) {
            pins.delete(assemblyName)
          } else {
            pins.set(assemblyName, refName)
          }
          self.pinnedLaneContigs = pins
          realign(assemblyName)
        },
        /** #action */
        flipLane(assemblyName: string) {
          const decision = self.laneDecisions.get(assemblyName)
          if (decision) {
            setFlipPins(
              new Map(self.pinnedLaneFlips).set(assemblyName, {
                refName: decision.refName,
                flipped: !decision.flipped,
              }),
            )
            realign(assemblyName)
          }
        },
        /** #action */
        unpinLaneFlip(assemblyName: string) {
          const pins = new Map(self.pinnedLaneFlips)
          pins.delete(assemblyName)
          setFlipPins(pins)
          realign(assemblyName)
        },
      }
    })
    .actions(self => {
      function setHalfway(next: ReadonlySet<string>) {
        const held = self.laneMotionHalfway
        if (
          next.size !== held.size ||
          [...next].some(lane => !held.has(lane))
        ) {
          self.laneMotionHalfway = next
        }
      }
      return {
        /**
         * #action
         * `originPx` is the view offset the decisions' px space is anchored at
         */
        setLaneFrames(
          originPx: number,
          decisions: Map<string, LaneDecision | undefined>,
        ) {
          const previous = self.laneDecisions
          self.renderOriginPx = originPx
          self.laneDecisions = decisions
          const nowMs = morphClockMs()
          self.laneTransitions = laneTransitionsAfter({
            previous,
            next: decisions,
            running: self.laneTransitions,
            drawnAtMs: self.laneMotionClockMs,
            nowMs,
            allowed: animationAllowed(getSession(self).animationMode),
            frameOf: (decision, assemblyName) =>
              self.laneFrameOf(decision, assemblyName),
            width: self.canvasWidth,
          })
          setHalfway(lanesPastHalfway(self.laneTransitions, nowMs))
        },
        /** #action */
        advanceAnimation(nowMs: number) {
          self.laneMotionClockMs = nowMs
          const running = laneTransitionsRunning(self.laneTransitions, nowMs)
          if (running.size !== self.laneTransitions.size) {
            self.laneTransitions = running
          }
          setHalfway(lanesPastHalfway(running, nowMs))
        },
        /** #action */
        endAnimation() {
          if (self.laneTransitions.size > 0) {
            self.laneTransitions = new Map()
          }
          setHalfway(new Set())
        },
      }
    })
    .views(self => ({
      /** #getter */
      get anchorFetchRegions(): FetchRegion[] {
        const view = self.lgv
        return view.initialized
          ? mergeContiguousRegions(view.staticBlocks.contentBlocks)
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * what each lane's dependent fetches ask for: the anchor's merged blocks,
       * and each held, framed lane's window
       */
      get laneWindows(): ReadonlyMap<string, LaneWindow> {
        const out = new Map<string, LaneWindow>()
        if (!self.lgv.initialized) {
          return out
        }
        const regions = self.anchorFetchRegions
        if (regions.length) {
          out.set(self.anchorAssemblyName, {
            regions,
            spanBp: self.visibleBpSpan,
            bpPerPx: self.lgv.bpPerPx,
          })
        }
        for (const [assemblyName, frame] of self.rowFrames) {
          if (frame && self.holdsAssembly(assemblyName)) {
            const spanBp = frame.max - frame.min
            out.set(assemblyName, {
              regions: [{ assemblyName, ...laneFetchRegion(frame) }],
              spanBp,
              bpPerPx: spanBp / self.canvasWidth,
            })
          }
        }
        return out
      },
      /** #getter */
      get lanePairs(): LanePair[] {
        const rows = self.rowAssemblies
        return rows.slice(1).map((lower, i) => {
          const upper = rows[i]!
          return { upper, lower, key: lanePairKey(upper, lower) }
        })
      },
      /** #getter */
      get anchorlessGroups(): PlacedGroup[] {
        const anchor = self.laneKey(self.anchorAssemblyName)
        return anchorlessGroupsOf(
          [...(self.laneGroups.held ?? [])].map(
            ([lane, { features }]) => [lane, features] as const,
          ),
          assemblyName => self.laneKey(assemblyName) === anchor,
        )
      },
    }))
    .views(self => ({
      /** #getter */
      get laneGenesFetchSpecs(): LaneGenesFetchSpec[] {
        const tracks = self.laneGeneTracks
        const adapters = self.laneGeneAdapters
        const specs: LaneGenesFetchSpec[] = []
        for (const [assemblyName, { regions }] of self.laneWindows) {
          const adapter = adapters.get(assemblyName)
          if (adapter) {
            const track = tracks.get(assemblyName)
            const source = track
              ? (readConfObject(track, 'trackId') as string)
              : `adapter:${JSON.stringify(adapter)}`
            specs.push({
              lane: assemblyName,
              key: `${source}@${regions.map(regionKey).join(',')}`,
              assemblyName,
              adapterConfig: adapter,
              regions,
            })
          }
        }
        return specs
      },
      /**
       * #getter
       * a gene table read on each mate lane's window, for the rows the anchor
       * lacks; a star source indexes its anchor alone, so it has none to give
       */
      get laneGroupsFetchSpecs(): LaneGroupsFetchSpec[] {
        const { lodTier, features, laneWindows } = self
        return features?.some(isNamedRecord) && self.starAnchor === undefined
          ? self.rowAssemblies.flatMap(lane => {
              const regions = laneWindows.get(lane)?.regions
              return regions
                ? [
                    {
                      lane,
                      key: `${regions.map(regionKey).join(',')}|${lodTier}`,
                      assemblyName: lane,
                      regions,
                      lodTier,
                    },
                  ]
                : []
            })
          : []
      },
      /**
       * #getter
       * one spec per adjacent mate-lane pair
       */
      get laneLinksFetchSpecs(): LaneLinksFetchSpec[] {
        const specs: LaneLinksFetchSpec[] = []
        const onAnchor = self.adapterPairsOnAnchor
        if (self.featuresAreNameless && self.adjacentLanesAlignDirectly) {
          const { lodTier, laneWindows, rowFrames } = self
          const pairRegions = (upper: string, lower: string) => {
            if (onAnchor) {
              return rowFrames.get(upper) && rowFrames.get(lower)
                ? (laneWindows.get(self.anchorAssemblyName)?.regions ?? [])
                : []
            }
            const upperWindow = laneWindows.get(upper)
            return upperWindow && laneWindows.get(lower)
              ? upperWindow.regions
              : []
          }
          for (const { upper, lower, key } of self.lanePairs) {
            const regions = pairRegions(upper, lower)
            if (regions.length > 0) {
              specs.push({
                lane: key,
                key: `${regions.map(regionKey).join(',')}|${lodTier}`,
                assemblyName: upper,
                lowerAssembly: lower,
                regions,
                onAnchor,
                lodTier,
              })
            }
          }
        }
        return specs
      },
    }))
    .views(self => ({
      /** #getter */
      get laneLayerTemplates(): (Record<string, unknown> | undefined)[] {
        const { pluginManager } = getEnv(self)
        return self.configuration.laneLayers.map(layer => {
          const adapter: unknown = layer.adapter
          return isObject(adapter) &&
            typeof adapter.type === 'string' &&
            pluginManager.hasAdapterType(adapter.type) &&
            pluginManager
              .getAdapterType(adapter.type)
              .adapterCapabilities.includes(READS_REFERENCE)
            ? adapter
            : undefined
        })
      },
    }))
    .views(self => ({
      /** #getter */
      get laneLayerSources(): Map<string, LaneLayerSource>[] {
        const byId = new Map(
          allSessionTracks(getSession(self)).map(track => [
            readConfObject(track, 'trackId') as string,
            track,
          ]),
        )
        const lanes = [self.anchorAssemblyName, ...self.rowAssemblies]
        return self.configuration.laneLayers.map((layer, i) => {
          const out = new Map<string, LaneLayerSource>()
          for (const trackId of layer.tracks) {
            const track = byId.get(trackId)
            const names = track ? getConfAssemblyNamesOrNone(track) : []
            for (const lane of lanes) {
              if (
                track &&
                !out.has(lane) &&
                names.some(name => self.laneKey(name) === self.laneKey(lane))
              ) {
                out.set(lane, {
                  source: trackId,
                  adapterConfig: readConfObject(track, 'adapter'),
                  template: false,
                })
              }
            }
          }
          const template = self.laneLayerTemplates[i]
          if (template) {
            const source = `adapter:${JSON.stringify(template)}`
            for (const lane of lanes) {
              if (!out.has(lane)) {
                out.set(lane, {
                  source,
                  adapterConfig: template,
                  template: true,
                })
              }
            }
          }
          return out
        })
      },
      /**
       * #getter
       * `pastCap` flags a layer that skipped a lane past `LANE_TEMPLATE_MAX_BP`
       */
      get laneLayerReads() {
        const specs: LaneLayerFetchSpec[] = []
        const layers = self.configuration.laneLayers
        const pastCap = layers.map(() => false)
        layers.forEach(({ marks }, layer) => {
          const sources = this.laneLayerSources[layer]
          for (const [assemblyName, window] of self.laneWindows) {
            const from = sources?.get(assemblyName)
            if (!from) {
              continue
            }
            const { regions, spanBp } = window
            if (
              from.template &&
              (laneFetchRegionMaxBp(spanBp) > LANE_TEMPLATE_MAX_BP ||
                regions.some(r => r.end - r.start > LANE_TEMPLATE_MAX_BP))
            ) {
              pastCap[layer] = true
              continue
            }
            const bpPerPx = laneLayerBpPerPx(window.bpPerPx)
            const requests = marks.map(m =>
              markLayerRequest(m, stepChannels(m.transform), bpPerPx),
            )
            const signature = JSON.stringify(requests)
            regions.forEach((region, i) => {
              specs.push({
                lane: laneLayerSpecLane(assemblyName, layer, i),
                key: `${from.source}@${regionKey(region)}@${bpPerPx}@${signature}`,
                assemblyName,
                layer,
                adapterConfig: from.adapterConfig,
                region,
                bpPerPx,
                requests,
              })
            })
          }
        })
        return { specs, pastCap }
      },
      /** #getter */
      get laneLayersFetchSpecs(): LaneLayerFetchSpec[] {
        return this.laneLayerReads.specs
      },
      /**
       * #getter
       * carries no lane genes, so a gene commit re-uploads no ribbon or tick
       */
      get laneStack(): LaneStack {
        const { assemblyManager } = getSession(self)
        const heldAssembly = (assemblyName: string) =>
          self.holdsAssembly(assemblyName)
            ? assemblyManager.get(assemblyName)
            : undefined
        const view = self.lgv
        return buildLanes({
          assemblyNames: [self.anchorAssemblyName, ...self.rowAssemblies],
          groups: [...self.visibleGroups, ...self.anchorlessGroups],
          anchorSpans: self.anchorSpans,
          rowFrames: self.rowFrames,
          laneGeneAdapters: self.laneGeneAdapters,
          axisSpanOf: (refName, start, end) =>
            axisSpan(view, refName, start, end, self.renderOriginPx),
          anchorRegionSpans: displayedRegionSpans(view, self.renderOriginPx),
          anchorBpPerPx: view.bpPerPx,
          contigOf: (assemblyName, refName) => {
            const assembly = heldAssembly(assemblyName)
            const index = assembly?.refNameToIndex?.get(refName)
            return index === undefined ? undefined : assembly?.regions?.[index]
          },
          refNameAliasOf: assemblyName => {
            const assembly = heldAssembly(assemblyName)
            return (
              assembly && (refName => assembly.getCanonicalRefName2(refName))
            )
          },
          width: self.canvasWidth,
          height: self.height,
          splitStrands: self.splitStrands,
          geneLabelPx: self.geneLabelPx,
          layerPx: self.layerPx,
          pastHalfway: self.laneMotionHalfway,
          labelOf: assemblyName => self.laneLabel(assemblyName),
        })
      },
    }))
    .views(self => ({
      /** #getter */
      get laneMaps(): ReadonlyMap<number, LaneMap> {
        const out = new Map<number, LaneMap>()
        if (self.laneTransitions.size > 0 || self.laneDragPx.size > 0) {
          const nowMs = self.laneMotionClockMs
          self.laneStack.lanes.forEach(({ assemblyName, frame }, row) => {
            const motion = self.laneTransitions.get(assemblyName)
            const moving =
              motion && frame?.morphFrom
                ? laneMapAt(
                    frame.morphFrom,
                    frame,
                    laneMotionEase(motion, nowMs),
                    self.canvasWidth,
                  )
                : undefined
            const dx = self.laneDragPx.get(assemblyName) ?? 0
            if (moving || dx !== 0) {
              out.set(row, {
                scale: moving?.scale ?? 1,
                offset: (moving?.offset ?? 0) + dx,
              })
            }
          })
        }
        return out
      },
    }))
    .views(self => ({
      /** #getter */
      get laneHeaderRows() {
        const lanes = self.laneStack.lanes.map(lane => {
          return lane.frame?.morphFrom
            ? {
                ...lane,
                frame: shownFrame(
                  lane.frame,
                  self.laneMotionHalfway.has(lane.assemblyName),
                ),
              }
            : lane
        })
        return laneHeaderRows(lanes, self.visibleBpSpan, self.anchorLocString)
      },
      /**
       * #getter
       * keyed `upper|lower` per adjacent mate-lane pair
       */
      get pairLinks(): ReadonlyMap<string, LaneLinks> {
        const out = new Map<string, LaneLinks>()
        const placements = new Map<string, LanePlacementRecord[]>()
        const placementsOn = (assemblyName: string) => {
          let records = placements.get(assemblyName)
          if (!records) {
            records = self.groups.flatMap(group =>
              (group.mates.get(assemblyName) ?? []).map(
                (p): LanePlacementRecord => ({
                  anchorRefName: group.anchor.refName,
                  anchorStart: group.anchor.start,
                  anchorEnd: group.anchor.end,
                  refName: p.refName,
                  start: p.start,
                  end: p.end,
                  strand: p.orientation < 0 ? -1 : 1,
                  feature: p.feature,
                  ops: self.featureOps.get(p.feature.id()),
                }),
              ),
            )
            placements.set(assemblyName, records)
          }
          return records
        }
        for (const { upper, lower, key: pair } of self.lanePairs) {
          const fetched = self.laneLinks.held?.get(pair)
          if (fetched !== undefined && fetched.links.length > 0) {
            out.set(pair, fetched)
          } else if (
            self.featuresAreNameless &&
            (self.starAnchor !== undefined ||
              fetched !== undefined ||
              !self.holdsAssembly(upper) ||
              !self.holdsAssembly(lower))
          ) {
            out.set(
              pair,
              composeLaneLinks({
                upper: placementsOn(upper),
                lower: placementsOn(lower),
                upperAssemblyName: upper,
                lowerAssemblyName: lower,
              }),
            )
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * in the stack's own px
       */
      get ribbonGeometry() {
        return buildRibbonGeometry({
          stack: self.laneStack,
          anchorOps: self.featureOps,
          laneLinks: self.pairLinks,
          ribbonColor: self.ribbonColor,
          ribbonColorField: self.ribbonColorField,
          attributeRanges: self.ribbonAttributeRanges,
          hideUnlabelled: self.hideUnlabelled,
          ramp: self.ribbonRamp,
          drawCurves: self.drawCurves,
          bridgeSkippedLanes: self.bridgeSkippedLanes,
        })
      },
    }))
    .views(self => ({
      get tickGeometry(): TickGeometry {
        return self.showLaneTicks
          ? buildTickGeometry({
              stack: self.laneStack,
              tickIntervalBp: self.tickIntervalBp,
              width: self.canvasWidth,
              color: bandInk().gridline,
            })
          : { cells: new Map(), layers: [] }
      },
      /** #method */
      bandCellOn(page: string): MultiWayCell {
        return {
          kind: 'glyphs',
          data: buildBandCell({
            ...laneGeometry(
              self.height,
              1 + self.rowAssemblies.length,
              self.splitStrands,
              self.geneLabelPx,
              self.layerPx,
            ),
            width: self.canvasWidth,
            paper: bandGroundColor(),
            stripe: bandInk().stripe,
            page,
          }),
        }
      },
      /** #getter */
      get bandCell(): MultiWayCell {
        return this.bandCellOn(getPaletteHost(self).palette.background.paper)
      },
    }))
    .views(self => {
      let held: {
        lane: Lane
        genes: LaneGene[]
        colors: LaneGlyphColors
        glyphs: MultiWayCell
        boxes: MultiWayCell
        boxNames: NamedSpan[]
        geneGroups: Map<string, string>
      }[] = []
      return {
        /**
         * #getter
         * boxes before glyphs, so an in-order hit test finds a box over a gene
         */
        get laneCells() {
          const { laneGeneColors, boxColors } = self
          const laneGenes = self.laneGenes.held
          const { lanes, glyphHeight } = self.laneStack
          const ink = bandInk()
          held = lanes.map((lane, row) => {
            const colors = {
              genes: laneGeneColors.get(lane.assemblyName) ?? boxColors,
              boxes: boxColors,
              stroke: ink.text,
              divider: ink.divider,
            }
            const genes = laneGenes?.get(lane.assemblyName)?.genes ?? NO_GENES
            const prev = held[row]
            if (
              prev?.lane === lane &&
              prev.genes === genes &&
              prev.colors.genes === colors.genes &&
              prev.colors.boxes === colors.boxes &&
              prev.colors.stroke === colors.stroke &&
              prev.colors.divider === colors.divider
            ) {
              return prev
            }
            const { glyphs, boxes, boxNames, geneGroups } = buildLaneCells({
              lane,
              genes,
              glyphHeight,
              width: self.canvasWidth,
              colors,
            })
            return {
              lane,
              genes,
              colors,
              glyphs: { kind: 'glyphs', data: glyphs },
              boxes: { kind: 'glyphs', data: boxes },
              boxNames,
              geneGroups,
            }
          })
          const cells = new Map<string, MultiWayCell>()
          held.forEach(({ glyphs, boxes }, row) => {
            cells.set(boxesKey(row), boxes)
            cells.set(glyphsKey(row), glyphs)
          })
          return {
            cells,
            boxNames: new Map(
              held.map(({ lane, boxNames }) => [lane.assemblyName, boxNames]),
            ),
            geneGroups: new Map(
              held.map(({ lane, geneGroups }) => [
                lane.assemblyName,
                geneGroups,
              ]),
            ),
          }
        },
      }
    })
    .views(self => ({
      /** #getter */
      get laneGlyphCells() {
        return self.laneCells.cells
      },
      /** #getter */
      get laneBoxNames(): Map<string, NamedSpan[]> {
        return self.laneCells.boxNames
      },
      /**
       * #getter
       * per lane, each drawn gene's group, keyed by feature id
       */
      get laneGeneGroups(): Map<string, Map<string, string>> {
        return self.laneCells.geneGroups
      },
      /** #getter */
      get pinnedLabelGroups(): ReadonlySet<string> {
        return new Set(
          [self.hoveredGroupKey, self.clickedTarget?.groupKey].filter(
            (key): key is string => key !== undefined,
          ),
        )
      },
    }))
    .views(self => ({
      /** #getter */
      get geneTextOf(): (feature: Feature) => string | undefined {
        const field = self.geneTextField
        if (!field) {
          return getFeatureName
        }
        try {
          const read = fieldReader(field, getEnv(self).pluginManager.jexl)
          return feature => {
            try {
              return valueText(read(feature)) || undefined
            } catch {
              return undefined
            }
          }
        } catch (e) {
          console.error(e)
          return getFeatureName
        }
      },
    }))
    .views(self => {
      let memo = {
        text: getFeatureName,
        fontFamily: '' as string | undefined,
        genes: undefined as unknown,
        byId: new Map<string, GeneLabel | null>(),
      }
      return {
        /**
         * #method
         * placed in the stack's px
         */
        laneGeneLabels(
          fontFamily: string | undefined,
          pinnedGroups: ReadonlySet<string> = new Set(),
          width = self.canvasWidth,
        ): PlacedLaneLabel[] {
          if (!self.showGeneLabels) {
            return []
          }
          const text = self.geneTextOf
          const genes = self.laneGenes.held
          if (
            memo.text !== text ||
            memo.fontFamily !== fontFamily ||
            memo.genes !== genes
          ) {
            memo = { text, fontFamily, genes, byId: new Map() }
          }
          const { byId } = memo
          const { lanes, glyphHeight } = self.laneStack
          const boxNames = self.laneBoxNames
          return placeLaneLabels({
            lanes,
            genesOf: assemblyName => genes?.get(assemblyName)?.genes ?? [],
            boxesOf: assemblyName => boxNames.get(assemblyName) ?? [],
            labelOf: feature => {
              const id = feature.id()
              let label = byId.get(id)
              if (label === undefined) {
                const name = text(feature)
                label = name
                  ? {
                      name,
                      width: measureText(name, GENE_LABEL_FONT_PX, fontFamily),
                    }
                  : null
                byId.set(id, label)
              }
              return label ?? undefined
            },
            groupsOf: assemblyName => self.laneGeneGroups.get(assemblyName),
            pinnedGroups,
            glyphHeight,
            width,
            height: self.scrollContentHeight,
            fontFamily,
          })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * keys the anchor lane alone, over the settled window
       */
      get geneColorScales(): ColorScale[] {
        const hits = [boxesKey(0), glyphsKey(0)].flatMap(key => {
          const cell = self.laneGlyphCells.get(key)
          return cell?.kind === 'glyphs' ? cell.data.hits : []
        })
        const onScreen: Span = [0, self.canvasWidth]
        const encoding = self.geneColorEncoding
        const { title } = self.geneColorSettings.color
        const field = colorFieldOf(encoding, self.geneColorSlots)
        if (field) {
          return laneFieldKey(hits, onScreen, field, title)
        }
        const items = isJexl(encoding) ? laneColorKey(hits, onScreen) : []
        return legendIsReadable(items, MAX_LEGEND_ENTRIES)
          ? [
              {
                kind: 'categorical',
                id: 'genes',
                title: title ?? 'Gene colors',
                entries: items,
              },
            ]
          : []
      },
    }))
    .actions(self => ({
      /**
       * #action
       * `''` paints by `color.value`
       */
      setGeneColorBy(field: string) {
        setConf(
          self,
          'color',
          colorForField(self.geneColorSettings.color, field),
        )
      },
    }))
    .views(self => ({
      /** #getter */
      get colorScales(): ColorScale[] {
        const scales: ColorScale[] = [
          ...self.geneColorScales,
          ...ribbonColorScales(
            self.ribbonColorField,
            self.ribbonAttributeRanges,
            {
              domain: self.ribbonColorDomain,
              hideUnlabelled: self.hideUnlabelled,
              slotColor: self.ribbonColor,
              labels: getConf(self, ['ribbonColor', 'labels']),
              title: getConf(self, ['ribbonColor', 'title']),
              ramp: self.ribbonRamp,
            },
          ),
        ]
        return scales.filter(scale => !colorScaleIsEmpty(scale))
      },
      /** #getter */
      get legendRight(): number {
        return SCALE_COLUMN_PX
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each payload's region placed in its lane's own frame; a payload whose
       * lane or contig no longer draws is left out
       */
      get laneLayerPlacements() {
        const view = self.lgv
        const { lanes } = self.laneStack
        const heights = self.laneLayerHeights
        const rowOf = new Map(
          lanes.map((lane, row) => [lane.assemblyName, row]),
        )
        const out: {
          specLane: string
          held: HeldLaneLayer
          row: number
          top: number
          height: number
          px: Span
        }[] = []
        for (const [specLane, held] of self.laneLayerData.held ?? []) {
          const row = rowOf.get(held.assemblyName)
          const lane = row === undefined ? undefined : lanes[row]
          const height = heights[held.layer]
          if (!lane || row === undefined || height === undefined) {
            continue
          }
          const { refName, start, end } = held.region
          const px: Span | undefined = lane.isAnchor
            ? axisSpan(
                view,
                lane.canon(refName),
                start,
                end,
                self.renderOriginPx,
              )
            : lane.frame &&
                lane.canon(lane.frame.refName) === lane.canon(refName)
              ? [
                  rowFrameX(lane.frame, start, self.canvasWidth),
                  rowFrameX(lane.frame, end, self.canvasWidth),
                ]
              : undefined
          if (px) {
            out.push({
              specLane,
              held,
              row,
              top: layerBandTops(lane.layerTop, heights)[held.layer]!,
              height,
              px,
            })
          }
        }
        return out
      },
    }))
    .views(self => {
      // a fresh array per read would recolour every held payload on each read
      // nothing observes, so an equal one keeps the last one's identity
      const sameColors = sameAsLast<ColorSource[][]>()
      return {
        /**
         * #getter
         * undefined for a layer no drawn lane holds values for yet
         */
        get laneLayerDomains() {
          return laneLayerDomains(
            self.laneLayerPlacements.map(placement => placement.held),
            self.configuration.laneLayers.length,
          )
        },
        /**
         * #getter
         * where each lane layer's marks take their colour from, one per mark,
         * read as the mark display reads its own
         */
        get laneLayerColors(): ColorSource[][] {
          return sameColors(
            self.configuration.laneLayers.map(layer =>
              layer.marks.map(m =>
                markColorOf(m, stepChannels(m.transform), self),
              ),
            ),
          )
        },
        /**
         * #method
         * a held payload's layers, each coloured as its mark declares
         */
        coloredLayersOf(held: HeldLaneLayer): EncodedChannels[] {
          const colors = this.laneLayerColors[held.layer]
          return held.channels.map((channels, mark) => {
            const color = colors?.[mark]
            return color ? coloredLaneLayer(channels, color) : channels
          })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * the ramp or threshold each lane layer's bars paint numbers through,
       * one per mark and undefined for a mark coloured another way; a ramp's
       * domain covers the values of every drawn lane, as `laneLayerDomains`
       * does for y, so one value takes one colour in all of them
       */
      get laneLayerColorScales(): (MarkColorScale | undefined)[][] {
        const colors = self.laneLayerColors
        const drawn = colors.map(() => [] as { layers: EncodedChannels[] }[])
        for (const { held } of self.laneLayerPlacements) {
          drawn[held.layer]?.push({ layers: self.coloredLayersOf(held) })
        }
        return drawn.map((regions, layer) =>
          paintScalesOver(regions, colors[layer]!.length),
        )
      },
      /** #getter */
      get laneLayerTitles() {
        const anchor = self.laneStack.lanes[0]
        const heights = self.laneLayerHeights
        const tops = anchor ? layerBandTops(anchor.layerTop, heights) : []
        const domains = self.laneLayerDomains
        const { pastCap } = self.laneLayerReads
        return self.configuration.laneLayers.map((layer, i) => {
          const domain = domains[i]
          const range = domain
            ? ` ${Number(domain[0].toPrecision(3))}–${Number(domain[1].toPrecision(3))}`
            : ''
          return {
            key: String(i),
            text: `${layer.name}${range}${pastCap[i] ? ' · zoom in' : ''}`,
            top: tops[i]!,
          }
        })
      },
      /** #getter */
      get laneLayerCells() {
        const cells = new Map<string, MultiWayCell>()
        const layers: BarLayer[] = []
        const domains = self.laneLayerDomains
        const colorScales = this.laneLayerColorScales
        for (const {
          specLane,
          held,
          row,
          top,
          height,
          px,
        } of self.laneLayerPlacements) {
          const domain = domains[held.layer]
          if (!domain) {
            continue
          }
          const { start, end } = held.region
          self.coloredLayersOf(held).forEach((channels, mark) => {
            const colorScale = layerColorScale(
              channels,
              colorScales[held.layer]?.[mark],
            )
            const cell = barCellOf(
              channels,
              domain,
              colorScale && !isThreshold(colorScale)
                ? colorScale.lut
                : undefined,
            )
            if (cell) {
              const key = `bars:${specLane}:${mark}`
              cells.set(key, cell)
              layers.push({
                kind: 'bars',
                key,
                row,
                top,
                height,
                domain,
                origin: laneLayerOrigin(domain),
                colorScale,
                start,
                end,
                px,
              })
            }
          })
        }
        return { cells, layers }
      },
      /** #getter */
      get namedCells(): ReadonlyMap<string, MultiWayCell> {
        return new Map<string, MultiWayCell>([
          [BANDS_KEY, self.bandCell],
          ...self.ribbonGeometry.cells,
          ...self.tickGeometry.cells,
          ...this.laneLayerCells.cells,
          ...self.laneGlyphCells,
        ])
      },
      /**
       * #getter
       * back to front, bands first to cover the view's gridlines
       */
      get namedLayers(): MultiWayLayer[] {
        const { lanes } = self.laneStack
        return [
          { kind: 'glyphs', key: BANDS_KEY, scrolled: false },
          ...self.ribbonGeometry.layers,
          ...self.tickGeometry.layers,
          ...this.laneLayerCells.layers,
          ...lanes.flatMap((_lane, row): MultiWayLayer[] => [
            { kind: 'glyphs', key: glyphsKey(row), scrolled: true, row },
            { kind: 'glyphs', key: boxesKey(row), scrolled: true, row },
          ]),
        ]
      },
      /** #getter */
      get hoveredFeatureId() {
        return ribbonFeatureId(self.ribbonGeometry, self.hoverTarget)
      },
      /** #getter */
      get clickedFeatureId() {
        return ribbonFeatureId(self.ribbonGeometry, self.clickedTarget)
      },
      /** #getter */
      get hoverInk(): HighlightRect[] {
        const { hoveredGroupKey, dragOffsetPx, scrollTop } = self
        const { lanes, glyphHeight } = self.laneStack
        return hoveredGroupKey === undefined
          ? []
          : lanes.flatMap((lane, row) => {
              const map = laneMapOf(self, row)
              return (lane.placements.get(hoveredGroupKey)?.spans ?? []).map(
                span =>
                  drawnRect(
                    map,
                    span,
                    dragOffsetPx,
                    lane.glyphTop - scrollTop,
                    glyphHeight,
                  ),
              )
            })
      },
      /** #getter */
      get selectionInk(): HighlightRect[] {
        const { selectedFeatureId, dragOffsetPx, scrollTop } = self
        return selectedFeatureId === undefined
          ? []
          : self.laneStack.lanes.flatMap((_lane, row) => {
              const map = laneMapOf(self, row)
              return [boxesKey(row), glyphsKey(row)].flatMap(key => {
                const cell = self.laneGlyphCells.get(key)
                return cell?.kind === 'glyphs'
                  ? cell.data.hits
                      .filter(hit => hit.feature.id() === selectedFeatureId)
                      .map(hit =>
                        drawnRect(
                          map,
                          [hit.x1, hit.x2],
                          dragOffsetPx,
                          hit.y1 - scrollTop,
                          hit.y2 - hit.y1,
                        ),
                      )
                  : []
              })
            })
      },
      /** #getter */
      get highlightStyle(): HighlightStyle {
        return 'shade'
      },
      /** #getter */
      get groundPalette() {
        return bandPalette
      },
    }))
    .views(self => ({
      /** #getter */
      get outlineCells(): ReadonlyMap<string, MultiWayCell> {
        const featureId = self.clickedFeatureId
        const out = new Map<string, MultiWayCell>()
        if (featureId > 0) {
          for (const [key, cell] of self.ribbonGeometry.cells) {
            if (cell.kind === 'ribbons') {
              out.set(outlineKey(key), {
                kind: 'outline',
                data: cell.data,
                featureId,
              })
            }
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * keyed by `sharedBackendKey`
       */
      get renderCells(): ReadonlyMap<number, MultiWayCell> {
        const out = new Map<number, MultiWayCell>()
        for (const [key, cell] of self.namedCells) {
          out.set(sharedBackendKey(key), cell)
        }
        for (const [key, cell] of self.outlineCells) {
          out.set(sharedBackendKey(key), cell)
        }
        return out
      },
      /**
       * #getter
       * back to front, each outline immediately over the gutter it traces
       */
      get renderLayers(): ReadonlyMap<number, MultiWayLayer> {
        const out = new Map<number, MultiWayLayer>()
        for (const layer of self.namedLayers) {
          out.set(sharedBackendKey(layer.key), layer)
          const key = outlineKey(layer.key)
          if (layer.kind === 'ribbons' && self.outlineCells.has(key)) {
            out.set(sharedBackendKey(key), {
              kind: 'outline',
              key,
              ribbon: layer,
            })
          }
        }
        return out
      },
      /**
       * #getter
       * in draw order
       */
      get ribbonRegions(): ReadonlyMap<number, SyntenyInstanceData> {
        const out = new Map<number, SyntenyInstanceData>()
        for (const [key, cell] of self.ribbonGeometry.cells) {
          if (cell.kind === 'ribbons') {
            out.set(sharedBackendKey(key), cell.data)
          }
        }
        return out
      },
      /**
       * #getter
       * `ribbonGeometry.records` keyed by `sharedBackendKey`
       */
      get ribbonRecords(): ReadonlyMap<number, ReadonlyMap<number, Feature>> {
        const out = new Map<number, ReadonlyMap<number, Feature>>()
        for (const [key, records] of self.ribbonGeometry.records) {
          out.set(sharedBackendKey(key), records)
        }
        return out
      },
    }))
    .views(self => ({
      /** #getter */
      get renderState(): MultiWayRenderState {
        return {
          canvasWidth: self.canvasWidth,
          canvasHeight: self.height,
          dragOffsetPx: self.dragOffsetPx,
          scrollTopPx: self.scrollTop,
          hoveredFeatureId: self.hoveredFeatureId,
          clickedFeatureId: self.clickedFeatureId,
          laneMaps: self.laneMaps,
          groundColor: bandGroundColor(),
          layers: self.renderLayers,
        }
      },
    }))
    .views(self => ({
      /** #getter */
      get renderBlocks() {
        return multiwayBlocks(self.renderState)
      },
      /** #getter */
      get ribbonPickState(): SyntenyRenderState {
        return ribbonPickState(self.renderState)
      },
    }))
    .views(self => {
      const pick = createSyntenyPicker()
      return {
        /**
         * #method
         * `x` and `y` are container-relative; the topmost ribbon wins
         */
        pickRibbonAt(x: number, y: number) {
          return pick(
            self.ribbonRegions,
            self.ribbonPickState,
            self.canvasWidth,
            x,
            y,
          )
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * `y` is container-relative; undefined unless the lanes are frozen
       */
      slidableLaneAt(y: number): string | undefined {
        const oy = y + self.scrollTop
        const { lanes, glyphHeight } = self.laneStack
        const lane = self.lanesFrozen
          ? lanes.find(
              lane =>
                !lane.isAnchor &&
                oy >= lane.bandTop &&
                oy <= lane.glyphTop + glyphHeight + self.geneLabelPx,
            )
          : undefined
        return lane?.frame ? lane.assemblyName : undefined
      },
      /**
       * #method
       * `x` and `y` are container-relative
       */
      hitTest(x: number, y: number): HoverTarget | undefined {
        const oy = y + self.scrollTop
        const { lanes, glyphHeight } = self.laneStack
        const row = lanes.findIndex(
          lane => oy >= lane.glyphTop && oy <= lane.glyphTop + glyphHeight,
        )
        if (row >= 0) {
          const px = packedPx(laneMapOf(self, row), x - self.dragOffsetPx)
          for (const key of [boxesKey(row), glyphsKey(row)]) {
            const cell = self.laneGlyphCells.get(key)
            const hit =
              cell?.kind === 'glyphs'
                ? glyphHitAt(cell.data.hits, px, oy)
                : undefined
            if (hit) {
              return {
                label: hit.label,
                feature: hit.feature,
                groupKey: hit.groupKey,
              }
            }
          }
        }
        const hit = self.pickRibbonAt(x, y)
        const targetIdx =
          hit &&
          self.ribbonRegions.get(hit.key)?.instanceFeatureIdx[hit.instanceIndex]
        const target =
          targetIdx === undefined
            ? undefined
            : self.ribbonGeometry.targets[targetIdx]
        const record =
          hit && self.ribbonRecords.get(hit.key)?.get(hit.instanceIndex)
        return target && record ? { ...target, feature: record } : target
      },
    }))
    .views(self => ({
      /** #getter */
      get animating() {
        return self.laneTransitions.size > 0
      },
      /** #getter */
      get laneFetches(): {
        state: LaneFetchState<HeldLane>
        specs: LaneFetchSpec[]
      }[] {
        return [
          { state: self.laneGenes, specs: self.laneGenesFetchSpecs },
          { state: self.laneLinks, specs: self.laneLinksFetchSpecs },
          { state: self.laneGroups, specs: self.laneGroupsFetchSpecs },
          { state: self.laneLayerData, specs: self.laneLayersFetchSpecs },
        ]
      },
      /** #getter */
      get awaitingDependentData(): boolean {
        const anchor = self.anchorAssemblyName
        const describing = self.lanesBeingDescribed.size > 0
        return this.laneFetches.some(({ state, specs }) =>
          laneFetchAwaits(state, specs, anchor, describing),
        )
      },
      /** #getter */
      get dataSuperseded(): boolean {
        return (
          this.laneFetches.some(
            ({ state, specs }) => staleLaneSpecs(specs, state).length > 0,
          ) ||
          self.lanesBeingDescribed.size > 0 ||
          self.lodTier !== self.liveLodTier ||
          this.animating
        )
      },
      /** #getter */
      get hoveredFeature() {
        return self.hoverTarget?.feature
      },
    }))
    .actions(self => ({
      /** #action */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), { feature })
      },
      /** #action */
      openInNewView(assemblyName: string, loc: string) {
        const session = getSession(self)
        const described = self.laneAssemblyConfs.get(assemblyName)
        if (described) {
          self.releasedLanes = new Set([...self.releasedLanes, assemblyName])
          session.removeTemporaryAssembly?.(String(described.name))
        }
        const genes = self.laneGeneTracks.get(assemblyName)
        openAssemblyInLinearView({
          session,
          id: `${self.id}-mate-${assemblyName}`,
          assemblyName,
          loc,
          tracks: [
            self.parentTrack.configuration.trackId,
            ...(genes ? [readConfObject(genes, 'trackId') as string] : []),
          ],
        }).catch((e: unknown) => {
          session.notifyError(`${e}`, e)
        })
      },
      /** #action */
      reanchor(assemblyName: string, loc: string) {
        const session = getSession(self)
        const view = self.lgv
        const outgoing = self.anchorAssemblyName
        const restore = captureStackViewports([view])
        view
          .navToLocString(loc, assemblyName)
          .then(landed => {
            if (landed) {
              self.showLane(outgoing)
              session.notify(`Re-anchored on ${assemblyName}`, 'info', {
                name: 'Undo',
                onClick: () => {
                  restore()
                },
              })
            }
          })
          .catch((e: unknown) => {
            session.notifyError(`${e}`, e)
          })
      },
      /** #action */
      setHoverTarget(target: HoverTarget | undefined) {
        self.hoverTarget = target
      },
      /** #action */
      startRenderingBackend(backend: MultiWayRenderingBackend) {
        installUpload(self, backend, {
          cells: () => self.renderCells,
          render: b => {
            b.renderBlocks(
              self.renderBlocks,
              self.renderCells,
              self.renderState,
            )
            return self.features !== undefined
          },
        })
      },
    }))
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /** #method */
        trackMenuItems(): MenuItem[] {
          const view = self.lgv
          const items = [
            ...superMenuItems(),
            ...multiWayTrackMenuItems(self),
            ...editPlotMenuItems(self),
            ...lodMenuItems(self),
          ]
          for (const item of syntenyRegionMenuItems({
            label: 'Linear synteny view (visible region)',
            region: widestRegion(view.dynamicBlocks.contentBlocks),
            session: getSession(self),
            openTracks: [self.parentTrack.configuration],
            anchorTracks: anchorPanelTracks(view.tracks),
            sourceView: containingPanelStack(view) ?? view,
            discoverMatesFor: (_trackId, region) => async () =>
              lanePanelsForRegion({
                groups: self.groups,
                rowAssemblies: self.rowAssemblies,
                laneDecisions: self.laneDecisions,
                region,
                anchorCanon: refName =>
                  self.anchorAssembly?.getCanonicalRefName2(refName) ?? refName,
                trackAssemblyNames: getTrackAssemblyNames(self.parentTrack),
              }),
            starAnchor: self.starAnchor,
          })) {
            pushLaunchViewMenuItem(items, item)
          }
          return items
        },
      }
    })
    .actions(self => ({
      /** #action */
      setPointer(state?: MouseState) {
        self.setHoverTarget(
          state && !self.isLoadingOrCanceled
            ? self.hitTest(state.x, state.y)
            : undefined,
        )
      },
      /** #action */
      clearHoveredFeature() {
        self.setHoverTarget(undefined)
      },
      /** #action */
      selectHovered() {
        const { hoverTarget } = self
        self.clickedTarget = hoverTarget && {
          groupKey: hoverTarget.groupKey,
          linkId: hoverTarget.linkId,
        }
        if (hoverTarget) {
          self.selectFeature(hoverTarget.feature)
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        runLazyAfterAttach(
          self as MultiWaySyntenyDisplayModel,
          async () => (await import('./afterAttach.ts')).doAfterAttach,
        )
      },
      /** #action */
      async renderSvg(
        opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderMultiWaySvg } = await import('./renderSvg.tsx')
        return renderMultiWaySvg(self as MultiWaySyntenyDisplayModel, opts)
      },
    }))
}

export type MultiWaySyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface MultiWaySyntenyDisplayModel extends Instance<MultiWaySyntenyDisplayStateModel> {}
