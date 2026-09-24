import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { legendIsReadable, pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { colorScaleIsEmpty } from '@jbrowse/core/ui/colorScale'
import {
  animationAllowed,
  doesIntersect2,
  getSession,
  isFeature,
  morphClockMs,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import {
  allSessionTracks,
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
} from '@jbrowse/display-kit/colorConfigSchema'
import { getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { sharedBackendKey } from '@jbrowse/render-core/sharedBackendKey'
import {
  PRESET_ATTRIBUTES,
  bandGroundColor,
  bandInk,
  colorableColumns,
  declaredAttributes,
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
import { axisPlacement, axisSpan, displayedRegionSpans } from './anchorAxis.ts'
import LaneSelectionDialog from './components/LaneSelectionDialog.tsx'
import { composeLaneLinks } from './composeLaneLinks.ts'
import { geneColors } from './geneColor.ts'
import { annotationRank } from './laneAnnotation.ts'
import { frameFromDecision } from './laneDecision.ts'
import { specsCoverMate, staleLaneSpecs } from './laneFetch.ts'
import { laneHeaderRows } from './laneHeader.ts'
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
import { buildLanes, laneContentHeight, laneGeometry } from './laneStack.ts'
import {
  clipGroupToAnchor,
  groupFeatures,
  laneFetchRegion,
  mergeContiguousRegions,
  rowAssembliesOf,
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
  ribbonParams,
} from './multiwayRenderTypes.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { AxisPlacement } from './anchorAxis.ts'
import type { LanePlacementRecord } from './composeLaneLinks.ts'
import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { GeneColorSettings, GeneColors } from './geneColor.ts'
import type { AnchorCoord, LaneDecision, LaneFlipPin } from './laneDecision.ts'
import type {
  HeldLaneGenes,
  HeldLaneLinks,
  LaneGenesFetchSpec,
  LaneLinksFetchSpec,
  LaneRegion,
} from './laneFetch.ts'
import type { LaneTransition } from './laneMotion.ts'
import type { LaneChoice, LaneFilter } from './laneSelection.ts'
import type { Lane, LaneStack } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { LaneGlyphColors, TickGeometry } from './multiwayGeometry.ts'
import type {
  LaneMap,
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  RibbonRef,
} from './multiwayRenderTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem, MouseState } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { ColorScaleName } from '@jbrowse/display-kit/colorConfigSchema'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  AttributeRange,
  DeclaredLane,
  LodMode,
  SyntenyColorSnapshot,
} from '@jbrowse/synteny-core'
import type React from 'react'

/** what the pointer is over: a gene, a placement box or a ribbon */
export interface HoverTarget extends RibbonRef {
  label: string
  feature: Feature
}

const NO_FLIP_PINS: ReadonlyMap<string, LaneFlipPin> = new Map()

function regionKey(r: LaneRegion) {
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

/**
 * #stateModel MultiWaySyntenyDisplay
 * #displayFoundation GlobalFetchMixin
 * draws a multi-genome ortholog track (an adapter whose features carry a
 * `mate` per other assembly, e.g. MCScanBlocksAdapter) as one lane per
 * assembly inside a plain linear genome view. The top lane is the view's own
 * assembly at genomic coordinates; every other lane is laid out in its own
 * local coordinate frame fitted to the viewport — non-anchored, the same move
 * the multi-sample variant matrix makes — with ribbons connecting each gene's
 * placements between adjacent lanes. The ribbons ride the pairwise synteny
 * display's GPU passes and the lanes the feature track's, with Canvas2D and
 * the SVG export drawing the same cells.
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
        /**
         * #property
         */
        type: types.literal('MultiWaySyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * the reader's lanes, by assembly name: `only` the ones the picker
         * ticked, or the lanes in force `except` the ones Hide lane took out.
         * Undefined is `configuredLanes`, or every lane where there are none.
         * Session state rather than adapter config: a choice made in front of
         * this picture, which a shared session carries
         */
        laneFilter: types.frozen<LaneFilter | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * the ortholog fetch's answer beside the anchor assembly it asked for
       */
      fetchedFeatures: undefined as
        | { anchor: string; features: Feature[] }
        | undefined,
      /**
       * #volatile
       * per ribbon channel, the span or labels every fetch since the ribbon
       * mode was picked has carried, labels in first-seen order; see
       * `ribbonAttributeRanges`
       */
      seenAttributeRanges: {} as Record<string, AttributeRange>,
      /**
       * #volatile
       * per lane, the gene models fetched from that assembly's own gene track,
       * so a lane draws real exon structure at that genome's coordinates, and
       * the region key they were fetched under — the lane fetch's committed
       * stamp, which its gate compares and `dataSuperseded` reads per lane.
       * Merged a lane at a time: a pan that moves one lane's quantized window
       * refetches that lane and leaves the others' genes as they were
       */
      laneGenes: undefined as Map<string, HeldLaneGenes> | undefined,
      /**
       * #volatile
       * the anchor assembly under which a lane-gene commit has covered a MATE
       * lane. The anchor's spec exists as soon as the view does, so the first
       * commit can be the anchor alone, before the ortholog fetch has given
       * any mate a frame; the lanes' first real filling is the commit after
       * that, and it is the one a capture has to wait for. Keyed by anchor so
       * a re-anchor onto another genome waits again
       */
      laneGenesCoverMatesFor: undefined as string | undefined,
      /**
       * #volatile
       * alignments between ADJACENT mate lanes, fetched per pair from the same
       * track when the source is an alignment file naming no star anchor — the
       * direct records the file holds for that pair, at the lanes' own
       * coordinates — each beside the region key it was fetched under, merged
       * per pair
       */
      laneLinks: undefined as Map<string, HeldLaneLinks> | undefined,
      /**
       * #volatile
       * the anchor assembly under which lane links last landed, so a
       * re-anchor onto another genome waits for its pairs again, as
       * `laneGenesCoverMatesFor` does for the genes
       */
      laneLinksLandedFor: undefined as string | undefined,
      /**
       * #volatile
       * the lanes the source's header declares, read once with the tier info;
       * undefined until the header lands or when the adapter is one whose
       * header is never asked for
       */
      declaredLanes: undefined as DeclaredLane[] | undefined,
      /**
       * #volatile
       * the anchor a star source announces in its header. A star of pairwise
       * alignments holds no mate-vs-mate rows, so its adjacent pairs' links
       * are composed through the anchor rather than asked for
       */
      starAnchor: undefined as string | undefined,
      /**
       * #volatile
       * the glyph, box or ribbon under the pointer — what a click opens and
       * the tooltip names
       */
      hoverTarget: undefined as HoverTarget | undefined,
      /**
       * #volatile
       * clicked twin of the hover: the group or direct-link ribbon whose
       * outline stays after the pointer leaves it, until a click on empty
       * canvas. Held by key, so it outlives every relayout and refetch that
       * still draws its ribbon — the click's own widget resizes the view
       */
      clickedTarget: undefined as RibbonRef | undefined,
      /**
       * #volatile
       * what the last settle decided per mate lane — contig, orientation,
       * rung and where the lane is pinned to the anchor. Made once per
       * settled block set by the installer in afterAttach, holding each
       * choice until the evidence clearly moves; the frames the lanes draw in
       * are derived from these against the live view
       */
      laneDecisions: new Map<string, LaneDecision | undefined>(),
      /**
       * #volatile
       * the contig the reader pinned a lane onto from its header menu, which
       * outranks the lane's own vote while the window still places anything
       * on it. Volatile like the decisions it steers: a pin is a choice about
       * this window, and the lane falls back to choosing once the pinned
       * contig explains nothing here
       */
      pinnedLaneContigs: new Map<string, string>(),
      /**
       * #volatile
       * per anchor, the orientation the reader pinned each lane to from its
       * header menu; see `pinnedLaneFlips`. Keyed by the anchor because a pin
       * is stated against its order, so re-anchoring away leaves them alone
       * and coming back finds them
       */
      laneFlipPinsByAnchor: new Map<string, ReadonlyMap<string, LaneFlipPin>>(),
      /**
       * #volatile
       * the view's scroll offset the stack is laid out against, refreshed with
       * the decisions. Between refreshes a pan is one translate of the whole
       * stack (`dragOffsetPx`), not a relayout of every lane
       */
      renderOriginPx: 0,
      /**
       * #volatile
       * per mate lane re-decided onto the contig it already drew, the move
       * from where it drew to its new frame; see `laneTransitionsAfter`. A
       * transition is dropped once the clock passes its end
       */
      laneTransitions: new Map<string, LaneTransition>(),
      /**
       * #volatile
       * the wall clock the last drawn frame of a transition read, advanced by
       * the chrome's frame clock
       */
      laneMotionClockMs: 0,
      /**
       * #volatile
       * the moving lanes past their midpoint; see `lanesPastHalfway`
       */
      laneMotionHalfway: new Set<string>() as ReadonlySet<string>,
    }))
    .actions(self => {
      function ribbonColorSetting(): SyntenyColorSnapshot {
        return {
          value: getConf(self, ['ribbonColor', 'value']),
          field: getConf(self, ['ribbonColor', 'field']),
          scale: getConf(self, ['ribbonColor', 'scale']),
          domain: getConf(self, ['ribbonColor', 'domain']),
        }
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
        /**
         * #action
         */
        setFeatures(
          features: Feature[],
          anchor: string = containingLgv(self).assemblyNames[0]!,
        ) {
          self.fetchedFeatures = { anchor, features }
          observeRibbonFeatures(features)
        },
        /**
         * #action
         * `coversMatesFor` is the anchor assembly when this commit framed a
         * mate lane, else undefined
         */
        setLaneGenes(
          fetched: Map<string, HeldLaneGenes>,
          coversMatesFor: string | undefined,
        ) {
          const held = new Map(self.laneGenes)
          for (const [lane, genes] of fetched) {
            held.set(lane, genes)
          }
          self.laneGenes = held
          if (coversMatesFor !== undefined) {
            self.laneGenesCoverMatesFor = coversMatesFor
          }
        },
        /**
         * #action
         */
        setLaneLinks(
          fetched: Map<string, HeldLaneLinks>,
          anchor: string = containingLgv(self).assemblyNames[0]!,
        ) {
          const held = new Map(self.laneLinks)
          for (const [pair, links] of fetched) {
            held.set(pair, links)
            observeRibbonFeatures(links.links)
          }
          self.laneLinks = held
          self.laneLinksLandedFor = anchor
        },
        /**
         * #action
         */
        setStarAnchor(assemblyName: string | undefined) {
          self.starAnchor = assemblyName
        },
        /**
         * #action
         * pin a lane onto one of its contigs, or `undefined` to let it choose
         * again. A fresh map, so the decision autorun sees the write
         */
        pinLaneContig(assemblyName: string, refName: string | undefined) {
          const pins = new Map(self.pinnedLaneContigs)
          if (refName === undefined) {
            pins.delete(assemblyName)
          } else {
            pins.set(assemblyName, refName)
          }
          self.pinnedLaneContigs = pins
        },
        /**
         * #action
         * The whole pinned order; empty is back to densest-first. A caller
         * that saw only some lanes merges first (`mergeDomain`).
         */
        setDomain(domain: string[]) {
          setConf(self, 'domain', domain)
        },
        /**
         * #action
         */
        setDeclaredLanes(lanes: DeclaredLane[]) {
          self.declaredLanes = lanes
        },
        /**
         * #action
         * draw only `names`, unhiding everything; undefined puts the lanes
         * back to `configuredLanes`, or every lane
         */
        setSelectedLanes(names: string[] | undefined) {
          self.laneFilter = laneFilterOf(names, [])
        },
        /**
         * #action
         */
        setBridgeSkippedLanes(flag: boolean) {
          setConf(self, 'bridgeSkippedLanes', flag)
        },
        /**
         * #action
         */
        setRibbonColorBy(field: string) {
          setConf(
            self,
            'ribbonColor',
            colorForField(ribbonColorSetting(), field),
          )
          // the way back from a label order or a span one window fixed: the
          // ribbons re-key from the features in hand
          self.seenAttributeRanges = {}
          observeRibbonFeatures(self.fetchedFeatures?.features ?? [])
          for (const { links } of self.laneLinks?.values() ?? []) {
            observeRibbonFeatures(links)
          }
        },
        /**
         * #action
         */
        setRibbonColorDomain(domain: string[]) {
          setConf(self, ['ribbonColor', 'domain'], domain)
        },
        /**
         * #action
         */
        setHideUnlabelled(flag: boolean) {
          setConf(self, 'hideUnlabelled', flag)
        },
        /**
         * #action
         */
        setDrawCurves(flag: boolean) {
          setConf(self, 'drawCurves', flag)
        },
        /**
         * #action
         */
        setShowLaneTicks(flag: boolean) {
          setConf(self, 'showLaneTicks', flag)
        },
        /**
         * #action
         */
        setSplitStrands(flag: boolean) {
          setConf(self, 'splitStrands', flag)
        },
        /**
         * #action
         */
        setLodMode(mode: LodMode) {
          setConf(self, 'lodMode', mode)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * the hosting linear genome view. `GlobalFetchMixin` hands down the
       * view-shaped `host` its own gating needs; a display reaching LGV's own
       * geometry names it itself, the way the arc displays do
       */
      get lgv() {
        return containingLgv(self)
      },
      /**
       * #getter
       * the fetched features while the view is on the anchor they were
       * fetched for; another genome's groups read as absent, so no settle
       * decides a lane from them
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
      /**
       * #getter
       * the ortholog group under the pointer; every ribbon of that group
       * highlights, so one hover reads the group across all lanes
       */
      get hoveredGroupKey() {
        return self.hoverTarget?.groupKey
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the level-of-detail tier the reader pinned, or 'auto' for the
       * adapter's own bpPerPx threshold. `lodTier` is what resolves it
       */
      get lodMode(): LodMode {
        return getConf(self, 'lodMode')
      },
      /**
       * #getter
       * whether the track's adapter has tiered storage to switch between —
       * gates the "Level of detail" menu, the way LGVSyntenyDisplay gates it
       */
      get hasLodCapableAdapter() {
        return trackHasLodTiers(self.parentTrack)
      },
      /**
       * #getter
       * the tier the ortholog and lane-link fetches ask an indexed PIF for,
       * resolved here on the main thread off the SETTLED zoom and folded into
       * `viewSignature`, so a tier flip refetches and a gesture travelling
       * through the threshold does not. 'fine' at every zoom for an adapter
       * with no tiers, a gene table included
       */
      get lodTier() {
        return lodTierAt(self, self.host.coarseBpPerPx, this.lodMode)
      },
      /**
       * #getter
       * the same tier off the live zoom, for `dataSuperseded`
       */
      get liveLodTier() {
        return lodTierAt(self, self.lgv.bpPerPx, this.lodMode)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get canvasWidth() {
        return self.lgv.width
      },
      /**
       * #getter
       * staleness axes are the static-block set, same as arc — pan/zoom past a
       * block boundary refetches, a scroll inside the loaded blocks does not —
       * and the level-of-detail tier
       */
      get viewSignature() {
        const blocks = self.staticBlockSignature
        return blocks === undefined ? undefined : `${blocks}|${self.lodTier}`
      },
      /**
       * #getter
       * anchor-sorted gene groups reconstructed from the pairwise features
       */
      get groups() {
        return self.features ? groupFeatures(self.features) : []
      },
      /**
       * #getter
       * a gene-level source names its features and groups chain on the names;
       * an alignment-level source (a multi-genome PAF) names nothing, which is
       * what makes the per-pair link fetch worth issuing
       */
      get featuresAreNameless() {
        return (
          self.features !== undefined &&
          self.features.length > 0 &&
          !self.features.some(isNamedRecord)
        )
      },
      /**
       * #getter
       */
      get ribbonColor(): string {
        return getConf(self, ['ribbonColor', 'value'])
      },
      /**
       * #getter
       */
      get domain(): string[] {
        return getConf(self, 'domain')
      },
      /**
       * #getter
       */
      get ribbonColorField(): string {
        return paintedField({
          scale: getConf(self, ['ribbonColor', 'scale']),
          field: getConf(self, ['ribbonColor', 'field']),
        })
      },
      /**
       * #getter
       * the columns the track declares, each offered as its own ribbon mode.
       * From the config rather than the data, so the menu is right before the
       * first fetch
       */
      get ribbonColorAttributes(): string[] {
        return colorableColumns(declaredAttributes(self.adapterConfig))
      },
      /**
       * #getter
       * the `ribbonColor.domain` order a text column's labels take. A label's color
       * is its position in that list, so this is the ribbons' order as much as
       * the key's
       */
      get ribbonColorDomain(): string[] {
        return getConf(self, ['ribbonColor', 'domain'])
      },
      /**
       * #getter
       * what the ribbon modes paint from: each channel's span, and a text
       * column's labels in `ribbonColorDomain` order
       */
      get ribbonAttributeRanges(): Record<string, AttributeRange> {
        return orderAttributeLabels(
          self.seenAttributeRanges,
          this.ribbonColorDomain,
        )
      },
      /**
       * #getter
       */
      get hideUnlabelled(): boolean {
        return getConf(self, 'hideUnlabelled')
      },
      /**
       * #getter
       */
      get drawCurves(): boolean {
        return getConf(self, 'drawCurves')
      },
      /**
       * #getter
       */
      get bridgeSkippedLanes(): boolean {
        return getConf(self, 'bridgeSkippedLanes')
      },
      /**
       * #getter
       */
      get showLaneTicks(): boolean {
        return getConf(self, 'showLaneTicks')
      },
      /**
       * #getter
       */
      get splitStrands(): boolean {
        return getConf(self, 'splitStrands')
      },
      /**
       * #getter
       * the `color` object and `utrColor` as written, neither evaluated
       */
      get geneColorSettings(): GeneColorSettings {
        return {
          color: {
            value: self.configuration.color.value,
            field: getConf(self, ['color', 'field']),
            scale: getConf(self, ['color', 'scale']),
            domain: getConf(self, ['color', 'domain']),
            range: getConf(self, ['color', 'range']),
          },
          utrColor: self.configuration.utrColor,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the gene `color` as it paints, through the one resolver every
       * display's colour object goes through
       */
      get geneColorEncoding() {
        return colorEncodingOf(self.geneColorSettings.color, 'categorical')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the field the genes paint by, `''` while `color.value` paints
       */
      get geneColorField(): string {
        return colorFieldOf(self.geneColorEncoding)?.field ?? ''
      },
      /**
       * #getter
       * the scale the genes paint through, `none` while `color.value` paints
       */
      get geneColorScale(): ColorScaleName {
        const encoding = self.geneColorEncoding
        return typeof encoding === 'object' ? encoding.scale : 'none'
      },
      /**
       * #getter
       */
      get geneColorDomain(): readonly string[] {
        return self.geneColorSettings.color.domain
      },
    }))
    .views(self => {
      const { jexl } = getEnv<{ pluginManager: PluginManager }>(
        self,
      ).pluginManager
      let boxes:
        | { features?: Feature[]; settings: string; colors: GeneColors }
        | undefined
      let lanes = new Map<
        string,
        { held: HeldLaneGenes; settings: string; colors: GeneColors }
      >()
      return {
        /**
         * #getter
         * the placement boxes' fills, off the groups' own records: resolved
         * once per ortholog fetch and colour setting, so a settle runs no jexl
         */
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
              ),
            }
          }
          return boxes.colors
        },
        /**
         * #getter
         * per lane, its genes' fills, resolved once per commit of that lane's
         * genes and colour setting, so a settle or another lane's commit runs
         * no jexl
         */
        get laneGeneColors(): ReadonlyMap<string, GeneColors> {
          const { geneColorSettings } = self
          const settings = JSON.stringify(geneColorSettings)
          const next = new Map<
            string,
            { held: HeldLaneGenes; settings: string; colors: GeneColors }
          >()
          for (const [lane, held] of self.laneGenes ?? []) {
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
      /**
       * #getter
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
      /**
       * #getter
       */
      get anchorAssemblyName() {
        return self.lgv.assemblyNames[0]!
      },
    }))
    .views(self => ({
      /**
       * #getter
       * what the track's adapter type declares it can answer
       */
      get adapterCapabilities(): readonly string[] {
        const type = self.adapterConfig.type
        return typeof type === 'string'
          ? getEnv(self).pluginManager.getAdapterType(type).adapterCapabilities
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * whether the adapter type says its header declares the lane universe
       * (`adapterCapabilities: ['headerLanes']`); an untiered adapter gets a
       * header read only when this is true
       */
      get adapterDeclaresLanes(): boolean {
        return self.adapterCapabilities.includes('headerLanes')
      },
      /**
       * #getter
       * whether a window of the anchor answers any two lanes aligned to each
       * other (`adapterCapabilities: ['lanePairsOnAnchor']`), the way a
       * pangenome graph holds every haplotype's walk inside a window cut on
       * its reference
       */
      get adapterPairsOnAnchor(): boolean {
        return self.adapterCapabilities.includes('lanePairsOnAnchor')
      },
      /**
       * #method
       * the one spelling two names for the same assembly share
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
      /**
       * #getter
       * the orientation the reader pinned each lane to against the anchor the
       * view is on, which outranks the lane's own vote while it draws the
       * contig the pin was set on
       */
      get pinnedLaneFlips(): ReadonlyMap<string, LaneFlipPin> {
        return (
          self.laneFlipPinsByAnchor.get(
            self.laneKey(self.anchorAssemblyName),
          ) ?? NO_FLIP_PINS
        )
      },
    }))
    .actions(self => {
      function setFlipPins(pins: ReadonlyMap<string, LaneFlipPin>) {
        self.laneFlipPinsByAnchor = new Map(self.laneFlipPinsByAnchor).set(
          self.laneKey(self.anchorAssemblyName),
          pins,
        )
      }
      return {
        /**
         * #action
         * mirror a lane against its current orientation, pinned to the contig
         * it draws
         */
        flipLane(assemblyName: string) {
          const decision = self.laneDecisions.get(assemblyName)
          if (decision) {
            setFlipPins(
              new Map(self.pinnedLaneFlips).set(assemblyName, {
                refName: decision.refName,
                flipped: !decision.flipped,
              }),
            )
          }
        },
        /**
         * #action
         * let a flipped lane choose its orientation again
         */
        unpinLaneFlip(assemblyName: string) {
          const pins = new Map(self.pinnedLaneFlips)
          pins.delete(assemblyName)
          setFlipPins(pins)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * the lanes a source declaring its own opens on: the track's assemblies
       * beside the anchor, since a graph naming 464 haplotypes on a track
       * naming eight means those eight. Empty for every other source
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
       * the lanes in force: the picker's choice, else `configuredLanes` where
       * there are any, else undefined for every lane. A hidden lane is still
       * in force, so hiding one refetches nothing
       */
      get laneSelection(): readonly string[] | undefined {
        return lanesInForce(self.laneFilter, self.configuredLanes)
      },
      /**
       * #getter
       * the lanes Hide lane took out of the drawing
       */
      get hiddenLanes(): readonly string[] {
        return hiddenLanesOf(self.laneFilter)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the lane selection an ADAPTER is asked to narrow its fetch to, which
       * is not the same thing as the selection the stack draws. A source whose
       * header declares the lane universe knows lanes as objects it can cut
       * on, and is the only kind that can answer for a subset more cheaply
       * than for all of them — `GbzBaseSyntenyAdapter` walks only the named
       * haplotypes from an anchor rather than naming all 464 and discarding.
       * For every other multiway source the term would be a refetch bought for
       * a filter it ignores, so it is withheld and `rowAssemblies` narrows the
       * drawing exactly as before.
       */
      get fetchLaneSelection(): string[] | undefined {
        return self.adapterDeclaresLanes && self.laneSelection
          ? [...self.laneSelection]
          : undefined
      },
    }))
    .views(self => ({
      /**
       * The settings axis of this display's fetch key. A lane selection the
       * adapter acts on changes what comes back, so held data fetched under a
       * different selection is stale and has to be refetched — and the
       * sanctioned way to say so is a field here, which `settingsFetchInputs`
       * folds into `currentFetchKey`, rather than a term hand-folded into
       * `viewSignature`. Reads only user-controlled state (the picker's choice,
       * else the track's config), never anything a fetch produced, which is
       * what the loop trap forbids.
       */
      rpcProps() {
        return { haplotypes: self.fetchLaneSelection }
      },
      /**
       * #getter
       */
      get anchorAssembly() {
        return getSession(self).assemblyManager.get(self.anchorAssemblyName)
      },
      /**
       * #getter
       * where the anchor lane is looking, off the settled blocks where there
       * are any, so a header reading it does not flicker through a pan
       */
      get anchorLocString() {
        const view = self.lgv
        return view.coarseVisibleLocStrings || view.visibleLocStrings
      },
      /**
       * #method
       * whether the session holds a lane's genome under any spelling, which
       * is what a navigation onto it needs and a lane drawn from a blocks
       * table does not
       */
      holdsAssembly(assemblyName: string) {
        return getSession(self).assemblyManager.has(assemblyName)
      },
      /**
       * #getter
       * the labels the source's header gives its lanes, by lane key
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
       * #method
       * what a lane is called on screen: the display name the session gives a
       * genome it holds, the way the assembly selector names it, else the
       * label the source declares, else the name the placements carry
       */
      laneLabel(assemblyName: string) {
        return (
          (this.holdsAssembly(assemblyName)
            ? getSession(self).assemblyManager.get(assemblyName)?.displayName
            : this.declaredLaneLabels.get(self.laneKey(assemblyName))) ||
          assemblyName
        )
      },
      /**
       * #getter
       * every lane the picker can offer: the header's declared lanes in the
       * source's order, then the genomes the track config names, then any
       * lane the fetched window places that neither named, each saying
       * whether the stack draws it. The anchor is never a lane
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
        const asked =
          self.fetchLaneSelection &&
          new Set(self.fetchLaneSelection.map(self.laneKey))
        const known = (key: string) =>
          self.features !== undefined && (asked === undefined || asked.has(key))
        const out = new Map<string, LaneChoice>()
        const offer = (lane: DeclaredLane) => {
          const key = self.laneKey(lane.name)
          if (key !== anchor && !out.has(key)) {
            const label = lane.label ?? this.laneLabel(lane.name)
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
       * mate assemblies densest-first, one lane each below the anchor lane,
       * with any `domain` lanes pinned above them, narrowed to the lanes
       * the stack draws. A paralogy record's mate is the anchor assembly
       * itself; those draw on the anchor's own axis rather than as a lane
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
      /**
       * #getter
       * whether a mate lane can become the anchor. A star source names its
       * one anchor in its header, and a source declaring its lanes without
       * the view's anchor among them answers from that anchor alone; either
       * re-anchored on a mate draws next to nothing
       */
      get canReanchor() {
        const anchor = self.laneKey(self.anchorAssemblyName)
        const declared = self.declaredLanes ?? []
        return (
          self.starAnchor === undefined &&
          (declared.length === 0 ||
            declared.some(lane => self.laneKey(lane.name) === anchor))
        )
      },
      /**
       * #getter
       */
      get visibleBpSpan() {
        const view = self.lgv
        return view.initialized ? view.width * view.bpPerPx : 0
      },
    }))
    .actions(self => ({
      /**
       * #action
       * the picker's submit: `names` plus the picked lanes no window has
       * offered here, or no choice at all where that is what the lanes come
       * back to
       */
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
      /**
       * #action
       * out of the drawing, whatever choice is in force: the lane stays
       * fetched, so this refetches nothing
       */
      hideLane(assemblyName: string) {
        self.laneFilter = withLaneHidden(
          self.laneFilter,
          assemblyName,
          self.laneKey,
        )
      },
      /**
       * #action
       * drawn again: unhidden, and added to the lanes in force where they
       * leave it out
       */
      showLane(assemblyName: string) {
        self.laneFilter = withLaneShown(
          self.laneFilter,
          self.configuredLanes,
          assemblyName,
          self.laneKey,
        )
      },
      /**
       * #action
       * every hidden lane drawn again, keeping the picker's choice
       */
      showHiddenLanes() {
        self.laneFilter = laneFilterOf(self.laneFilter?.only, [])
      },
    }))
    .actions(self => ({
      /**
       * #action
       * the lane picker, over `laneUniverse`
       */
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
       * the groups whose anchor placement is inside the settled viewport, each
       * with the bp interval of it the viewport shows: the hull of the settled
       * blocks the group meets, so a group reaching across a block boundary is
       * cut at neither
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
       * the groups the viewport shows something of, WHOLE: what the picture is
       * drawn from, since the stack is translated between settles and a group
       * cut at the viewport edge would end mid-ribbon on the first pan
       */
      get visibleGroups() {
        return self.visibleGroupWindows.map(({ group }) => group)
      },
      /**
       * #getter
       * the same groups cut to the viewport — the population every lane's
       * local frame is fitted to, so panning the anchor re-lays-out the other
       * lanes. Cut rather than merely filtered because the fetch is padded and
       * the records come back cut to the PADDING: see `clipGroupToAnchor`
       */
      get fitGroups() {
        return self.visibleGroupWindows.map(({ group, start, end }) =>
          clipGroupToAnchor(group, start, end),
        )
      },
      /**
       * #getter
       * the one bp interval every lane draws its ticks at, so tick spacing is
       * readable as bp-per-pixel across lanes drawn in different frames
       */
      get tickIntervalBp() {
        return tickIntervalFor(self.visibleBpSpan)
      },
      /**
       * #getter
       * the stack's full drawn height: the track height until a lane would
       * fall under the minimum pitch, then fixed-pitch and taller than the
       * viewport — what the scrollbar is sized against
       */
      get scrollContentHeight() {
        return laneContentHeight(self.height, 1 + self.rowAssemblies.length)
      },
      /**
       * #getter
       * per lane, the gene track it draws: the one `laneGeneTracks` names for
       * its genome, else the session's best-ranked annotation track declared
       * for that assembly alone (`annotationRank`). Ranked rather than first
       * found, since a config routinely puts `hg38-rmsk` in BED beside
       * `hg38-genes` in GFF3. One pass over the tracks against the lanes'
       * canonical names, so a cohort of lanes costs no more than one
       */
      get laneGeneTracks() {
        const session = getSession(self)
        const named = new Set<string>(getConf(self, 'laneGeneTracks'))
        // two mates can spell one assembly two ways, and both lanes draw from
        // the one track
        const lanesByKey = new Map<string, string[]>()
        for (const lane of [self.anchorAssemblyName, ...self.rowAssemblies]) {
          const key = self.laneKey(lane)
          lanesByKey.set(key, [...(lanesByKey.get(key) ?? []), lane])
        }
        const best = new Map<
          string,
          { rank: number; track: AnyConfigurationModel }
        >()
        // the tracks the "Open assembly" hop brings along, connections
        // included, so a lane annotated through one does not read as bare
        for (const track of allSessionTracks(session)) {
          const names = readConfObject(track, 'assemblyNames') as string[]
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
      /**
       * #getter
       * the adapter config of each lane's gene track
       */
      get laneGeneAdapters() {
        const out = new Map<string, Record<string, unknown>>()
        for (const [lane, track] of self.laneGeneTracks) {
          out.set(lane, readConfObject(track, 'adapter'))
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get scrollViewportHeight() {
        return self.height
      },
      /**
       * #getter
       * where the view draws each visible group's anchor interval, in the
       * view's px before the scroll offset and in the anchor's own direction —
       * start end first, so a horizontally flipped view hands the ribbons the
       * crossed pair it is drawing — with the clipped interval's centre as the
       * coordinate a lane decision can pin to.
       *
       * The view's own `bpToPx` through `axisPlacement`, which is the only
       * honest answer: it is piecewise over the displayed regions and no
       * `RowFrame` can stand in for it. Read both by the lane-alignment seed
       * and by the anchor lane's own ribbons, so "the lanes line up against
       * where the anchor actually draws" holds by construction rather than by
       * two loops agreeing
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
       * how far the view has scrolled since the stack was laid out: the one
       * live read a pan makes, applied as a translate over the whole stack
       */
      get dragOffsetPx() {
        const view = self.lgv
        return view.initialized ? self.renderOriginPx - view.offsetPx : 0
      },
      /**
       * #getter
       * the anchor axis reads right to left: a horizontally flipped view. A
       * lane's decision is stated against the anchor's order, so this mirrors
       * every lane with the anchor without a re-decision
       */
      get anchorReversed() {
        return self.lgv.displayedRegionsOrientation === 'reversed'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the anchor placements in the stack's own px: what the anchor lane
       * draws and what every ribbon out of it starts from
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
       * the first link of the alignment chain: each visible group's anchor
       * centre and the view's px for it BEFORE the scroll offset, so a settle
       * decision reading this does not re-run on every pan
       */
      get anchorAbsX(): Map<string, { coord: AnchorCoord; x: number }> {
        const out = new Map<string, { coord: AnchorCoord; x: number }>()
        for (const [key, { centre, x1, x2 }] of self.anchorPlacements) {
          out.set(key, { coord: centre, x: (x1 + x2) / 2 })
        }
        return out
      },
      /**
       * #method
       * the frame a decision draws a lane in, against where the view draws
       * its pivot now; undefined once the pivot is off the displayed regions
       */
      laneFrameOf(decision: LaneDecision): RowFrame | undefined {
        const pivot = self.lgv.bpToPx(decision.pivotAnchor)
        return pivot
          ? frameFromDecision(
              decision,
              pivot.offsetPx - self.renderOriginPx,
              self.visibleBpSpan,
              self.canvasWidth,
              self.anchorReversed,
            )
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each mate lane's local coordinate frame: the settle's decision
       * against where the view draws its pivot now, carrying the frames a
       * running transition moves it from
       */
      get rowFrames(): Map<string, RowFrame | undefined> {
        const out = new Map<string, RowFrame | undefined>()
        for (const assemblyName of self.rowAssemblies) {
          const decision = self.laneDecisions.get(assemblyName)
          const frame = decision && self.laneFrameOf(decision)
          const motion = frame && self.laneTransitions.get(assemblyName)
          const morphFrom = motion?.from.flatMap(seed => {
            const from = self.laneFrameOf(seed.decision)
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
    }))
    .actions(self => {
      // replaced only when its membership changes, so what reads it recomputes
      // once per move rather than once per frame
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
         * a settle's decisions and the offset their px space is anchored at. A
         * lane re-decided on the contig it drew starts moving from where it drew
         * rather than snapping, where motion is allowed
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
            frameOf: decision => self.laneFrameOf(decision),
            width: self.canvasWidth,
          })
          setHalfway(lanesPastHalfway(self.laneTransitions, nowMs))
        },
        /**
         * #action
         * the chrome's frame clock; a transition past its end is dropped,
         * which repacks its lane in its settled frame alone
         */
        advanceAnimation(nowMs: number) {
          self.laneMotionClockMs = nowMs
          const running = laneTransitionsRunning(self.laneTransitions, nowMs)
          if (running.size !== self.laneTransitions.size) {
            self.laneTransitions = running
          }
          setHalfway(lanesPastHalfway(running, nowMs))
        },
        /**
         * #action
         * every lane to its settled frame now
         */
        endAnimation() {
          if (self.laneTransitions.size > 0) {
            self.laneTransitions = new Map()
          }
          setHalfway(new Set())
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * what the lane-genes autorun fetches: one spec per lane with a gene
       * track, over the quantized window each lane's frame slides in
       */
      get laneGenesFetchSpecs(): LaneGenesFetchSpec[] {
        const view = self.lgv
        const adapters = self.laneGeneAdapters
        const specs: LaneGenesFetchSpec[] = []
        if (view.initialized) {
          const anchorAdapter = adapters.get(self.anchorAssemblyName)
          const regions = mergeContiguousRegions(
            view.staticBlocks.contentBlocks,
          )
          if (anchorAdapter && regions.length) {
            specs.push({
              lane: self.anchorAssemblyName,
              key: regions.map(regionKey).join(','),
              adapterConfig: anchorAdapter,
              regions,
            })
          }
          for (const [assemblyName, frame] of self.rowFrames) {
            const adapter = adapters.get(assemblyName)
            if (adapter && frame && self.holdsAssembly(assemblyName)) {
              const region = { assemblyName, ...laneFetchRegion(frame) }
              specs.push({
                lane: assemblyName,
                key: regionKey(region),
                adapterConfig: adapter,
                regions: [region],
              })
            }
          }
        }
        return specs
      },
      /**
       * #getter
       * one spec per ADJACENT mate-lane pair of an alignment-level source, at
       * the settled tier. A source whose adapter reads lane pairs on its anchor
       * (`adapterPairsOnAnchor`) is asked for each pair inside the anchor's
       * window, the one window it can cut. Any other source naming no star
       * anchor is asked on the upper lane's window against the lower lane's
       * assembly, which a multi-genome adapter answers with the direct records
       * it holds for that pair — none, for a star that did not name its
       * anchor; one that announced itself a star holds no such rows and is not
       * asked. That route needs the session to hold both assemblies: the fetch
       * renames its region through the assembly manager, which refuses a PanSN
       * sample the config never declared, and a multi-genome file routinely
       * carries more of those than the config names
       */
      get laneLinksFetchSpecs(): LaneLinksFetchSpec[] {
        const specs: LaneLinksFetchSpec[] = []
        const onAnchor = self.adapterPairsOnAnchor
        if (
          self.featuresAreNameless &&
          (onAnchor || self.starAnchor === undefined)
        ) {
          const { lodTier } = self
          const rows = self.rowAssemblies
          const view = self.lgv
          const anchorRegions =
            onAnchor && view.initialized
              ? mergeContiguousRegions(view.staticBlocks.contentBlocks)
              : []
          const pairWindow = (upperAssembly: string, lowerAssembly: string) => {
            const upper = self.rowFrames.get(upperAssembly)
            if (!upper || !self.rowFrames.get(lowerAssembly)) {
              return []
            } else if (onAnchor) {
              return anchorRegions
            } else if (
              self.holdsAssembly(upperAssembly) &&
              self.holdsAssembly(lowerAssembly)
            ) {
              return [
                { assemblyName: upperAssembly, ...laneFetchRegion(upper) },
              ]
            } else {
              return []
            }
          }
          for (let i = 0; i + 1 < rows.length; i++) {
            const upperAssembly = rows[i]!
            const lowerAssembly = rows[i + 1]!
            const regions = pairWindow(upperAssembly, lowerAssembly)
            if (regions.length > 0) {
              specs.push({
                lane: `${upperAssembly}|${lowerAssembly}`,
                key: `${regions.map(regionKey).join(',')}|${lodTier}`,
                upperAssembly,
                lowerAssembly,
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
      /**
       * #getter
       * the stack the picture is drawn from: one `Lane` per assembly, plus the
       * geometry every layer places against. Every layer — bands, ticks,
       * ribbons, glyphs, boxes, headers, the hover outline — is a walk over
       * this, and the on-screen body and the SVG export walk the same one.
       * The lane genes are not in it: only the glyph cells read them, and a
       * stack that carried them re-uploaded every ribbon and tick, and dropped
       * the hover, on every gene commit
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
          groups: self.visibleGroups,
          anchorSpans: self.anchorSpans,
          rowFrames: self.rowFrames,
          laneGeneAdapters: self.laneGeneAdapters,
          axisSpanOf: (refName, start, end) =>
            axisSpan(view, refName, start, end, self.renderOriginPx),
          anchorRegionSpans: displayedRegionSpans(view, self.renderOriginPx),
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
          pastHalfway: self.laneMotionHalfway,
          labelOf: assemblyName => self.laneLabel(assemblyName),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * by lane row, where each moving lane draws its cells at the frame
       * loop's clock: both frames re-derived against the live view, so a pan
       * or zoom mid-flight composes with the move
       */
      get laneMaps(): ReadonlyMap<number, LaneMap> {
        const out = new Map<number, LaneMap>()
        if (self.laneTransitions.size > 0) {
          const nowMs = self.laneMotionClockMs
          self.laneStack.lanes.forEach(({ assemblyName, frame }, row) => {
            const motion = self.laneTransitions.get(assemblyName)
            if (motion && frame?.morphFrom) {
              out.set(
                row,
                laneMapAt(
                  frame.morphFrom,
                  frame,
                  laneMotionEase(motion, nowMs),
                  self.canvasWidth,
                ),
              )
            }
          })
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * what each lane's header says and where, for the on-screen headers and
       * the export's captions alike; a moving lane's names the frame it is
       * drawn nearer to
       */
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
       * the direct records between each adjacent mate-lane pair as the
       * ribbons read them: the pair's fetched links where the file holds any,
       * else the links composed through the anchor from the groups, one record
       * per placement either lane makes. Off the fetched sets and the session's
       * assemblies, never the frames, so a settle recomposes nothing
       */
      get pairLinks(): ReadonlyMap<string, { links: Feature[] }> {
        const out = new Map<string, { links: Feature[] }>()
        const rows = self.rowAssemblies
        const placementsOn = (assemblyName: string) =>
          self.groups.flatMap(group =>
            (group.mates.get(assemblyName) ?? []).map(
              (p): LanePlacementRecord => ({
                anchorRefName: group.anchor.refName,
                anchorStart: group.anchor.start,
                anchorEnd: group.anchor.end,
                refName: p.refName,
                start: p.start,
                end: p.end,
                strand: p.orientation < 0 ? -1 : 1,
                feature: group.feature,
              }),
            ),
          )
        for (let i = 0; i + 1 < rows.length; i++) {
          const upper = rows[i]!
          const lower = rows[i + 1]!
          const pair = `${upper}|${lower}`
          const fetched = self.laneLinks?.get(pair)
          if (fetched !== undefined && fetched.links.length > 0) {
            out.set(pair, fetched)
          } else if (
            self.featuresAreNameless &&
            (self.starAnchor !== undefined ||
              fetched !== undefined ||
              !self.holdsAssembly(upper) ||
              !self.holdsAssembly(lower))
          ) {
            out.set(pair, {
              links: composeLaneLinks({
                upper: placementsOn(upper),
                lower: placementsOn(lower),
                upperAssemblyName: upper,
                lowerAssemblyName: lower,
              }),
            })
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the ribbons between each adjacent lane pair as the synteny passes'
       * instance data, in the stack's own px, plus what each ribbon opens
       */
      get ribbonGeometry() {
        return buildRibbonGeometry({
          stack: self.laneStack,
          laneLinks: self.pairLinks,
          ribbonColor: self.ribbonColor,
          ribbonColorField: self.ribbonColorField,
          attributeRanges: self.ribbonAttributeRanges,
          hideUnlabelled: self.hideUnlabelled,
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
      /**
       * #getter
       * the opaque bands under the mate lanes, off the lane geometry rather
       * than the stack: the stack moves on every pan and settle, the bands
       * only when a lane comes or goes, and an unchanged cell uploads nothing
       */
      get bandCell(): MultiWayCell {
        return {
          kind: 'glyphs',
          data: buildBandCell({
            bands: laneGeometry(
              self.height,
              1 + self.rowAssemblies.length,
              self.splitStrands,
            ).rows,
            width: self.canvasWidth,
            paper: bandGroundColor(),
            stripe: bandInk().stripe,
          }),
        }
      },
    }))
    .views(self => {
      let held: {
        lane: Lane
        colors: LaneGlyphColors
        glyphs: MultiWayCell
        boxes: MultiWayCell
      }[] = []
      return {
        /**
         * #getter
         * two cells per lane — its gene models and baseline, and its placement
         * boxes; see `buildLaneCells`. Boxes first, so a hit test walking these
         * in order answers the box over the gene the way the draw order does.
         * Fills come off `laneGeneColors` and `boxColors`, so a settle re-runs
         * no jexl slot, and neither the hover nor the selection reads these:
         * the chrome draws both.
         *
         * A lane whose `Lane`, fills and ink are the ones its cells were packed
         * from keeps those cells, so another lane's gene commit re-uploads
         * nothing of it
         */
        get laneGlyphCells() {
          const { laneGenes, laneGeneColors, boxColors } = self
          const { lanes, glyphHeight } = self.laneStack
          const ink = bandInk()
          held = lanes.map((lane, row) => {
            const colors = {
              genes: laneGeneColors.get(lane.assemblyName) ?? boxColors,
              boxes: boxColors,
              stroke: ink.text,
              divider: ink.divider,
            }
            const prev = held[row]
            if (
              prev?.lane === lane &&
              prev.colors.genes === colors.genes &&
              prev.colors.boxes === colors.boxes &&
              prev.colors.stroke === colors.stroke &&
              prev.colors.divider === colors.divider
            ) {
              return prev
            }
            const { glyphs, boxes } = buildLaneCells({
              lane,
              genes: laneGenes?.get(lane.assemblyName)?.genes ?? [],
              glyphHeight,
              width: self.canvasWidth,
              colors,
            })
            return {
              lane,
              colors,
              glyphs: { kind: 'glyphs', data: glyphs },
              boxes: { kind: 'glyphs', data: boxes },
            }
          })
          const out = new Map<string, MultiWayCell>()
          held.forEach(({ glyphs, boxes }, row) => {
            out.set(boxesKey(row), boxes)
            out.set(glyphsKey(row), glyphs)
          })
          return out
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * The key for the glyph colors, read off the anchor lane: it is the one
       * lane whose color for a group runs down every chain the stack draws, and
       * keying every lane instead would spend a row on each strain's private
       * genes and blow the bound on the window where the chains are the point.
       * A field keys the values it painted, a `jexl:` color its drawn colors
       * by name, and a constant nothing.
       *
       * `MAX_LEGEND_ENTRIES` rather than `legendIsReadable`'s own default,
       * because this is a derived key and that is the bound a derived key stops
       * being one at.
       *
       * Over the settled window, not the live one: the cells are laid out
       * against `renderOriginPx`, and the decision autorun restamps that at
       * settle, so reading `dragOffsetPx` here only rebuilt the key on every
       * pan frame.
       */
      get geneColorScales(): ColorScale[] {
        const hits = [boxesKey(0), glyphsKey(0)].flatMap(key => {
          const cell = self.laneGlyphCells.get(key)
          return cell?.kind === 'glyphs' ? cell.data.hits : []
        })
        const onScreen: Span = [0, self.canvasWidth]
        const encoding = self.geneColorEncoding
        const field = colorFieldOf(encoding)
        if (field) {
          return laneFieldKey(hits, onScreen, field)
        }
        const items = isJexl(encoding) ? laneColorKey(hits, onScreen) : []
        return legendIsReadable(items, MAX_LEGEND_ENTRIES)
          ? [
              {
                kind: 'categorical',
                id: 'genes',
                title: 'Gene colors',
                entries: items,
              },
            ]
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `color.domain` followed by the values the gene key lists that it does
       * not, in the key's order and less the no-value row
       */
      get pinnedGeneColorDomain(): string[] {
        const { domain } = self.geneColorSettings.color
        const listed = new Set(domain)
        const keyed = self.geneColorScales.flatMap(scale =>
          scale.kind === 'categorical'
            ? scale.entries
                .flatMap(e => e.values ?? [e.value])
                .filter(v => v !== '')
            : [],
        )
        return [...domain, ...keyed.filter(v => !listed.has(v))]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * paint the genes by `field`, or by `color.value` for `''`, by
       * display-kit's `colorForField`
       */
      setGeneColorBy(field: string) {
        setConf(
          self,
          'color',
          colorForField(self.geneColorSettings.color, field),
        )
      },
      /**
       * #action
       * `pinnedGeneColorDomain` into `color.domain`, so every value the gene
       * key lists spends its own range color
       */
      pinGeneColorDomain() {
        const { value, field, range } = self.geneColorSettings.color
        setConf(self, 'color', {
          ...(value === undefined ? {} : { value }),
          field,
          domain: self.pinnedGeneColorDomain,
          range: [...range],
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `LegendMixin`'s hook: the two color vocabularies as their own scales,
       * so each is titled and dismissed on its own, and neither claims the
       * other's colors. The colors here are the config's to encode, and a track
       * that paints one flat color has nothing for a key to say.
       */
      get colorScales(): ColorScale[] {
        const scales: ColorScale[] = [
          ...self.geneColorScales,
          ...ribbonColorScales(
            self.ribbonColorField,
            self.ribbonAttributeRanges,
            self.ribbonColorDomain,
            self.hideUnlabelled,
            self.ribbonColor,
          ),
        ]
        return scales.filter(scale => !colorScaleIsEmpty(scale))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * everything the backend holds bytes for, keyed so an unchanged cell
       * keeps its identity across a rebuild of the map and uploads nothing
       */
      get namedCells(): ReadonlyMap<string, MultiWayCell> {
        return new Map<string, MultiWayCell>([
          [BANDS_KEY, self.bandCell],
          ...self.ribbonGeometry.cells,
          ...self.tickGeometry.cells,
          ...self.laneGlyphCells,
        ])
      },
      /**
       * #getter
       * the stack back to front: bands under everything, since they exist to
       * cover the view's gridlines; ribbons; each lane's ticks; each lane's
       * glyphs over its own ribbons
       */
      get namedLayers(): MultiWayLayer[] {
        const { lanes } = self.laneStack
        return [
          { kind: 'glyphs', key: BANDS_KEY, scrolled: false },
          ...self.ribbonGeometry.layers,
          ...self.tickGeometry.layers,
          ...lanes.flatMap((_lane, row): MultiWayLayer[] => [
            { kind: 'glyphs', key: glyphsKey(row), scrolled: true, row },
            { kind: 'glyphs', key: boxesKey(row), scrolled: true, row },
          ]),
        ]
      },
      /**
       * #getter
       * the ribbon feature id the passes highlight: every ribbon of the
       * hovered group shares one, so a hover over any gutter lights the group
       * in all of them
       */
      get hoveredFeatureId() {
        return ribbonFeatureId(self.ribbonGeometry, self.hoverTarget)
      },
      /**
       * #getter
       * the clicked twin, resolved the same way
       */
      get clickedFeatureId() {
        return ribbonFeatureId(self.ribbonGeometry, self.clickedTarget)
      },
      /**
       * #getter
       * The hovered group's placement in every lane that places it, for the
       * chrome's highlight. A ribbon joins ADJACENT lanes only, so a group the
       * middle lane does not place would light nothing there without this.
       */
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
      /**
       * #getter
       * Every gene or placement box drawing the selected feature, for the
       * chrome's highlight — off the hit boxes the hit test reads, so what
       * lights is what a click there would select.
       */
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
      /**
       * #getter
       * A wash and a border: the glyph colours are the data.
       */
      get highlightStyle(): HighlightStyle {
        return 'box'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the clicked group's outline in every gutter that draws it — its own
       * cell beside the gutter's, so a selection re-uploads the records the
       * outline traces rather than the gutter's whole buffer, and a pan
       * re-uploads nothing
       */
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
       * everything the backend holds bytes for, under the numeric region key a
       * block names. Merged from cached maps, so a lane relayout that leaves a
       * gutter's cell alone re-uploads nothing of it
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
       * the stack back to front under those same keys, each gutter's outline
       * layer immediately over the gutter it traces
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
       * the gutters' ribbon geometry, in draw order — what the pick walks
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
    }))
    .views(self => ({
      /**
       * #getter
       * what a frame draws with: the cells' layout and the live transforms,
       * the drag and each moving lane's map
       */
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
      /**
       * #getter
       * one block per layer, in the order the stack draws them
       */
      get renderBlocks() {
        return multiwayBlocks(self.renderState)
      },
      /**
       * #getter
       * the render state as the synteny pick engine reads it: a numeric key per
       * gutter, topmost last, so a point over two gutters answers the one drawn
       * over
       */
      get ribbonPickState(): SyntenyRenderState {
        const state = self.renderState
        const perTrack = new Map<number, SyntenyTrackRenderParams>()
        for (const [key, layer] of state.layers) {
          if (layer.kind === 'ribbons') {
            perTrack.set(key, ribbonParams(layer, state))
          }
        }
        return {
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          overdrawPx: 0,
          groundColor: state.groundColor,
          perTrack,
        }
      },
    }))
    .views(self => {
      // the engine's offscreen context and its per-geometry index, allocated
      // once for the stack — the same closure the pairwise band holds
      const pick = createSyntenyPicker()
      return {
        /**
         * #method
         * the ribbon under a container-relative point, topmost first
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
       * what sits under a container-relative point: the glyph or box of the
       * one lane whose glyph row holds it, boxes before genes since that is
       * the order they draw, then a ribbon through the pick engine
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
        // the pick answers an INSTANCE; the target is what that instance's
        // feature index names
        const targetIdx =
          hit &&
          self.ribbonRegions.get(hit.key)?.instanceFeatureIdx[hit.instanceIndex]
        return targetIdx === undefined
          ? undefined
          : self.ribbonGeometry.targets[targetIdx]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * a lane is moving between two frames, which the chrome publishes for
       * the capture waits. Its cells are culled to both frames meanwhile, so
       * `dataSuperseded` holds the export for it too; the deadline installed
       * in afterAttach drops every transition at its end, so neither latches
       */
      get animating() {
        return self.laneTransitions.size > 0
      },
      /**
       * #getter
       * `FetchMixin`'s hook: the dependent fetches are part of loading until
       * they FIRST land on this anchor, so an export or a capture never lands
       * between the
       * ortholog fetch and the gene models that fill the lanes. Not for later
       * refetches: those run over lanes that are already drawn, and holding the
       * phase at loading puts the striped scrim over them. A failed lane fetch
       * commits an empty result rather than hanging this (see afterAttach).
       *
       * The first landing is the first one that names a mate lane, not the
       * anchor-only commit that can precede it: the anchor's spec exists
       * before the ortholog fetch has framed any mate, so a phase that read
       * `ready` off that commit let a capture shoot placement boxes while
       * seven lanes were still downloading their indexes (the primate
       * amylase figure, 2026-09-02)
       */
      get awaitingDependentData(): boolean {
        const genes = self.laneGenesFetchSpecs
        return (
          (self.laneGenes === undefined && genes.length > 0) ||
          (self.laneGenesCoverMatesFor !== self.anchorAssemblyName &&
            specsCoverMate(genes, self.anchorAssemblyName)) ||
          (self.laneLinksLandedFor !== self.anchorAssemblyName &&
            self.laneLinksFetchSpecs.length > 0)
        )
      },
      /**
       * #getter
       * `GlobalFetchMixin`'s hook: a lane fetch is out, or some lane holds a
       * result fetched under a key its frame has moved past, so the ortholog
       * data the signature calls current is about to be redrawn over; or the
       * live zoom has left the settled tier the held data was fetched at.
       * Holds the export, where the phase above holds only the first landing's
       * scrim. A lane fetch always commits — one failed lane is stamped with
       * an empty result (see afterAttach) — so this cannot latch
       */
      get dataSuperseded(): boolean {
        return (
          staleLaneSpecs(self.laneGenesFetchSpecs, self.laneGenes).length > 0 ||
          staleLaneSpecs(self.laneLinksFetchSpecs, self.laneLinks).length > 0 ||
          self.lodTier !== self.liveLodTier ||
          this.animating
        )
      },
      /**
       * #getter
       * `BaseDisplay`'s hook, what the view publishes to `session.hovered`
       */
      get hoveredFeature() {
        return self.hoverTarget?.feature
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), { feature })
      },
      /**
       * #action
       * a lane's assembly in a linear genome view of its own, at `loc`, with
       * this track along so the new view is the same stack anchored there,
       * and the gene track the lane draws — not every feature track the
       * genome has, which on a hub is dozens. Keyed on the display and the
       * lane, so following one lane twice re-navigates the view
       */
      openInNewView(assemblyName: string, loc: string) {
        const session = getSession(self)
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
      /**
       * #action
       * the hosting view onto `assemblyName` at `loc`; the anchor lane reads
       * off the view's first assembly, so the stack re-anchors on its own,
       * and the outgoing anchor joins a selection in force so it stays drawn
       */
      reanchor(assemblyName: string, loc: string) {
        const session = getSession(self)
        const view = self.lgv
        const outgoing = self.anchorAssemblyName
        // the same undo the stacked view's moves offer: the navigation
        // replaces the view's regions with another genome's, and what it
        // discarded may be a region list built over several navigations
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
      /**
       * #action
       */
      setHoverTarget(target: HoverTarget | undefined) {
        self.hoverTarget = target
      },
      /**
       * #action
       * the backend's cells and frame, through the one installer: a cell
       * re-uploads when its identity changes and a frame redraws on anything
       * the render state reads, which on a pan is the drag offset alone
       */
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
        /**
         * #method
         * Show..., Color by..., Lanes and Level of detail, then under Launch
         * the same multi-panel launch the view menu and the rubberband offer:
         * every genome aligning to the visible window in a stacked linear
         * synteny view, cut from this track's dataset
         */
        trackMenuItems(): MenuItem[] {
          const view = self.lgv
          const items = [
            ...superMenuItems(),
            ...multiWayTrackMenuItems(self),
            ...lodMenuItems(self),
          ]
          for (const item of syntenyRegionMenuItems({
            label: 'Linear synteny view (visible region)',
            region: widestRegion(view.dynamicBlocks.contentBlocks),
            session: getSession(self),
            openTracks: [self.parentTrack.configuration],
            anchorTracks: anchorPanelTracks(view.tracks),
            sourceView: containingPanelStack(view) ?? view,
            // the panels are the lanes on screen, in the stack's order,
            // rather than a discovery over the dataset that forgets the lanes
            // the reader chose and, on a graph source, fetches every
            // haplotype the window places a second time
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
      /**
       * #action
       */
      setPointer(state?: MouseState) {
        self.setHoverTarget(
          state && !self.isLoadingOrCanceled
            ? self.hitTest(state.x, state.y)
            : undefined,
        )
      },
      /**
       * #action
       * `BaseDisplay`'s hook. Two clears call it, because two different things
       * move the lanes under a stationary cursor: the foundation's
       * viewport-change reaction, and this display's own relayout reaction (see
       * afterAttach)
       */
      clearHoveredFeature() {
        self.setHoverTarget(undefined)
      },
      /**
       * #action
       */
      selectHovered() {
        const { hoverTarget } = self
        // clicked-state twin of the hover: the clicked group's ribbon keeps
        // an outline, and a click on empty canvas clears it
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
      /**
       * #action
       */
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
