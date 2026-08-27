import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  doesIntersect2,
  getContainingView,
  getPaletteHost,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import GlobalFetchMixin, {
  blockKeySignature,
} from '@jbrowse/display-kit/GlobalFetchMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { foundationDisplayPhase } from '@jbrowse/display-kit/foundationDisplayPhase'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import {
  syntenyRegionMenuItems,
  widestRegion,
} from '../LaunchSyntenyView/regionLaunchMenuItems.ts'
import { axisPlacement, axisSpan } from './anchorAxis.ts'
import { frameFromDecision } from './laneDecision.ts'
import { buildLanes, laneGeometry } from './laneStack.ts'
import {
  groupFeatures,
  laneFetchRegion,
  rowAssembliesOf,
  tickIntervalFor,
} from './layoutMultiWay.ts'
import { laneOrderMenuItem, laneSettingsMenuItems } from './menus.ts'
import {
  BANDS_KEY,
  buildBandCell,
  buildLaneGlyphCell,
  buildRibbonGeometry,
  buildTickGeometry,
  glyphHitAt,
  glyphsKey,
} from './multiwayGeometry.ts'

import type { AxisPlacement } from './anchorAxis.ts'
import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { AnchorCoord, LaneDecision } from './laneDecision.ts'
import type { Lane, LaneStack } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { TickGeometry } from './multiwayGeometry.ts'
import type {
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
  MultiWayRenderingBackend,
} from './multiwayRenderTypes.ts'
import type { MenuItem, MouseState } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
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

export interface LaneGenesFetchSpec {
  assemblyName: string
  adapterConfig: Record<string, unknown>
  regions: LaneRegion[]
}

export interface LaneLinksFetchSpec {
  upperAssembly: string
  lowerAssembly: string
  region: LaneRegion
}

// what a fetch is stale against: the region it asked for, spelled once
function regionKey(r: LaneRegion) {
  return `${r.refName}:${r.start}-${r.end}`
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
         * lanes to pin to the top, in order; lanes it does not name follow
         * densest-first, so the chain a ribbon draws through adjacent lanes is
         * cut as late as possible and most stacks need no order authored at
         * all. A declared property, so it is authorable from a session spec or
         * a config defaultSession
         */
        rowOrder: types.array(types.string),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       * per-lane gene models fetched from each assembly's own gene track, so a
       * lane draws real exon structure at that genome's coordinates
       */
      laneGenes: undefined as Map<string, LaneGene[]> | undefined,
      /**
       * #volatile
       */
      laneGenesKey: '',
      /**
       * #volatile
       * alignments between ADJACENT mate lanes, fetched per pair from the same
       * track when the source is an all-vs-all alignment file — the direct
       * records the file holds for that pair, at the lanes' own coordinates
       */
      laneLinks: undefined as Map<string, Feature[]> | undefined,
      /**
       * #volatile
       */
      laneLinksKey: '',
      /**
       * #volatile
       * the ortholog group under the pointer; every ribbon of that group
       * highlights, so one hover reads the group across all lanes
       */
      hoveredGroupKey: undefined as string | undefined,
      /**
       * #volatile
       * the glyph, box or ribbon under the pointer — what a click opens and
       * the tooltip names
       */
      hoverTarget: undefined as HoverTarget | undefined,
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
       * the view's scroll offset the stack is laid out against, refreshed with
       * the decisions. Between refreshes a pan is one translate of the whole
       * stack (`dragOffsetPx`), not a relayout of every lane
       */
      renderOriginPx: 0,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.features = f
      },
      /**
       * #action
       */
      setLaneGenes(key: string, genes: Map<string, LaneGene[]>) {
        self.laneGenesKey = key
        self.laneGenes = genes
      },
      /**
       * #action
       */
      setLaneLinks(key: string, links: Map<string, Feature[]>) {
        self.laneLinksKey = key
        self.laneLinks = links
      },
      /**
       * #action
       */
      setHoveredGroupKey(key: string | undefined) {
        self.hoveredGroupKey = key
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
       */
      setRowOrder(order: string[]) {
        self.rowOrder.replace(order)
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
    }))
    .views(self => ({
      /**
       * #getter
       * the hosting linear genome view. `GlobalFetchMixin` hands down the
       * view-shaped `host` its own gating needs; a display reaching LGV's own
       * geometry names it itself, the way the arc displays do
       */
      get lgv() {
        return getContainingView(self) as LinearGenomeViewModel
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
       * staleness axis is the static-block set, same as arc: pan/zoom past a
       * block boundary refetches, a scroll inside the loaded blocks does not
       */
      get viewSignature() {
        const view = self.lgv
        return view.initialized
          ? blockKeySignature(view.staticBlocks.contentBlocks)
          : undefined
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
          self.features.every(f => f.get('name') === undefined)
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
      get drawCurves(): boolean {
        return getConf(self, 'drawCurves')
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
       */
      get anchorAssembly() {
        return getSession(self).assemblyManager.get(self.anchorAssemblyName)
      },
      /**
       * #getter
       * mate assemblies densest-first, one lane each below the anchor lane,
       * with any `rowOrder` lanes pinned above them. A paralogy record's mate
       * is the anchor assembly itself; those draw on the anchor's own axis
       * rather than as a lane
       */
      get rowAssemblies() {
        const { assemblyManager } = getSession(self)
        const sameName = (a: string, b: string) =>
          isSameAssemblyName(a, b, assemblyManager)
        return rowAssembliesOf(
          self.groups,
          [...self.rowOrder],
          sameName,
        ).filter(
          assemblyName => !sameName(assemblyName, self.anchorAssemblyName),
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
       * per lane, the session's own gene track for that assembly: the first
       * GFF3 feature track declared for it alone. The real pipelines this
       * display connects to (jcvi MCScan, HPRC CAT) derive their gene BEDs
       * from exactly these annotations, so the lane's exon structure comes
       * from the file the table was built from
       */
      get laneGeneAdapters() {
        const session = getSession(self)
        const { assemblyManager } = session
        const lanes = [self.anchorAssemblyName, ...self.rowAssemblies]
        const out = new Map<string, Record<string, unknown>>()
        for (const track of session.tracks) {
          const names = readConfObject(track, 'assemblyNames') as string[]
          const adapter = readConfObject(track, 'adapter') as {
            type?: string
          } | null
          if (names.length !== 1 || !adapter?.type?.startsWith('Gff3')) {
            continue
          }
          // every lane the track answers for, not the first: two mates can
          // spell one assembly two ways and both lanes draw from the one track
          for (const lane of lanes) {
            if (
              !out.has(lane) &&
              isSameAssemblyName(names[0], lane, assemblyManager)
            ) {
              out.set(lane, adapter as Record<string, unknown>)
            }
          }
        }
        return out
      },
    }))
    .views(self => ({
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
      get laneGenesFetchSpecs() {
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
              assemblyName: self.anchorAssemblyName,
              adapterConfig: anchorAdapter,
              regions,
            })
          }
          for (const [assemblyName, frame] of self.rowFrames) {
            const adapter = adapters.get(assemblyName)
            if (adapter && frame) {
              specs.push({
                assemblyName,
                adapterConfig: adapter,
                regions: [{ assemblyName, ...laneFetchRegion(frame) }],
              })
            }
          }
        }
        return {
          key: specs
            .map(spec =>
              spec.regions
                .map(r => `${spec.assemblyName}:${regionKey(r)}`)
                .join(','),
            )
            .join(';'),
          specs,
        }
      },
      /**
       * #getter
       * one spec per ADJACENT mate-lane pair when the source is an all-vs-all
       * alignment file: the upper lane's window queried against the lower
       * lane's assembly, which an all-vs-all adapter answers with the direct
       * records it holds for that pair
       */
      get laneLinksFetchSpecs() {
        const specs: LaneLinksFetchSpec[] = []
        if (self.featuresAreNameless) {
          const rows = self.rowAssemblies
          for (let i = 0; i + 1 < rows.length; i++) {
            const upperAssembly = rows[i]!
            const lowerAssembly = rows[i + 1]!
            const upper = self.rowFrames.get(upperAssembly)
            const lower = self.rowFrames.get(lowerAssembly)
            if (upper && lower) {
              specs.push({
                upperAssembly,
                lowerAssembly,
                region: {
                  assemblyName: upperAssembly,
                  ...laneFetchRegion(upper),
                },
              })
            }
          }
        }
        return {
          key: specs
            .map(
              spec =>
                `${spec.upperAssembly}>${spec.lowerAssembly}:${regionKey(spec.region)}`,
            )
            .join(';'),
          specs,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the stack the picture is drawn from: one `Lane` per assembly, plus the
       * geometry every layer places against. Every layer — bands, ticks,
       * ribbons, glyphs, boxes, headers, the hover outline — is a walk over
       * this, and the on-screen body and the SVG export walk the same one
       */
      get laneStack(): LaneStack {
        const { assemblyManager } = getSession(self)
        const view = self.lgv
        return buildLanes({
          assemblyNames: [self.anchorAssemblyName, ...self.rowAssemblies],
          groups: self.visibleGroups,
          anchorSpans: self.anchorSpans,
          rowFrames: self.rowFrames,
          laneGenes: self.laneGenes,
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
          laneLinks: self.laneLinks,
          ribbonColor: self.ribbonColor,
          drawCurves: self.drawCurves,
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
              color: self.palette.gridlineMinor,
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
        const { palette } = self
        return {
          kind: 'glyphs',
          data: buildBandCell({
            bands: laneGeometry(self.height, 1 + self.rowAssemblies.length)
              .rows,
            width: self.canvasWidth,
            paper: palette.background.paper,
            stripe: palette.action.hover,
          }),
        }
      },
      /**
       * #getter
       * one cell per lane: its gene models, its placement boxes and its
       * baseline. The one place a jexl color slot is resolved per glyph, so
       * the hover — a render parameter — never re-runs it
       */
      get laneGlyphCells() {
        const { palette, selectedFeatureId } = self
        const { lanes, glyphHeight } = self.laneStack
        const colorOf = (slot: 'color' | 'utrColor', feature: Feature) =>
          selectedFeatureId === feature.id()
            ? palette.highlight.main
            : readConfObject(self.configuration, slot, { feature })
        const out = new Map<string, MultiWayCell>()
        lanes.forEach((lane, row) => {
          out.set(glyphsKey(row), {
            kind: 'glyphs',
            data: buildLaneGlyphCell({
              lane,
              glyphHeight,
              width: self.canvasWidth,
              colors: {
                colorOf,
                stroke: palette.text.primary,
                divider: palette.divider,
              },
            }),
          })
        })
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * everything the backend holds bytes for, keyed so an unchanged cell
       * keeps its identity across a rebuild of the map and uploads nothing
       */
      get renderCells(): ReadonlyMap<string, MultiWayCell> {
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
      get renderLayers(): MultiWayLayer[] {
        const { lanes } = self.laneStack
        return [
          { kind: 'glyphs', key: BANDS_KEY, scrolled: false },
          ...self.ribbonGeometry.layers,
          ...self.tickGeometry.layers,
          ...lanes.map((_lane, row): MultiWayLayer => ({
            kind: 'glyphs',
            key: glyphsKey(row),
            scrolled: true,
          })),
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
       * what a frame draws with: the cells' layout and the one live transform
       */
      get renderState(): MultiWayRenderState {
        return {
          width: self.canvasWidth,
          height: self.height,
          dragOffsetPx: self.dragOffsetPx,
          hoveredFeatureId: self.hoveredFeatureId,
          layers: self.renderLayers,
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * what sits under a container-relative point: a lane's glyph or box
       * first, since they draw over the ribbons, then a ribbon through the
       * backend's pick
       */
      hitTest(x: number, y: number): HoverTarget | undefined {
        const ox = x - self.dragOffsetPx
        for (const cell of self.laneGlyphCells.values()) {
          if (cell.kind === 'glyphs') {
            const hit = glyphHitAt(cell.data.hits, ox, y)
            if (hit) {
              return {
                label: hit.label,
                feature: hit.feature,
                groupKey: hit.groupKey,
              }
            }
          }
        }
        const backend = self.currentRenderingBackend as
          | MultiWayRenderingBackend
          | undefined
        const pick = backend?.pickRibbon(x, y, self.renderState)
        const target = pick && self.ribbonGeometry.targets[pick.targetIdx]
        return (
          target && {
            label: target.label,
            feature: target.feature,
            groupKey: target.groupKey,
            targetIdx: pick.targetIdx,
          }
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the dependent fetches are part of loading until they FIRST land, so an
       * export or a capture never lands between the ortholog fetch and the
       * gene models that fill the lanes. Not for later refetches: those run
       * over lanes that are already drawn, and holding the phase at loading
       * puts the striped scrim over them. A failed lane fetch commits an empty
       * result rather than hanging this at loading (see afterAttach)
       */
      get displayPhase(): DisplayPhase {
        const base = foundationDisplayPhase(
          self,
          () => true,
          () => self.host.effectiveBodyMounted,
        )
        const firstFetchPending =
          (self.laneGenes === undefined &&
            self.laneGenesFetchSpecs.specs.length > 0) ||
          (self.laneLinks === undefined &&
            self.laneLinksFetchSpecs.specs.length > 0)
        return base === 'ready' && firstFetchPending ? 'loading' : base
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
          return [
            ...superMenuItems(),
            ...syntenyRegionMenuItems({
              label: 'Launch stacked synteny view (visible region)',
              region: widestRegion(view.dynamicBlocks.contentBlocks),
              session: getSession(self),
              openTracks: [self.parentTrack.configuration],
              anchorTracks: anchorPanelTracks(view.tracks),
              sourceView: view,
            }),
            { type: 'divider' },
            ...laneSettingsMenuItems(self),
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
       */
      setHoverTarget(target: HoverTarget | undefined) {
        self.hoverTarget = target
        self.hoveredGroupKey = target?.groupKey
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
            b.render(self.renderState)
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
        self.setHoverTarget(state ? self.hitTest(state.x, state.y) : undefined)
      },
      /**
       * #action
       */
      selectHovered() {
        if (self.hoverTarget) {
          self.selectFeature(self.hoverTarget.feature)
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as MultiWaySyntenyDisplayModel)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
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
