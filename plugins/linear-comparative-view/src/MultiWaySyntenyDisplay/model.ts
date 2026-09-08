import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { legendIsReadable, pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import {
  doesIntersect2,
  getPaletteHost,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import {
  allSessionTracks,
  annotationTrackIds,
  isSameAssemblyName,
  openAssemblyInLinearView,
} from '@jbrowse/core/util/tracks'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { cast, getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { sharedBackendKey } from '@jbrowse/render-core/sharedBackendKey'
import {
  bandGroundColor,
  bandInk,
  colorableColumns,
  declaredAttributes,
  lodMenuItems,
  lodTierAt,
  LodTierInfoMixin,
  resolveCategoricalMode,
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
import { captureStackViewports } from '../LinearSyntenyViewHelper/offscreenMateNav.ts'
import { isNamedRecord } from '../syntenyMate.ts'
import { axisPlacement, axisSpan } from './anchorAxis.ts'
import LaneSelectionDialog from './components/LaneSelectionDialog.tsx'
import { composeLaneLinks } from './composeLaneLinks.ts'
import { annotationRank } from './laneAnnotation.ts'
import { frameFromDecision } from './laneDecision.ts'
import { lanePanelsForRegion } from './lanePanels.ts'
import { buildLanes, laneContentHeight, laneGeometry } from './laneStack.ts'
import {
  groupFeatures,
  laneFetchRegion,
  rowAssembliesOf,
  tickIntervalFor,
} from './layoutMultiWay.ts'
import { laneColorKey, ribbonColorKey } from './legend.ts'
import {
  laneOrderMenuItem,
  laneSelectionMenuItems,
  laneSettingsMenuItems,
  mergeRowOrder,
} from './menus.ts'
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
} from './multiwayGeometry.ts'
import { multiwayBlocks } from './multiwayMarks.ts'
import { ribbonParams } from './multiwayRenderTypes.ts'
import { coerceRibbonColorBy, featureLabelTable } from './ribbonColorModes.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { AxisPlacement } from './anchorAxis.ts'
import type { LanePlacementRecord } from './composeLaneLinks.ts'
import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { AnchorCoord, LaneDecision } from './laneDecision.ts'
import type { Lane, LaneStack } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { LaneChoice } from './menus.ts'
import type { MultiWayRibbonColorBy, TickGeometry } from './multiwayGeometry.ts'
import type {
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
  MultiWayRenderingBackend,
} from './multiwayRenderTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  LegendItem,
  LegendSection,
  MenuItem,
  MouseState,
} from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AttributeRange, LodMode, LodTier } from '@jbrowse/synteny-core'
import type React from 'react'

/** what the pointer is over: a gene, a placement box or a ribbon */
export interface HoverTarget {
  label: string
  feature: Feature
  groupKey?: string
  targetIdx?: number
}

export interface LaneRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/**
 * One lane's share of a dependent fetch. `lane` is the held map's key — the
 * lane's assembly, or the pair a link fetch joins — and `key` is what the
 * lane's held result is stale against: the region it asked for.
 */
export interface LaneFetchSpec {
  lane: string
  key: string
}

export interface LaneGenesFetchSpec extends LaneFetchSpec {
  adapterConfig: Record<string, unknown>
  regions: LaneRegion[]
}

export interface LaneLinksFetchSpec extends LaneFetchSpec {
  upperAssembly: string
  lowerAssembly: string
  region: LaneRegion
  lodTier: LodTier
}

/** a lane's fetched result beside the region key it was fetched under */
export interface HeldLaneGenes {
  key: string
  genes: LaneGene[]
}

export interface HeldLaneLinks {
  key: string
  links: Feature[]
}

function regionKey(r: LaneRegion) {
  return `${r.refName}:${r.start}-${r.end}`
}

/**
 * The anchor a star source names in its `CoreGetInfo` header
 * (MultiPairwiseSyntenyAdapter's `anchorAssemblyName`); undefined for a header
 * that names none, which is every other adapter's.
 */
export function starAnchorOf(header: unknown) {
  return typeof header === 'object' &&
    header !== null &&
    'anchorAssemblyName' in header &&
    typeof header.anchorAssemblyName === 'string'
    ? header.anchorAssemblyName
    : undefined
}

export interface DeclaredLane {
  name: string
  label?: string
  group?: string
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

/**
 * The lanes an adapter declares in its `CoreGetInfo` header (`lanes`, each
 * with the assembly name its features' mates carry, and optionally the
 * source's own label and a grouping key); an empty list for a header that
 * declares none. A source that knows its lane universe up front, the way a
 * pangenome graph names every haplotype it holds, lets the picker offer the
 * whole of it before a fetch has placed any lane.
 */
export function declaredLanesOf(header: unknown): DeclaredLane[] {
  const lanes =
    typeof header === 'object' &&
    header !== null &&
    'lanes' in header &&
    Array.isArray(header.lanes)
      ? (header.lanes as unknown[])
      : []
  const out: DeclaredLane[] = []
  for (const lane of lanes) {
    if (
      typeof lane === 'object' &&
      lane !== null &&
      'name' in lane &&
      typeof lane.name === 'string'
    ) {
      out.push({
        name: lane.name,
        label: 'label' in lane ? optionalString(lane.label) : undefined,
        group: 'group' in lane ? optionalString(lane.group) : undefined,
      })
    }
  }
  return out
}

/** the specs whose lane holds nothing fetched under their key */
export function staleLaneSpecs<Spec extends LaneFetchSpec>(
  specs: Spec[],
  held: ReadonlyMap<string, { key: string }> | undefined,
) {
  return specs.filter(spec => held?.get(spec.lane)?.key !== spec.key)
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
         * Level-of-detail tier selection for tiered PIF adapters, the setting
         * the synteny view, dotplot and LGVSyntenyDisplay carry under the same
         * name: 'auto' uses the adapter's bpPerPx threshold; 'fine' pins the
         * per-row CIGAR tier; 'coarse' the tier whose CIGAR is folded to its
         * large indels
         */
        lodMode: types.stripDefault(
          types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        ),
        /**
         * #property
         * lanes to pin to the top, in order; lanes it does not name follow
         * densest-first, so the chain a ribbon draws through adjacent lanes is
         * cut as late as possible and most stacks need no order authored at
         * all. A declared property, so it is authorable from a session spec or
         * a config defaultSession
         */
        rowOrder: types.array(types.string),
        /**
         * #property
         * mate lanes taken out of the stack, so a genome that places nothing
         * in the region of interest stops holding a slot between two that do
         */
        hiddenLanes: types.array(types.string),
        /**
         * #property
         * the lanes the reader chose from the picker, by assembly name, and
         * the only lanes the stack then draws; undefined is every lane the
         * source places, or the config's `lanes` where that names some. Held
         * here rather than in the adapter's config because it is a choice
         * about this session's picture, made in front of it, and one a
         * shared session should carry
         */
        selectedLanes: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       * per declared column, the labels every fetch since the ribbon mode was
       * picked has carried, in first-seen order; see `ribbonLabels`
       */
      seenRibbonLabels: {} as Record<string, AttributeRange>,
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
       * track when the source is an all-vs-all alignment file — the direct
       * records the file holds for that pair, at the lanes' own coordinates —
       * each beside the region key it was fetched under, merged per pair
       */
      laneLinks: undefined as Map<string, HeldLaneLinks> | undefined,
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
       * outline stays after the pointer leaves it, cleared by a click on
       * empty canvas or a refetch
       */
      clickedTarget: undefined as
        | { groupKey?: string; targetIdx?: number }
        | undefined,
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
       * the view's scroll offset the stack is laid out against, refreshed with
       * the decisions. Between refreshes a pan is one translate of the whole
       * stack (`dragOffsetPx`), not a relayout of every lane
       */
      renderOriginPx: 0,
    }))
    .actions(self => {
      function dropDirectLinkClick() {
        if (self.clickedTarget?.groupKey === undefined) {
          self.clickedTarget = undefined
        }
      }
      return {
        /**
         * #action
         */
        setFeatures(f: Feature[]) {
          self.features = f
          self.seenRibbonLabels = widenAttributeRanges(
            self.seenRibbonLabels,
            featureLabelTable(f, declaredAttributes(self.adapterConfig)),
          )
          dropDirectLinkClick()
        },
        /**
         * #action
         * a bare targetIdx addresses the outgoing targets array, so it goes
         * whenever the lanes rebuild; a group KEY re-resolves against the
         * rebuilt geometry and stays — load-bearing, since the click's own
         * widget resizes the view and that refetches
         */
        clearDirectLinkClick() {
          dropDirectLinkClick()
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
        setLaneLinks(fetched: Map<string, HeldLaneLinks>) {
          const held = new Map(self.laneLinks)
          for (const [pair, links] of fetched) {
            held.set(pair, links)
          }
          self.laneLinks = held
          dropDirectLinkClick()
        },
        /**
         * #action
         */
        setStarAnchor(assemblyName: string | undefined) {
          self.starAnchor = assemblyName
        },
        /**
         * #action
         */
        setLaneFrames(
          originPx: number,
          decisions: Map<string, LaneDecision | undefined>,
        ) {
          self.renderOriginPx = originPx
          self.laneDecisions = decisions
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
         */
        setRowOrder(order: string[]) {
          self.rowOrder.replace(mergeRowOrder([...self.rowOrder], order))
        },
        /**
         * #action
         * back to densest-first. Its own action rather than `setRowOrder([])`,
         * which now means "here is the order of the lanes I can see" and would
         * keep every lane the caller could not
         */
        resetRowOrder() {
          self.rowOrder.clear()
        },
        /**
         * #action
         */
        setHiddenLanes(names: string[]) {
          self.hiddenLanes.replace(names)
        },
        /**
         * #action
         */
        setDeclaredLanes(lanes: DeclaredLane[]) {
          self.declaredLanes = lanes
        },
        /**
         * #action
         * undefined puts the choice back to every lane the source places
         */
        setSelectedLanes(names: string[] | undefined) {
          self.selectedLanes = names === undefined ? undefined : cast(names)
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
        setRibbonColorBy(mode: MultiWayRibbonColorBy) {
          setConf(self, 'ribbonColorBy', mode)
          // the way back from a label order one window fixed: the ribbons in
          // hand re-key from what is loaded
          self.seenRibbonLabels = {}
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
        setLodMode(mode: LodMode) {
          self.lodMode = mode
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
        return lodTierAt(self, self.host.coarseBpPerPx, self.lodMode)
      },
      /**
       * #getter
       * the same tier off the live zoom, for `dataSuperseded`
       */
      get liveLodTier() {
        return lodTierAt(self, self.lgv.bpPerPx, self.lodMode)
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
       * an alignment-level source (all-vs-all PAF) names nothing, which is
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
        return getConf(self, 'ribbonColor')
      },
      /**
       * #getter
       */
      get ribbonColorBy(): MultiWayRibbonColorBy {
        return coerceRibbonColorBy(getConf(self, 'ribbonColorBy'))
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
       * the label table an `attribute:` ribbon mode paints from: every label
       * seen in any fetch since the mode was picked, in first-seen order, so
       * a pan adds labels at the end and recolors nothing. Undefined for the
       * fixed modes, and for a column no loaded row carries as text
       */
      get ribbonLabels() {
        return resolveCategoricalMode(
          getConf(self, 'ribbonColorBy'),
          self.seenRibbonLabels,
        )
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
       * every feature id a lane can draw — the group features and the lane
       * genes, which is what `laneGlyphCells` colors. Rebuilt per fetch
       * commit, not per frame
       */
      get ownFeatureIds() {
        const out = new Set<string>()
        for (const f of self.features ?? []) {
          out.add(f.id())
        }
        for (const { genes } of self.laneGenes?.values() ?? []) {
          for (const g of genes) {
            out.add(g.feature.id())
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the `color` and `utrColor` slots resolved per feature a lane draws —
       * every lane's genes, and the groups' own records for the placement
       * boxes — keyed by feature id. Off the fetched sets and the config
       * alone: a settle rebuilds every lane's cells against this map, so a
       * settle runs no jexl
       */
      get glyphColors() {
        const { configuration } = self
        const color = new Map<string, string>()
        const utrColor = new Map<string, string>()
        for (const { feature } of self.groups) {
          color.set(
            feature.id(),
            readConfObject(configuration, 'color', { feature }),
          )
        }
        for (const { genes } of self.laneGenes?.values() ?? []) {
          for (const { feature } of genes) {
            const id = feature.id()
            color.set(id, readConfObject(configuration, 'color', { feature }))
            utrColor.set(
              id,
              readConfObject(configuration, 'utrColor', { feature }),
            )
          }
        }
        return { color, utrColor }
      },
      /**
       * #getter
       * the session selection where it names a feature THIS display draws,
       * else undefined — the gate that keeps a selection in some other track
       * from recomputing and re-uploading every lane's glyph cells, since an
       * unchanged undefined invalidates nothing downstream
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            const id = selection.id()
            return self.ownFeatureIds.has(id) ? id : undefined
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
       * whether the adapter type says its header declares the lane universe
       * (`adapterCapabilities: ['headerLanes']`), which is what earns an
       * untiered adapter a header read
       */
      get adapterDeclaresLanes(): boolean {
        const type = self.adapterConfig.type
        return (
          typeof type === 'string' &&
          getEnv(self)
            .pluginManager.getAdapterType(type)
            .adapterCapabilities.includes('headerLanes')
        )
      },
      /**
       * #getter
       * the lanes in force: the reader's choice, else the config's `lanes`
       * where it names any, else undefined for every lane the source places
       */
      get laneSelection(): readonly string[] | undefined {
        const configured: string[] = readConfObject(self.configuration, 'lanes')
        return (
          self.selectedLanes ?? (configured.length ? configured : undefined)
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get anchorAssembly() {
        return getSession(self).assemblyManager.get(self.anchorAssemblyName)
      },
      /**
       * #getter
       */
      get anchorLocString() {
        return self.lgv.visibleLocStrings
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
       * #method
       */
      pinnedContigOf(assemblyName: string) {
        return self.pinnedLaneContigs.get(assemblyName)
      },
      /**
       * #getter
       * every lane the picker can offer: the header's declared lanes, in the
       * order the source gave them, then any lane the fetched window places
       * that the header did not name. The anchor is never a lane. Exact names
       * throughout, since the header and the features are one adapter's
       * spelling of the same lanes
       */
      get laneUniverse(): LaneChoice[] {
        const { assemblyManager } = getSession(self)
        const anchor = self.anchorAssemblyName
        const placed = new Set(
          rowAssembliesOf(self.groups, [], (a, b) =>
            isSameAssemblyName(a, b, assemblyManager),
          ).filter(name => !isSameAssemblyName(name, anchor, assemblyManager)),
        )
        const out: LaneChoice[] = []
        const named = new Set<string>()
        for (const lane of self.declaredLanes ?? []) {
          if (
            !named.has(lane.name) &&
            !isSameAssemblyName(lane.name, anchor, assemblyManager)
          ) {
            named.add(lane.name)
            out.push({ ...lane, placed: placed.has(lane.name) })
          }
        }
        for (const name of placed) {
          if (!named.has(name)) {
            named.add(name)
            out.push({ name, placed: true })
          }
        }
        return out
      },
      /**
       * #getter
       * mate assemblies densest-first, one lane each below the anchor lane,
       * with any `rowOrder` lanes pinned above them, narrowed to the lane
       * selection where one is in force. A paralogy record's mate is the
       * anchor assembly itself; those draw on the anchor's own axis rather
       * than as a lane
       */
      get rowAssemblies() {
        const { assemblyManager } = getSession(self)
        const sameName = (a: string, b: string) =>
          isSameAssemblyName(a, b, assemblyManager)
        const selection = self.laneSelection
        return rowAssembliesOf(
          self.groups,
          [...self.rowOrder],
          sameName,
        ).filter(
          assemblyName =>
            !sameName(assemblyName, self.anchorAssemblyName) &&
            !self.hiddenLanes.some(hidden => sameName(hidden, assemblyName)) &&
            (selection === undefined ||
              selection.some(chosen => sameName(chosen, assemblyName))),
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
       * the groups whose anchor placement is inside the settled viewport —
       * the population every lane's local frame is fitted to, so panning the
       * anchor re-lays-out the other lanes
       */
      get visibleGroups() {
        const view = self.lgv
        const assembly = self.anchorAssembly
        return view.initialized && assembly
          ? self.groups.filter(group => {
              const refName = assembly.getCanonicalRefName2(
                group.anchor.refName,
              )
              return view.settledDynamicBlocks.some(
                block =>
                  block.refName === refName &&
                  doesIntersect2(
                    block.start,
                    block.end,
                    group.anchor.start,
                    group.anchor.end,
                  ),
              )
            })
          : []
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
       * per lane, the session's own gene track for that assembly: the
       * best-ranked feature track declared for it alone. The real pipelines
       * this display connects to (jcvi MCScan, HPRC CAT) derive their gene BEDs
       * from exactly these annotations, so the lane's exon structure comes
       * from the file the table was built from.
       *
       * RANKED, not a set. GFF3 only was too narrow — a lane annotated by a
       * GTF or a BigBed read as `· no annotation`, which is the header
       * asserting something false about a track sitting in the same session,
       * with no error to debug from. But a flat widening picks by declaration
       * order, and the config shape this display meets (`hg38-genes` beside
       * `hg38-rmsk`) has the repeats in BED and the genes in GFF3 — so
       * "anything with features" would newly prefer the repeats. Rank instead,
       * and the old behaviour is what the top rank already gives.
       */
      get laneGeneAdapters() {
        const session = getSession(self)
        const { assemblyManager } = session
        const lanes = [self.anchorAssemblyName, ...self.rowAssemblies]
        const best = new Map<
          string,
          { rank: number; track: AnyConfigurationModel }
        >()
        // the tracks the "Open assembly" hop brings along, connections
        // included, so a lane annotated through one does not read as bare
        for (const track of allSessionTracks(session)) {
          const names = readConfObject(track, 'assemblyNames') as string[]
          const type: unknown = readConfObject(track, ['adapter', 'type'])
          const rank = annotationRank(
            typeof type === 'string' ? type : undefined,
          )
          if (names.length === 1 && rank !== undefined) {
            // every lane the track answers for, not the first: two mates can
            // spell one assembly two ways and both lanes draw from the one
            // track
            for (const lane of lanes) {
              const held = best.get(lane)
              if (
                (held === undefined || rank < held.rank) &&
                isSameAssemblyName(names[0], lane, assemblyManager)
              ) {
                best.set(lane, { rank, track })
              }
            }
          }
        }
        const out = new Map<string, Record<string, unknown>>()
        for (const [lane, { track }] of best) {
          out.set(
            lane,
            readConfObject(track, 'adapter') as Record<string, unknown>,
          )
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `TrackHeightMixin`'s hook: 0 — no scroll, today's divide-the-height
       * layout — until the lane count pushes the stack past the track height
       */
      get scrollableHeight() {
        return self.scrollContentHeight - self.height
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
       * #getter
       * each mate lane's local coordinate frame: the settle's decision
       * against where the view draws its pivot now
       */
      get rowFrames(): Map<string, RowFrame | undefined> {
        const view = self.lgv
        const out = new Map<string, RowFrame | undefined>()
        for (const assemblyName of self.rowAssemblies) {
          const decision = self.laneDecisions.get(assemblyName)
          const pivot = decision && view.bpToPx(decision.pivotAnchor)
          out.set(
            assemblyName,
            decision && pivot
              ? frameFromDecision(
                  decision,
                  pivot.offsetPx - self.renderOriginPx,
                  self.visibleBpSpan,
                  self.canvasWidth,
                  self.anchorReversed,
                )
              : undefined,
          )
        }
        return out
      },
    }))
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
          const regions = view.staticBlocks.contentBlocks.map(block => ({
            assemblyName: self.anchorAssemblyName,
            refName: block.refName,
            start: Math.max(0, Math.floor(block.start)),
            end: Math.ceil(block.end),
          }))
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
       * one spec per ADJACENT mate-lane pair when the source is an all-vs-all
       * alignment file: the upper lane's window queried against the lower
       * lane's assembly at the settled tier, which an all-vs-all adapter
       * answers with the direct records it holds for that pair. None for a
       * source that announced itself a star, which holds no such rows. Only
       * pairs the session holds both assemblies of: the fetch renames its
       * region through the assembly manager, which refuses a PanSN sample the
       * config never declared, and an all-vs-all file routinely carries more
       * of those than the config names
       */
      get laneLinksFetchSpecs(): LaneLinksFetchSpec[] {
        const specs: LaneLinksFetchSpec[] = []
        if (self.featuresAreNameless && self.starAnchor === undefined) {
          const { lodTier } = self
          const rows = self.rowAssemblies
          for (let i = 0; i + 1 < rows.length; i++) {
            const upperAssembly = rows[i]!
            const lowerAssembly = rows[i + 1]!
            const upper = self.rowFrames.get(upperAssembly)
            const lower = self.rowFrames.get(lowerAssembly)
            if (
              upper &&
              lower &&
              self.holdsAssembly(upperAssembly) &&
              self.holdsAssembly(lowerAssembly)
            ) {
              const region = {
                assemblyName: upperAssembly,
                ...laneFetchRegion(upper),
              }
              specs.push({
                lane: `${upperAssembly}|${lowerAssembly}`,
                key: `${regionKey(region)}|${lodTier}`,
                upperAssembly,
                lowerAssembly,
                region,
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
        const view = self.lgv
        return buildLanes({
          assemblyNames: [self.anchorAssemblyName, ...self.rowAssemblies],
          groups: self.visibleGroups,
          anchorSpans: self.anchorSpans,
          rowFrames: self.rowFrames,
          laneGeneAdapters: self.laneGeneAdapters,
          axisSpanOf: (refName, start, end) =>
            axisSpan(view, refName, start, end, self.renderOriginPx),
          refNameAliasOf: assemblyName => {
            const assembly = assemblyManager.get(assemblyName)
            return (
              assembly && (refName => assembly.getCanonicalRefName2(refName))
            )
          },
          width: self.canvasWidth,
          height: self.height,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the direct records between each adjacent mate-lane pair as the
       * ribbons read them: the pair's fetched links where the file holds any,
       * else — a star of pairwise alignments states none, whether it
       * announced itself one or its pair fetch came back empty — the links
       * composed through the anchor from the groups, one record per placement
       * either lane makes. Off the fetched sets alone, never the frames, so a
       * settle recomposes nothing
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
            (self.starAnchor !== undefined || fetched !== undefined)
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
      get palette() {
        return getPaletteHost(self).palette
      },
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
          ribbonColorBy: self.ribbonColorBy,
          ribbonLabels: self.ribbonLabels,
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
            bands: laneGeometry(self.height, 1 + self.rowAssemblies.length)
              .rows,
            width: self.canvasWidth,
            paper: bandGroundColor(),
            stripe: bandInk().stripe,
          }),
        }
      },
      /**
       * #getter
       * two cells per lane — its gene models and baseline, and its placement
       * boxes — since only the boxes carry an outline. Boxes first, so a hit
       * test walking these in order answers the box over the gene the way the
       * draw order does. Colors come off `glyphColors`, so neither the hover —
       * a render parameter — nor a settle re-runs a jexl slot
       */
      get laneGlyphCells() {
        const { palette, selectedFeatureId, laneGenes, glyphColors } = self
        const { lanes, glyphHeight } = self.laneStack
        const ink = bandInk()
        const colorOf = (slot: 'color' | 'utrColor', feature: Feature) =>
          selectedFeatureId === feature.id()
            ? palette.highlight.main
            : (glyphColors[slot].get(feature.id()) ??
              readConfObject(self.configuration, slot, { feature }))
        const out = new Map<string, MultiWayCell>()
        lanes.forEach((lane, row) => {
          const { glyphs, boxes } = buildLaneCells({
            lane,
            genes: laneGenes?.get(lane.assemblyName)?.genes ?? [],
            glyphHeight,
            width: self.canvasWidth,
            colors: {
              colorOf,
              stroke: ink.text,
              divider: ink.divider,
            },
          })
          out.set(boxesKey(row), { kind: 'glyphs', data: boxes })
          out.set(glyphsKey(row), { kind: 'glyphs', data: glyphs })
        })
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The key for the glyph colors, read off the anchor lane: it is the one
       * lane whose color for a group runs down every chain the stack draws, and
       * keying every lane instead would spend a row on each strain's private
       * genes and blow the bound on the window where the chains are the point.
       *
       * `MAX_LEGEND_ENTRIES` rather than `legendIsReadable`'s own default,
       * because this is a derived key and that is the bound a derived key stops
       * being one at.
       */
      get geneLegend(): LegendItem[] {
        const hits = [boxesKey(0), glyphsKey(0)].flatMap(key => {
          const cell = self.laneGlyphCells.get(key)
          return cell?.kind === 'glyphs' ? cell.data.hits : []
        })
        const items = laneColorKey(
          hits,
          [-self.dragOffsetPx, self.canvasWidth - self.dragOffsetPx],
          feature => self.glyphColors.color.get(feature.id()),
        )
        return legendIsReadable(items, MAX_LEGEND_ENTRIES) ? items : []
      },
      /**
       * #getter
       * what the ribbons' own colors mean, which is the strand pair or nothing:
       * one flat color keys nothing and the identity ramp is not a row list
       */
      get ribbonLegend(): LegendItem[] {
        return ribbonColorKey(
          self.ribbonColorBy,
          self.drawCurves,
          self.ribbonLabels,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the two color vocabularies as their own sections, so each is titled and
       * dismissed on its own, and neither claims the other's marks. Empty
       * sections are dropped here rather than by the two renderers, so
       * `hasLegendKey` and the box agree about whether there is a key
       */
      get legendSections(): LegendSection[] {
        return [
          { id: 'genes', title: 'Gene colors', items: self.geneLegend },
          { id: 'ribbons', title: 'Ribbon colors', items: self.ribbonLegend },
        ].filter(section => section.items.length > 0)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * whether there is a key at all, which is what "Show legend" is offered
       * on: the colors here are the config's to encode, and a track that paints
       * one flat color has nothing for a key to say
       */
      get hasLegendKey() {
        return self.legendSections.length > 0
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
            { kind: 'glyphs', key: glyphsKey(row), scrolled: true },
            { kind: 'glyphs', key: boxesKey(row), scrolled: true },
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
        const { hoveredGroupKey, hoverTarget } = self
        const idx =
          hoveredGroupKey !== undefined
            ? self.ribbonGeometry.groupTarget.get(hoveredGroupKey)
            : hoverTarget?.targetIdx
        return idx === undefined ? 0 : idx + 1
      },
      /**
       * #getter
       * the clicked twin, resolved the same way — a group key survives a
       * relayout, a direct-link index only its own fetch
       */
      get clickedFeatureId() {
        const { clickedTarget } = self
        const idx =
          clickedTarget?.groupKey !== undefined
            ? self.ribbonGeometry.groupTarget.get(clickedTarget.groupKey)
            : clickedTarget?.targetIdx
        return idx === undefined ? 0 : idx + 1
      },
      /**
       * #getter
       * the hovered group's placement in every lane that places it
       */
      get hoveredGroupOutlines(): { lane: Lane; span: Span }[] {
        const { hoveredGroupKey } = self
        if (hoveredGroupKey === undefined) {
          return []
        }
        return self.laneStack.lanes.flatMap(lane =>
          (lane.placements.get(hoveredGroupKey)?.spans ?? []).map(span => ({
            lane,
            span,
          })),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the clicked group's outline in every gutter that draws it — its own
       * cell beside the gutter's, so a selection re-uploads the records the
       * outline traces rather than the gutter's whole buffer, and a pan
       * re-uploads nothing. Ticks are left out: no tick carries a feature id
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
        const clicked = self.clickedFeatureId > 0
        for (const layer of self.namedLayers) {
          out.set(sharedBackendKey(layer.key), layer)
          if (clicked && layer.kind === 'ribbons') {
            const key = outlineKey(layer.key)
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
       * what a frame draws with: the cells' layout and the one live transform
       */
      get renderState(): MultiWayRenderState {
        return {
          canvasWidth: self.canvasWidth,
          canvasHeight: self.height,
          dragOffsetPx: self.dragOffsetPx,
          scrollTopPx: self.scrollTop,
          hoveredFeatureId: self.hoveredFeatureId,
          clickedFeatureId: self.clickedFeatureId,
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
        const ox = x - self.dragOffsetPx
        const oy = y + self.scrollTop
        const { lanes, glyphHeight } = self.laneStack
        const row = lanes.findIndex(
          lane => oy >= lane.glyphTop && oy <= lane.glyphTop + glyphHeight,
        )
        for (const key of row < 0 ? [] : [boxesKey(row), glyphsKey(row)]) {
          const cell = self.laneGlyphCells.get(key)
          if (cell?.kind === 'glyphs') {
            const hit = glyphHitAt(cell.data.hits, ox, oy)
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
        if (hit) {
          // the pick answers an INSTANCE; the target is what that instance's
          // feature index names, which is the gutter cell's own lane
          const targetIdx = self.ribbonRegions.get(hit.key)?.instanceFeatureIdx[
            hit.instanceIndex
          ]
          const target =
            targetIdx === undefined
              ? undefined
              : self.ribbonGeometry.targets[targetIdx]
          if (target && targetIdx !== undefined) {
            return {
              label: target.label,
              feature: target.feature,
              groupKey: target.groupKey,
              targetIdx,
            }
          }
        }
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `FetchMixin`'s hook: the dependent fetches are part of loading until
       * they FIRST land, so an export or a capture never lands between the
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
            genes.length > 1) ||
          (self.laneLinks === undefined && self.laneLinksFetchSpecs.length > 0)
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
          self.lodTier !== self.liveLodTier
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
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         * the same multi-panel launch the view menu and the rubberband offer,
         * from the track that is already showing the lanes: every genome
         * aligning to the visible window gets a full row of its own in a
         * stacked linear synteny view, cut from this track's dataset.
         * Appended to the inherited items rather than replacing them, so a
         * mixin's item is not dropped by being composed under this one
         */
        trackMenuItems(): MenuItem[] {
          const view = self.lgv
          const items = [...superMenuItems()]
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
                trackAssemblyNames: readConfObject(
                  self.parentTrack.configuration,
                  'assemblyNames',
                ) as string[],
              }),
            starAnchor: self.starAnchor,
          })) {
            pushLaunchViewMenuItem(items, item)
          }
          return [
            ...items,
            { type: 'divider' },
            ...laneSettingsMenuItems(self),
            ...lodMenuItems(self),
            ...laneSelectionMenuItems(self),
            ...laneOrderMenuItem(self),
          ]
        },
      }
    })
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
       * and the session's annotation for the genome. Keyed on the display and
       * the lane, so following one lane twice re-navigates the view
       */
      openInNewView(assemblyName: string, loc: string) {
        const session = getSession(self)
        openAssemblyInLinearView({
          session,
          id: `${self.id}-mate-${assemblyName}`,
          assemblyName,
          loc,
          tracks: [
            self.parentTrack.configuration.trackId as string,
            ...annotationTrackIds(session, assemblyName),
          ],
        }).catch((e: unknown) => {
          session.notifyError(`${e}`, e)
        })
      },
      /**
       * #action
       * the hosting view onto `assemblyName` at `loc`; the anchor lane reads
       * off the view's first assembly, so the stack re-anchors on its own
       */
      reanchor(assemblyName: string, loc: string) {
        const session = getSession(self)
        const view = self.lgv
        // the same undo the stacked view's moves offer: the navigation
        // replaces the view's regions with another genome's, and what it
        // discarded may be a region list built over several navigations
        const restore = captureStackViewports([view])
        view
          .navToLocString(loc, assemblyName)
          .then(landed => {
            if (landed) {
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
          targetIdx: hoverTarget.targetIdx,
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
