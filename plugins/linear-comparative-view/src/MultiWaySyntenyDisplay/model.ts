import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  doesIntersect2,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GlobalFetchMixin,
  TrackHeightMixin,
  blockKeySignature,
  foundationDisplayStatusPhase,
} from '@jbrowse/plugin-linear-genome-view'

import {
  computeRowFrame,
  groupFeatures,
  rowAssembliesOf,
} from './layoutMultiWay.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
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
        return rowAssembliesOf(self.groups, [...self.rowOrder])
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
              return view.coarseDynamicBlocks.some(
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
    }))
    .views(self => ({
      /**
       * #getter
       * each mate lane's local coordinate frame
       */
      get rowFrames() {
        return new Map<string, RowFrame | undefined>(
          self.rowAssemblies.map(assemblyName => [
            assemblyName,
            computeRowFrame(
              self.visibleGroups,
              assemblyName,
              self.visibleBpSpan,
            ),
          ]),
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
              specs.push({
                assemblyName,
                adapterConfig: adapter,
                regions: [
                  {
                    assemblyName,
                    refName: frame.refName,
                    ...quantizeSpan(frame.min, frame.max),
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
        return base === 'ready' && !self.laneGenesCurrent ? 'loading' : base
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
