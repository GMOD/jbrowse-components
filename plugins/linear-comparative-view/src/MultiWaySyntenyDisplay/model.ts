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
  laneFetchWindow,
  rowAssembliesOf,
  tickIntervalFor,
} from './layoutMultiWay.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { RowFrame } from './layoutMultiWay.ts'
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

// widen a lane frame outward to a stable grid, so a sub-grid pan reuses the
// last gene fetch the way the anchor's static blocks do
function quantizeSpan(min: number, max: number) {
  const grid = 2 ** Math.ceil(Math.log2(Math.max(max - min, 1)))
  return {
    start: Math.max(0, Math.floor(min / grid) * grid),
    end: Math.ceil(max / grid) * grid,
  }
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
         * lanes to pin to the top, in order; lanes it does not name follow in
         * first-appearance order. A declared property, so it is authorable
         * from a session spec or a config defaultSession
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
    }))
    .views(self => ({
      /**
       * #getter
       * anchor-sorted gene groups reconstructed from the pairwise features
       */
      get groups() {
        return self.features ? groupFeatures(self.features) : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * mate assemblies in first-appearance order, one lane each below the
       * anchor lane
       */
      get rowAssemblies() {
        // a paralogy record's mate is the anchor assembly itself; those draw
        // on the anchor's own axis, not as a lane
        return rowAssembliesOf(self.groups, [...self.rowOrder]).filter(
          assemblyName => assemblyName !== self.lgv.assemblyNames[0],
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
       */
      get visibleBpSpan() {
        const view = self.lgv
        return view.initialized ? view.width * view.bpPerPx : 0
      },
      /**
       * #getter
       * the anchor lane's own frame — the widest block the view is showing —
       * so the anchor lane carries the same header as every other lane. It is
       * the baseline the lane multiples are read against, and without it the
       * stack states its scale nowhere the ruler above has not been cropped
       */
      get anchorFrame() {
        const view = self.lgv
        return view.initialized
          ? widestRegion(view.coarseDynamicBlocks)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the anchor lane as a `RowFrame`, so the lane-alignment pass can treat
       * it as the first link in the chain rather than as a special case. It
       * never slides, hence the zero slack
       */
      get anchorRowFrame(): RowFrame | undefined {
        const frame = self.anchorFrame
        return frame
          ? {
              refName: frame.refName,
              min: frame.start,
              max: frame.end,
              flipped: false,
              fitMin: frame.start,
              fitMax: frame.end,
            }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the one bp interval every lane draws its ticks at, so tick spacing is
       * readable as bp-per-pixel across lanes drawn in different frames
       */
      get tickIntervalBp() {
        return tickIntervalFor(self.visibleBpSpan)
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
          self.anchorRowFrame,
          self.visibleBpSpan,
          self.canvasWidth,
        )
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
        const out = new Map<string, Record<string, unknown>>()
        for (const assemblyName of [
          self.anchorAssemblyName,
          ...self.rowAssemblies,
        ]) {
          const conf = session.tracks.find(track => {
            const names = readConfObject(track, 'assemblyNames') as string[]
            const adapterType = (
              readConfObject(track, 'adapter') as { type?: string } | undefined
            )?.type
            return (
              names.length === 1 &&
              names[0] === assemblyName &&
              !!adapterType?.startsWith('Gff3')
            )
          })
          if (conf) {
            out.set(
              assemblyName,
              readConfObject(conf, 'adapter') as Record<string, unknown>,
            )
          }
        }
        return out
      },
    }))
    .views(self => ({
      /**
       * #getter
       * what the lane-genes autorun fetches: one spec per lane with a gene
       * track, over quantized windows so a small pan reuses the last fetch
       */
      get laneGenesFetchSpecs() {
        const view = self.lgv
        const adapters = self.laneGeneAdapters
        const specs: LaneGenesFetchSpec[] = []
        if (view.initialized) {
          const anchorAdapter = adapters.get(self.anchorAssemblyName)
          if (anchorAdapter) {
            const regions = view.staticBlocks.contentBlocks.map(block => ({
              assemblyName: self.anchorAssemblyName,
              refName: block.refName,
              start: Math.max(0, Math.floor(block.start)),
              end: Math.ceil(block.end),
            }))
            if (regions.length) {
              specs.push({
                assemblyName: self.anchorAssemblyName,
                adapterConfig: anchorAdapter,
                regions,
              })
            }
          }
          for (const [assemblyName, frame] of self.rowFrames) {
            const adapter = adapters.get(assemblyName)
            if (adapter && frame) {
              // the window every position the frame can slide to, NOT the frame
              // itself: the frame moves with the alignment shift and therefore
              // with the viewport width, and keying the fetch on that refetches
              // a lane's annotation on a window resize
              const reach = laneFetchWindow(frame)
              specs.push({
                assemblyName,
                adapterConfig: adapter,
                regions: [
                  {
                    assemblyName,
                    refName: frame.refName,
                    ...quantizeSpan(reach.min, reach.max),
                  },
                ],
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
    }))
    .views(self => ({
      /**
       * #getter
       * a gene-level source names its features and groups chain on the names;
       * an alignment-level source (all-vs-all PAF) names nothing, which is
       * what makes the per-pair link fetch below worth issuing
       */
      get featuresAreNameless() {
        return (
          self.features !== undefined &&
          self.features.length > 0 &&
          self.features.every(f => f.get('name') === undefined)
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * one spec per ADJACENT mate-lane pair when the source is an all-vs-all
       * alignment file: the upper lane's frame queried against the lower
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
                  refName: upper.refName,
                  ...quantizeSpan(upper.min, upper.max),
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
       */
      get laneLinksCurrent() {
        const { key, specs } = self.laneLinksFetchSpecs
        return (
          specs.length === 0 ||
          (self.laneLinks !== undefined && self.laneLinksKey === key)
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * whether the committed lane genes answer the current lane frames.
       * Published as `data-lanes-current` on the body so a capture can wait on
       * the dependent fetch — `displayPhase` deliberately does not cover it,
       * since the lanes are an enhancement over the placement boxes
       */
      get laneGenesCurrent() {
        const { key, specs } = self.laneGenesFetchSpecs
        return (
          specs.length === 0 ||
          (self.laneGenes !== undefined && self.laneGenesKey === key)
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the dependent lane-genes fetch is part of loading, so an export or a
       * capture never lands between the ortholog fetch and the gene models
       * that fill the lanes. A failed lane fetch commits an empty result
       * rather than hanging this at loading (see afterAttach)
       */
      get displayPhase(): DisplayStatusPhase {
        const base = foundationDisplayStatusPhase(self, () => true)
        return base === 'ready' &&
          (!self.laneGenesCurrent || !self.laneLinksCurrent)
          ? 'loading'
          : base
      },
    }))
    .views(self => ({
      /**
       * #method
       * the same multi-panel launch the view menu and the rubberband offer,
       * from the track that is already showing the lanes: every genome
       * aligning to the visible window gets a full row of its own in a
       * stacked linear synteny view, cut from this track's dataset
       */
      trackMenuItems(): MenuItem[] {
        const view = self.lgv
        return syntenyRegionMenuItems({
          label: 'Launch stacked synteny view (visible region)',
          region: widestRegion(view.dynamicBlocks.contentBlocks),
          session: getSession(self),
          openTracks: [self.parentTrack.configuration],
          anchorTracks: anchorPanelTracks(view.tracks),
          sourceView: view,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON())
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
export type MultiWaySyntenyDisplayModel =
  Instance<MultiWaySyntenyDisplayStateModel>
