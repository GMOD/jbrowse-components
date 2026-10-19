import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  BaseDisplay,
  preprocessTrackConfigSnapshot,
} from '@jbrowse/core/pluggableElementTypes'
import { legendIsReadable, pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { colorScaleIsEmpty } from '@jbrowse/core/ui/colorScale'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
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
import { withImpliedField } from '@jbrowse/core/util/colorScale'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import { measureText } from '@jbrowse/core/util/measureText'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  toTrackConfigEntry,
  getTrackAssemblyNames,
  isSameAssemblyName,
  openAssemblyInLinearView,
} from '@jbrowse/core/util/tracks'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorFieldOf,
  colorForField,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { isAlive, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'
import { FEATURE_NAME_FIELD, getFeatureName } from '@jbrowse/plugin-canvas'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  markColorOf,
  paintScalesOver,
  stepChannels,
} from '@jbrowse/plugin-marks'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { sharedBackendKey } from '@jbrowse/render-core/sharedBackendKey'
import {
  PRESET_ATTRIBUTES,
  bandGroundColor,
  bandInk,
  bandPalette,
  colorableColumns,
  declaredAttributes,
  declaredLanesOf,
  featureAttributeRanges,
  lodMenuItems,
  lodTierAt,
  LodTierInfoMixin,
  orderAttributeLabels,
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
import {
  axisPlacement,
  axisSpan,
  axisSpans,
  axisTickXs,
  displayedRegionSpans,
} from './anchorAxis.ts'
import LaneSelectionDialog from './components/LaneSelectionDialog.tsx'
import { configSlotActions, configSlotViews } from './configSlotViews.ts'
import { dealGeneColors, geneColors } from './geneColor.ts'
import { laneGeneTracksOf } from './laneAnnotation.ts'
import {
  decideLaneFrames,
  frameFromDecision,
  nudgeDecision,
} from './laneDecision.ts'
import {
  landLaneFetch,
  laneFetchAwaits,
  laneGenesFetchSpecsOf,
  laneGroupsFetchSpecsOf,
  laneLinksFetchSpecsOf,
  starAnchorOf,
  staleLaneSpecs,
} from './laneFetch.ts'
import { LABEL_FONT_SIZE, laneHeaderRows } from './laneHeader.ts'
import { releaseLaneAssembly } from './laneHolders.ts'
import { GENE_LABEL_FONT_PX, placeLaneLabels } from './laneLabels.ts'
import {
  LANE_TEMPLATE_MAX_BP,
  coloredLaneLayer,
  laneLayerCellsOf,
  laneLayerDomains,
  laneLayerPlacementsOf,
  laneLayerReadsOf,
  laneLayerSourcesOf,
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
  laneUniverseOf,
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'
import {
  buildLanes,
  gutterNearViewport,
  laneGeometry,
  stackReach,
} from './laneStack.ts'
import { laneTrackIds } from './laneTrackPattern.ts'
import {
  anchorlessGroupsOf,
  clipGroupToAnchor,
  groupFeatures,
  laneFetchRegion,
  laneFetchRegionMaxBp,
  laneIndelsOf,
  laneTemplateRegion,
  mergeContiguousRegions,
  rowAssembliesOf,
  tickIntervalFor,
} from './layoutMultiWay.ts'
import {
  laneColorKey,
  laneFieldKey,
  ribbonColorScales,
  stackGeneKey,
} from './legend.ts'
import { multiWayTrackMenuItems } from './menus.ts'
import {
  BANDS_KEY,
  boxesKey,
  buildBandCell,
  buildLaneCells,
  buildRibbonGeometry,
  buildTickGeometry,
  anchorRuleY,
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
import { RIBBON_IMPLIED_FIELD } from './ribbonColorConfigSchema.ts'
import {
  laneFetchesFor,
  rowsReadAgainstAnchor,
  stacksByStructure,
} from './sourceShape.ts'
import { laneProfiles, structureOrder } from './structureOrder.ts'

import type { SyntenyRenderState } from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { WindowDeletion } from './MultiWayGetFeatures.ts'
import type { AlignmentOpsById, LaneLinks } from './alignmentOps.ts'
import type { AxisPlacement } from './anchorAxis.ts'
import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { GeneColors } from './geneColor.ts'
import type { LaneGene } from './geneGlyph.ts'
import type {
  AnchorCoord,
  FrozenLanes,
  LaneDecision,
  LaneFlipPin,
  LanePin,
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
import type { LaneChoice } from './laneSelection.ts'
import type { Lane, LaneStack } from './laneStack.ts'
import type {
  FetchRegion,
  PlacedGroup,
  RowFrame,
  Span,
} from './layoutMultiWay.ts'
import type {
  AnchorRule,
  LaneGlyphColors,
  TickGeometry,
} from './multiwayGeometry.ts'
import type {
  GlyphHit,
  LaneMap,
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  RibbonRef,
} from './multiwayRenderTypes.ts'
import type { AssemblyDescription } from '@jbrowse/core/PluginManager'
import type {
  AnyTrackConfig,
  TrackConfigEntry,
} from '@jbrowse/core/configuration'
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
  SyntenyColorSnapshot,
} from '@jbrowse/synteny-core'
import type React from 'react'

export interface HoverTarget extends RibbonRef {
  label: string
  feature: Feature
}

interface MultiWayVolatiles {
  fetchedFeatures:
    | {
        anchor: string
        features: Feature[]
        ops: AlignmentOpsById
        lanes?: string[]
        deletions: readonly WindowDeletion[]
      }
    | undefined
  seenAttributeRanges: Record<string, AttributeRange>
  laneGenes: LaneFetchState<HeldLaneGenes>
  laneDescriptions: Map<string, AssemblyDescription>
  describedLanes: Set<string>
  lanesBeingDescribed: Set<string>
  releasedLanes: Set<string>
  laneLinks: LaneFetchState<HeldLaneLinks>
  laneGroups: LaneFetchState<HeldLaneGroups>
  laneLayerData: LaneFetchState<HeldLaneLayer>
  hoverTarget: HoverTarget | undefined
  clickedTarget: RibbonRef | undefined
  laneDecisions: Map<string, LaneDecision | undefined>
  renderOriginPx: number
  laneTransitions: Map<string, LaneTransition>
  laneMotionClockMs: number
  laneMotionHalfway: ReadonlySet<string>
  laneDragPx: ReadonlyMap<string, number>
  heldLaneOrder: HeldLaneOrder | undefined
}

/**
 * The structure order haplotype lanes read off a graph stack by while no
 * order is pinned, worked out once per window and lane selection so a pan
 * never reshuffles it
 */
interface HeldLaneOrder {
  anchor: string
  window: FetchRegion[]
  drawn: string[]
  lanes: string[]
}

const NO_GENES: LaneGene[] = []

/** `record` with `key` set to `value`, or dropped for undefined; empty is undefined */
function withEntry<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
  value: T | undefined,
) {
  const { [key]: _dropped, ...rest } = record ?? {}
  const next = value === undefined ? rest : { ...rest, [key]: value }
  return Object.keys(next).length > 0 ? next : undefined
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
 * Draws a multi-genome ortholog track as one lane per assembly inside a linear
 * genome view, with ribbons joining each gene's placements between adjacent
 * lanes.
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
      ColorWritesMixin(),
      LodTierInfoMixin(),
      types.model({
        /** #property */
        type: types.literal('MultiWaySyntenyDisplay'),
        /** #property */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * the lanes a reader hid from the lane menu, by assembly name; the
         * lanes chosen are `rows.kept`
         */
        hiddenLaneNames: types.frozen<readonly string[] | undefined>(),
        /** #property */
        frozenLanes: types.frozen<FrozenLanes | undefined>(),
        /**
         * #property
         * the contig, or a block on it, a reader pinned each lane to, by lane
         */
        lanePins: types.frozen<Readonly<Record<string, LanePin>> | undefined>(),
        /**
         * #property
         * each lane's pinned orientation, under the anchor it was set against,
         * since a flip is stated against the anchor's order
         */
        laneFlipPins: types.frozen<
          | Readonly<Record<string, Readonly<Record<string, LaneFlipPin>>>>
          | undefined
        >(),
      }),
    )
    .volatile((): MultiWayVolatiles => ({
      /** #volatile */
      fetchedFeatures: undefined,
      /** #volatile */
      seenAttributeRanges: {},
      /** #volatile */
      laneGenes: {},
      /** #volatile */
      laneDescriptions: new Map(),
      /** #volatile */
      describedLanes: new Set(),
      /** #volatile */
      lanesBeingDescribed: new Set(),
      /** #volatile */
      releasedLanes: new Set(),
      /**
       * #volatile
       * per adjacent mate-lane pair, at the lanes' own coordinates
       */
      laneLinks: {},
      /**
       * #volatile
       * per mate lane, a gene table's rows on the lane's own window
       */
      laneGroups: {},
      /** #volatile */
      laneLayerData: {},
      /** #volatile */
      hoverTarget: undefined,
      /** #volatile */
      clickedTarget: undefined,
      /** #volatile */
      laneDecisions: new Map(),
      /**
       * #volatile
       * the view's `offsetPx` the stack was last laid out against
       */
      renderOriginPx: 0,
      /** #volatile */
      laneTransitions: new Map(),
      /** #volatile */
      laneMotionClockMs: 0,
      /**
       * #volatile
       * the structure order graph haplotype lanes stack by while nothing pins
       * one, with the window and lane selection it was worked out on
       */
      heldLaneOrder: undefined,
      /** #volatile */
      laneMotionHalfway: new Set(),
      /** #volatile */
      laneDragPx: new Map(),
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
          deletions: readonly WindowDeletion[] = [],
        ) {
          self.fetchedFeatures = { anchor, features, ops, lanes, deletions }
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
          self.laneLinks = landLaneFetch(
            self.laneLinks,
            fetched,
            specs,
            anchor,
            true,
          )
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
         * writes `rows.kept`; undefined restores `configuredLanes`, or every
         * lane
         */
        setSelectedLanes(names: readonly string[] | undefined) {
          setConf(self, ['rows', 'kept'], names ?? [])
          self.hiddenLaneNames = undefined
        },
        /** #action */
        setRibbonColorField(field: string) {
          setConf(
            self,
            'ribbonColor',
            colorForField(
              withImpliedField(ribbonColorSetting(), RIBBON_IMPLIED_FIELD),
              field,
            ),
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
      }
    })
    .actions(configSlotActions)
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
      /**
       * #getter
       * the deletions a record states across the whole fetched window, for a
       * lane the window shows none of
       */
      get windowDeletions(): readonly WindowDeletion[] {
        return (this.features && self.fetchedFeatures?.deletions) ?? []
      },
      /** #getter */
      get hoveredGroupKey() {
        return self.hoverTarget?.groupKey
      },
    }))
    .views(configSlotViews)
    .views(self => ({
      /** #getter */
      get hasLodCapableAdapter() {
        return trackHasLodTiers(self.parentTrack)
      },
      /**
       * #getter
       * read off the settled zoom, so a passing gesture refetches nothing
       */
      get lodTier() {
        return lodTierAt(self, self.host.coarseBpPerPx, self.lodMode)
      },
      /** #getter */
      get liveLodTier() {
        return lodTierAt(self, self.lgv.bpPerPx, self.lodMode)
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
       * each lane's holes and stated changes against the anchor, read off
       * every fetched group rather than the viewport's, so one appears once
       * both its pieces arrive and not as the second scrolls in
       */
      get laneIndels() {
        return laneIndelsOf(this.groups)
      },
      /**
       * #getter
       * each lane's holes, one per deletion `laneIndels` opens
       */
      get laneOpenings() {
        return this.laneIndels.openings
      },
      /**
       * #getter
       * each lane's inversions, which its frame draws mirrored in place
       */
      get laneTurns() {
        return this.laneIndels.turns
      },
      /**
       * #getter
       * each lane's deletions, insertions and inversions as its records state
       * them, for the header
       */
      get laneChanges() {
        return this.laneIndels.changes
      },
      /** #getter */
      get ribbonColorAttributes(): string[] {
        return colorableColumns(declaredAttributes(self.adapterConfig))
      },
      /** #getter */
      get ribbonAttributeRanges(): Record<string, AttributeRange> {
        return orderAttributeLabels(
          self.seenAttributeRanges,
          self.ribbonColorDomain,
          getConf(self, ['ribbonColor', 'range']),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The slots a categorical gene color deals its values into.
       */
      get geneColorSlots() {
        return heldColorSlots(self, self.geneColorEncoding)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `geneColorSlots` once every value the boxes and lane genes show is
       * dealt as one batch, so the two take colors apart whichever lands first
       */
      get dealtGeneColorSlots() {
        dealGeneColors(
          self.geneColorEncoding,
          self.geneColorSlots,
          getEnv(self).pluginManager.jexl,
          [
            ...(self.features ?? []),
            ...[...(self.laneGenes.held?.values() ?? [])].flatMap(({ genes }) =>
              genes.map(gene => gene.feature),
            ),
          ],
        )
        return self.geneColorSlots
      },
    }))
    .views(self => {
      const { jexl } = getEnv(self).pluginManager
      // a fresh resolver per data identity and settings, since each memoizes
      // by feature id
      interface Held {
        data: unknown
        settings: string
        colors: GeneColors
      }
      const colorsFor = (prev: Held | undefined, data: unknown): Held => {
        const settings = JSON.stringify(self.geneColorSettings)
        return prev !== undefined &&
          prev.data === data &&
          prev.settings === settings
          ? prev
          : {
              data,
              settings,
              colors: geneColors(
                self.configuration,
                self.geneColorEncoding,
                self.geneColorSettings.utrColor,
                jexl,
                self.dealtGeneColorSlots,
              ),
            }
      }
      let boxes: Held | undefined
      let lanes = new Map<string, Held>()
      return {
        /** #getter */
        get boxColors(): GeneColors {
          boxes = colorsFor(boxes, self.features)
          return boxes.colors
        },
        /** #getter */
        get laneGeneColors(): ReadonlyMap<string, GeneColors> {
          lanes = new Map(
            [...(self.laneGenes.held ?? [])].map(([lane, held]) => [
              lane,
              colorsFor(lanes.get(lane), held),
            ]),
          )
          return new Map([...lanes].map(([lane, { colors }]) => [lane, colors]))
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
       * #getter
       * the adapter answers a window's `lanePairs` in one call
       */
      get adapterBatchesLanePairs(): boolean {
        return self.adapterCapabilities.includes('lanePairBatches')
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
      /**
       * #method
       * `assemblyName` and every alias the session holds it under
       */
      laneSpellings(assemblyName: string) {
        const { assemblyManager } = getSession(self)
        return [
          assemblyName,
          ...((assemblyManager.has(assemblyName) &&
            assemblyManager.get(assemblyName)?.allAliases) ||
            []),
        ]
      },
      /**
       * #getter
       * every session track, connections' included
       */
      get sessionTracksById(): ReadonlyMap<string, AnyTrackConfig> {
        return new Map(
          allSessionTracks(getSession(self)).map(track => [
            track.trackId as string,
            track,
          ]),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * the tracks `entries` names for the lane keyed `key`, best first:
       * plain ids, then `{assembly}` entries, each in entry order
       */
      namedLaneTracks(entries: readonly string[], key: string) {
        const spellings = [...new Set(self.laneSpellings(key))]
        return laneTrackIds(entries, spellings).flatMap(id => {
          const track = self.sessionTracksById.get(id)
          return track &&
            getConfAssemblyNamesOrNone(track).some(
              name => self.laneKey(name) === key,
            )
            ? [track]
            : []
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * a source that names an anchor and answers no lane pairs states each
       * lane against the anchor alone, so each gutter draws its lower lane
       * against the anchor
       */
      get rowsVsAnchor(): boolean {
        return rowsReadAgainstAnchor(self.adapterCapabilities, self.starAnchor)
      },
      /**
       * #getter
       * the fetches beyond the anchor's that its records call for
       */
      get laneFetchKinds() {
        return laneFetchesFor(
          self.features ?? [],
          this.rowsVsAnchor,
          self.starAnchor,
        )
      },
      /** #getter */
      get pinnedLanes(): ReadonlyMap<string, LanePin> {
        return new Map(Object.entries(self.lanePins ?? {}))
      },
      /** #getter */
      get pinnedLaneFlips(): ReadonlyMap<string, LaneFlipPin> {
        return new Map(
          Object.entries(
            self.laneFlipPins?.[self.laneKey(self.anchorAssemblyName)] ?? {},
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `rows.domain` in each placed lane's own spelling, so an order a config
       * wrote with an alias merges with one a drag writes
       */
      get domain(): string[] {
        const spelled = new Map<string, string>()
        for (const group of self.groups) {
          for (const name of group.mates.keys()) {
            const key = self.laneKey(name)
            if (!spelled.has(key)) {
              spelled.set(key, name)
            }
          }
        }
        const written: string[] = getConf(self, ['rows', 'domain'])
        return [
          ...new Set(
            written.map(name => spelled.get(self.laneKey(name)) ?? name),
          ),
        ]
      },
      /**
       * #getter
       * the track's assemblies beside the anchor for a source that declares the
       * lanes itself, empty for every other source
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
        return lanesInForce(self.laneChoice ?? [], self.configuredLanes)
      },
      /** #getter */
      get hiddenLanes(): readonly string[] {
        return self.hiddenLaneNames ?? []
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
        return selection && [...new Set(selection.flatMap(self.laneSpellings))]
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
        const name = self.laneKey(assemblyName)
        return (getSession(self).temporaryAssemblies ?? []).some(
          conf => isObject(conf) && conf.name === name,
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
      /**
       * #getter
       * `rows.labels`, keyed by `laneKey`
       */
      get rowLabels() {
        const labels: Record<string, string> = getConf(self, ['rows', 'labels'])
        return new Map(
          Object.entries(labels).map(([name, label]) => [
            self.laneKey(name),
            label,
          ]),
        )
      },
      /** #method */
      laneLabel(assemblyName: string) {
        const key = self.laneKey(assemblyName)
        return (
          this.rowLabels.get(key) ??
          (this.holdsAssembly(assemblyName)
            ? getSession(self).assemblyManager.getDisplayName(assemblyName)
            : (this.declaredLaneLabels.get(key) ?? assemblyName))
        )
      },
      /**
       * #getter
       * the anchor is never a lane
       */
      get laneUniverse(): LaneChoice[] {
        return laneUniverseOf({
          anchor: self.anchorAssemblyName,
          mateNames: [
            ...self.groups.flatMap(group => [...group.mates.keys()]),
            ...self.windowDeletions.map(d => d.assemblyName),
          ],
          declared: self.declaredLanes ?? [],
          trackAssemblies: getTrackAssemblyNames(self.parentTrack),
          keyOf: self.laneKey,
          labelOf: name => this.laneLabel(name),
          selection: self.laneSelection,
          hidden: self.hiddenLanes,
          featuresLoaded: self.features !== undefined,
          landedLanes: self.features && self.fetchedFeatures?.lanes,
        })
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
        const preferred = [...self.domain, ...(self.heldLaneOrder?.lanes ?? [])]
        return rowAssembliesOf(
          self.groups,
          preferred,
          self.laneKey,
          self.windowDeletions.map(d => d.assemblyName),
        ).filter(assemblyName => drawn.has(self.laneKey(assemblyName)))
      },
      /**
       * #getter
       * the drawn lanes chained by their deletions and insertions against the
       * anchor, for "Order lanes by structure"; empty for a gene table
       */
      get laneStructureOrder(): string[] {
        const { features, featureOps } = self
        const row = this.rowOfLane
        return features && !features.some(isNamedRecord)
          ? structureOrder(laneProfiles(features, featureOps)).flatMap(
              lane => row.get(self.laneKey(lane)) ?? [],
            )
          : []
      },
      /**
       * #getter
       * each drawn lane's row name by its canonical name, for data keyed by
       * the records' spelling of a lane
       */
      get rowOfLane(): ReadonlyMap<string, string> {
        return new Map(this.rowAssemblies.map(r => [self.laneKey(r), r]))
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
      /**
       * #action
       * runs when the anchor fetch for `regions` completes. Haplotype lanes read
       * off a graph stack by structure while no order is pinned, worked out
       * again only once a fetch leaves the window it was worked out on or the
       * lane selection changes, so panning never reshuffles the stack
       */
      holdLaneOrder(regions: FetchRegion[]) {
        const { features, featureOps } = self
        if (
          !features ||
          !stacksByStructure(self.adapterCapabilities, self.laneFetchKinds)
        ) {
          self.heldLaneOrder = undefined
          return
        }
        const anchor = self.laneKey(self.anchorAssemblyName)
        const drawn = (self.laneSelection ?? []).map(self.laneKey).sort()
        const held = self.heldLaneOrder
        const onWindow = regions.some(r =>
          held?.window.some(
            w => w.refName === r.refName && w.start < r.end && r.start < w.end,
          ),
        )
        if (
          held?.anchor === anchor &&
          held.drawn.join('\t') === drawn.join('\t') &&
          onWindow
        ) {
          return
        }
        self.heldLaneOrder = {
          anchor,
          window: regions,
          drawn,
          lanes: structureOrder(laneProfiles(features, featureOps)).map(
            self.laneKey,
          ),
        }
      },
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
        self.hiddenLaneNames = withLaneHidden(
          self.hiddenLanes,
          assemblyName,
          self.laneKey,
        )
      },
      /** #action */
      showLane(assemblyName: string) {
        const { kept, hidden } = withLaneShown(
          {
            kept: self.laneChoice ?? [],
            hidden: self.hiddenLanes,
            configured: self.configuredLanes,
          },
          assemblyName,
          self.laneKey,
        )
        if (kept !== (self.laneChoice ?? [])) {
          setConf(self, ['rows', 'kept'], kept)
        }
        self.hiddenLaneNames = hidden.length ? hidden : undefined
      },
      /** #action */
      showHiddenLanes() {
        self.hiddenLaneNames = undefined
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
      /**
       * #getter
       * every lane's band, the anchor's first
       */
      get stackGeometry() {
        return laneGeometry(
          self.height,
          1 + self.rowAssemblies.length,
          self.splitStrands,
          self.geneLabelPx,
          self.layerPx,
          self.inlineLaneNames,
        )
      },
      /** #getter */
      get scrollContentHeight() {
        return this.stackGeometry.contentHeight
      },
      /**
       * #getter
       * keyed by each lane's own spelling, not by `laneKey`
       */
      get laneGeneTracks() {
        const entries: string[] = getConf(self, 'laneGeneTracks')
        return laneGeneTracksOf({
          lanes: [self.anchorAssemblyName, ...self.rowAssemblies],
          keyOf: self.laneKey,
          tracks: self.sessionTracksById.values(),
          namedTracks: key => self.namedLaneTracks(entries, key),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each lane's gene track config as a hydrated track reads it, so a
       * frozen entry's `displayDefaults` and retired display types count
       */
      get laneGeneTrackEntries() {
        const { pluginManager } = getEnv(self)
        const out = new Map<string, TrackConfigEntry>()
        for (const [lane, track] of self.laneGeneTracks) {
          const entry = toTrackConfigEntry(track)
          try {
            out.set(
              lane,
              isStateTreeNode(track)
                ? entry
                : (preprocessTrackConfigSnapshot(
                    pluginManager,
                    entry,
                  ) as TrackConfigEntry),
            )
          } catch {
            out.set(lane, entry)
          }
        }
        return out
      },
      /** #getter */
      get laneGeneAdapters() {
        const out = new Map<string, Record<string, unknown>>()
        for (const [lane, track] of self.laneGeneTracks) {
          out.set(
            lane,
            toTrackConfigEntry(track).adapter as Record<string, unknown>,
          )
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
              self.laneTurns(assemblyName, decision.refName),
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
       * in the px space anchored at `origin`; a lane in `frozen` keeps its frozen
       * decision
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
          pinned: self.pinnedLanes,
          pinnedFlips: self.pinnedLaneFlips,
          openingsOf: self.laneOpenings,
          turnsOf: self.laneTurns,
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
      function setFlipPin(assemblyName: string, pin: LaneFlipPin | undefined) {
        const anchor = self.laneKey(self.anchorAssemblyName)
        self.laneFlipPins = withEntry(
          self.laneFlipPins,
          anchor,
          withEntry(self.laneFlipPins?.[anchor], assemblyName, pin),
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
            self.laneTurns(assemblyName, base.refName),
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
         * a contig, or a block on it; `undefined` lets the lane choose again
         */
        pinLane(assemblyName: string, pin: LanePin | undefined) {
          self.lanePins = withEntry(self.lanePins, assemblyName, pin)
          realign(assemblyName)
        },
        /** #action */
        flipLane(assemblyName: string) {
          const decision = self.laneDecisions.get(assemblyName)
          if (decision) {
            setFlipPin(assemblyName, {
              refName: decision.refName,
              flipped: !decision.flipped,
            })
            realign(assemblyName)
          }
        },
        /** #action */
        unpinLaneFlip(assemblyName: string) {
          setFlipPin(assemblyName, undefined)
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
            templateRegions:
              laneFetchRegionMaxBp(self.visibleBpSpan) > LANE_TEMPLATE_MAX_BP
                ? undefined
                : regions,
            bpPerPx: self.lgv.bpPerPx,
          })
        }
        for (const [assemblyName, frame] of self.rowFrames) {
          if (frame && self.holdsAssembly(assemblyName)) {
            const template = laneTemplateRegion(frame, LANE_TEMPLATE_MAX_BP)
            out.set(assemblyName, {
              regions: [{ assemblyName, ...laneFetchRegion(frame) }],
              templateRegions: template && [{ assemblyName, ...template }],
              bpPerPx: (frame.max - frame.min) / self.canvasWidth,
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
        return laneGenesFetchSpecsOf({
          windows: self.laneWindows,
          adapters: self.laneGeneAdapters,
          tracks: self.laneGeneTrackEntries,
        })
      },
      /**
       * #getter
       * a gene table read on each mate lane's window, for the rows the anchor
       * lacks; a star source indexes its anchor alone, so it has none to give
       */
      get laneGroupsFetchSpecs(): LaneGroupsFetchSpec[] {
        return self.laneFetchKinds.laneRows
          ? laneGroupsFetchSpecsOf(
              self.rowAssemblies,
              self.laneWindows,
              self.lodTier,
            )
          : []
      },
      /**
       * #getter
       * one spec per adjacent mate-lane pair whose gutter is on screen or
       * within a screen of it
       */
      get laneLinksFetchSpecs(): LaneLinksFetchSpec[] {
        return self.laneFetchKinds.lanePairs
          ? laneLinksFetchSpecsOf({
              pairs: self.lanePairs,
              windows: self.laneWindows,
              rowFrames: self.rowFrames,
              anchor: self.anchorAssemblyName,
              onAnchor: self.adapterPairsOnAnchor,
              lodTier: self.lodTier,
              nearViewport: gutterNearViewport(
                self.stackGeometry,
                self.scrollTop,
                self.height,
              ),
            })
          : []
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
        return laneLayerSourcesOf({
          lanes: [self.anchorAssemblyName, ...self.rowAssemblies],
          trackFor: (layer, lane) =>
            self.namedLaneTracks(
              self.configuration.laneLayers[layer]!.tracks,
              self.laneKey(lane),
            )[0],
          templates: self.laneLayerTemplates,
        })
      },
      /**
       * #getter
       * `pastCap` flags a layer that skipped a lane past `LANE_TEMPLATE_MAX_BP`
       */
      get laneLayerReads() {
        return laneLayerReadsOf({
          layers: self.configuration.laneLayers,
          sources: this.laneLayerSources,
          windows: self.laneWindows,
        })
      },
      /** #getter */
      get laneLayersFetchSpecs(): LaneLayerFetchSpec[] {
        return this.laneLayerReads.specs
      },
      /**
       * #getter
       * has no lane genes, so a gene commit re-uploads no ribbon or tick
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
          axisSpanOf: (refName, start, end) =>
            axisSpan(view, refName, start, end, self.renderOriginPx),
          axisSpansOf: (refName, start, end) =>
            axisSpans(view, refName, start, end, self.renderOriginPx),
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
          geometry: self.stackGeometry,
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
        return laneHeaderRows(
          lanes,
          self.visibleBpSpan,
          self.anchorLocString,
          self.inlineLaneNames ? self.laneStack.glyphHeight : undefined,
          self.rowsVsAnchor ? self.anchorAssemblyName : undefined,
          self.laneChanges,
          assemblyName => {
            const key = self.laneKey(assemblyName)
            const spanning = self.windowDeletions.filter(
              d => self.laneKey(d.assemblyName) === key,
            )
            return spanning.length
              ? Math.max(...spanning.map(d => d.bp))
              : undefined
          },
        )
      },
      /**
       * #getter
       * the alignments the source answered for each adjacent mate-lane pair,
       * keyed `upper|lower`; a pair it has not answered draws nothing
       */
      get pairLinks(): ReadonlyMap<string, LaneLinks> {
        const out = new Map<string, LaneLinks>()
        for (const { key } of self.lanePairs) {
          const fetched = self.laneLinks.held?.get(key)
          if (fetched !== undefined && fetched.links.length > 0) {
            out.set(key, fetched)
          }
        }
        return out
      },
      /**
       * #getter
       * the centre, in stack px, of each gutter whose lane pair was asked for
       * and has not landed
       */
      get loadingGutterYs(): number[] {
        const { lanes, glyphHeight } = self.laneStack
        const pending = new Set(
          staleLaneSpecs(self.laneLinksFetchSpecs, self.laneLinks).map(
            spec => spec.lane,
          ),
        )
        return self.lanePairs.flatMap(({ key }, i) => {
          const upper = lanes[i + 1]
          const lower = lanes[i + 2]
          return pending.has(key) && upper && lower
            ? [(upper.glyphTop + glyphHeight + lower.layerTop) / 2]
            : []
        })
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
          paint: self.ribbonPaint,
          drawCurves: self.drawCurves,
          bridgeSkippedLanes: self.bridgeSkippedLanes,
          rowsVsAnchor: self.rowsVsAnchor,
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
            ...self.stackGeometry,
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
    .views(self => ({
      /**
       * #getter
       * px of the anchor's ticks across the displayed regions, over the reach
       * the anchor's rule draws
       */
      get anchorTickXs(): number[] {
        const step = self.tickIntervalBp
        return self.lgv.initialized && step > 0
          ? axisTickXs(
              self.lgv,
              step,
              stackReach(self.canvasWidth),
              self.renderOriginPx,
            )
          : []
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
        rule: AnchorRule | undefined
      }[] = []
      return {
        /**
         * #getter
         * boxes before glyphs, so an in-order hit test finds a box over a gene
         */
        get laneCells() {
          const { laneGeneColors, boxColors } = self
          const laneGenes = self.laneGenes.held
          const { lanes, glyphHeight, bandHeight } = self.laneStack
          const ink = bandInk()
          const anchorLane = self.rowsVsAnchor ? lanes[0] : undefined
          held = lanes.map((lane, row) => {
            const rule =
              anchorLane && row > 0 && row + 1 < lanes.length
                ? {
                    y: anchorRuleY(lane, bandHeight),
                    spans: anchorLane.baseline,
                    ticks: self.anchorTickXs,
                  }
                : undefined
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
              prev.rule?.spans === rule?.spans &&
              prev.rule?.ticks === rule?.ticks &&
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
              anchorRule: rule,
            })
            return {
              lane,
              rule,
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
       * keys every lane, over the settled window, or the anchor lane alone
       * where every lane's values would overflow the key
       */
      get geneColorScales(): ColorScale[] {
        const hitsByRow = self.laneStack.lanes.map((_lane, row) =>
          [boxesKey(row), glyphsKey(row)].flatMap(key => {
            const cell = self.laneGlyphCells.get(key)
            return cell?.kind === 'glyphs' ? cell.data.hits : []
          }),
        )
        const onScreen: Span = [0, self.canvasWidth]
        const encoding = self.geneColorEncoding
        const { title } = self.geneColorSettings.color
        const field = colorFieldOf(encoding, self.geneColorSlots)
        const keyOf = (hits: GlyphHit[]): ColorScale[] => {
          if (field) {
            return laneFieldKey(
              hits,
              onScreen,
              field,
              title ??
                (field.field === FEATURE_NAME_FIELD ? 'Gene name' : undefined),
            )
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
        }
        return stackGeneKey(hitsByRow, keyOf)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Color by's Default: no field and no constant, so the config's own
       * color paints, a `jexl:` expression included
       */
      pickDefaultGeneColor() {
        if (self.geneSolidColor === undefined) {
          self.colorByField('')
        } else {
          self.setColorValue(undefined)
        }
      },
      /**
       * #action
       * Color by's Solid color...: paints the constant kept beside a field,
       * where there is one, and opens the picker
       */
      pickGeneSolidColor() {
        if (self.geneColorField !== '' && self.geneSolidColor !== undefined) {
          self.colorByField('')
        }
        getSession(self).queueDialog(handleClose => [
          SolidColorDialog,
          {
            label: 'Gene color',
            color: self.geneSolidColor ?? featureDefaultColor,
            written: self.geneColorSettings.color.value,
            onChange: (color: string) => {
              self.setColorValue(color)
            },
            onReset: () => {
              self.setColorValue(undefined)
            },
            handleClose,
          },
        ])
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
              descending: getConf(self, ['ribbonColor', 'descending']),
              paint: self.ribbonPaint,
              against: self.rowsVsAnchor ? self.anchorAssemblyName : undefined,
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
        return laneLayerPlacementsOf({
          lanes: self.laneStack.lanes,
          heights: self.laneLayerHeights,
          held: self.laneLayerData.held,
          axisSpanOf: (refName, start, end) =>
            axisSpan(view, refName, start, end, self.renderOriginPx),
          canvasWidth: self.canvasWidth,
        })
      },
    }))
    .views(self => {
      // a fresh array per read would recolor every held payload on each read
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
         * where each lane layer's marks take their color from, one per mark,
         * read the way the mark display reads its colors
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
         * a held payload's layers, each colored as its mark declares
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
       * the selected feature's glyph hits per row, which a pan leaves alone
       */
      get selectedGlyphHits() {
        const id = self.selectedFeatureId
        return id === undefined
          ? []
          : self.laneStack.lanes.map((_lane, row) =>
              [boxesKey(row), glyphsKey(row)].flatMap(key => {
                const cell = self.laneGlyphCells.get(key)
                return cell?.kind === 'glyphs'
                  ? cell.data.hits.filter(hit => hit.feature.id() === id)
                  : []
              }),
            )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the ramp or threshold each lane layer's bars paint numbers through,
       * one per mark and undefined for a mark colored another way; a ramp's
       * domain covers the values of every drawn lane, as `laneLayerDomains`
       * does for y, so one value takes one color in all of them
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
        return laneLayerCellsOf({
          placements: self.laneLayerPlacements,
          domains: self.laneLayerDomains,
          colorScales: this.laneLayerColorScales,
          coloredLayersOf: held => self.coloredLayersOf(held),
        })
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
        const { dragOffsetPx, scrollTop } = self
        return self.selectedGlyphHits.flatMap((hits, row) => {
          const map = laneMapOf(self, row)
          return hits.map(hit =>
            drawnRect(
              map,
              [hit.x1, hit.x2],
              dragOffsetPx,
              hit.y1 - scrollTop,
              hit.y2 - hit.y1,
            ),
          )
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
          releaseLaneAssembly(self, String(described.name))
        }
        const genes = self.laneGeneTracks.get(assemblyName)
        openAssemblyInLinearView({
          session,
          id: `${self.id}-mate-${assemblyName}`,
          assemblyName,
          loc,
          tracks: [
            self.parentTrack.configuration.trackId,
            ...(genes ? [genes.trackId as string] : []),
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
