import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  doesIntersect2,
  getContainingView,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import GlobalFetchMixin, {
  blockKeySignature,
} from '@jbrowse/display-kit/GlobalFetchMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { foundationDisplayStatusPhase } from '@jbrowse/display-kit/foundationDisplayPhase'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import {
  syntenyRegionMenuItems,
  widestRegion,
} from '../LaunchSyntenyView/regionLaunchMenuItems.ts'
import {
  alignRowFrames,
  groupFeatures,
  laneFetchRegion,
  rowAssembliesOf,
  tickIntervalFor,
} from './layoutMultiWay.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type React from 'react'

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

/**
 * #stateModel MultiWaySyntenyDisplay
 * #displayFoundation GlobalFetchMixin
 * draws a multi-genome ortholog track (an adapter whose features carry a
 * `mate` per other assembly, e.g. MCScanBlocksAdapter) as one lane per
 * assembly inside a plain linear genome view. The top lane is the view's own
 * assembly at genomic coordinates; every other lane is laid out in its own
 * local coordinate frame fitted to the viewport — non-anchored, the same move
 * the multi-sample variant matrix makes — with ribbons connecting each gene's
 * placements between adjacent lanes. Rendered as main-thread SVG like the arc
 * displays.
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
      laneGenes: undefined as Map<string, Feature[]> | undefined,
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
      setLaneGenes(key: string, genes: Map<string, Feature[]>) {
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
       */
      get painted(): boolean {
        return self.features !== undefined || !!self.error
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
          const lane = lanes.find(assemblyName =>
            isSameAssemblyName(names[0], assemblyName, assemblyManager),
          )
          if (lane !== undefined && !out.has(lane)) {
            out.set(lane, adapter as Record<string, unknown>)
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * where the anchor lane draws each visible group, in canvas px, in the
       * anchor's own direction — start end first, so a horizontally flipped
       * view hands the ribbons the crossed pair it is drawing.
       *
       * The view's own `bpToPx`, which is the only honest answer: it is
       * piecewise over the displayed regions and no `RowFrame` can stand in
       * for it. Read both by the lane-alignment seed and by the anchor lane's
       * own ribbons, so "the lanes line up against where the anchor actually
       * draws" holds by construction rather than by two loops agreeing
       */
      get anchorSpans(): Map<string, Span> {
        const view = self.lgv
        const assembly = self.anchorAssembly
        const out = new Map<string, Span>()
        if (!view.initialized || !assembly) {
          return out
        }
        for (const group of self.visibleGroups) {
          const refName = assembly.getCanonicalRefName2(group.anchor.refName)
          const a = view.bpToPx({ refName, coord: group.anchor.start })
          const b = view.bpToPx({ refName, coord: group.anchor.end })
          if (a !== undefined && b !== undefined) {
            out.set(group.key, [
              a.offsetPx - view.offsetPx,
              b.offsetPx - view.offsetPx,
            ])
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the first link of the alignment chain: each group's anchor center in
       * canvas px, which is what every lane below lines up against
       */
      get anchorSeedX(): Map<string, number> {
        return new Map(
          [...self.anchorSpans].map(([key, [x1, x2]]) => [key, (x1 + x2) / 2]),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each mate lane's local coordinate frame
       */
      get rowFrames(): Map<string, RowFrame | undefined> {
        return alignRowFrames(
          self.visibleGroups,
          self.rowAssemblies,
          self.anchorSeedX,
          self.visibleBpSpan,
          self.canvasWidth,
        )
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
                .map(
                  r => `${spec.assemblyName}:${r.refName}:${r.start}-${r.end}`,
                )
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
                `${spec.upperAssembly}>${spec.lowerAssembly}:${spec.region.refName}:${spec.region.start}-${spec.region.end}`,
            )
            .join(';'),
          specs,
        }
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
      get displayPhase(): DisplayStatusPhase {
        const base = foundationDisplayStatusPhase(self, () => true)
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
      setRowOrder(order: string[]) {
        self.rowOrder.replace(order)
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
        _opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderMultiWaySvg } = await import('./renderSvg.tsx')
        return renderMultiWaySvg(self as MultiWaySyntenyDisplayModel)
      },
    }))
}

export type MultiWaySyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface MultiWaySyntenyDisplayModel extends Instance<MultiWaySyntenyDisplayStateModel> {}
