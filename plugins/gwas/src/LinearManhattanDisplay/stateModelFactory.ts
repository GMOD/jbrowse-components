import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { toLocale } from '@jbrowse/core/util'
import { NO_VALUE_ABGR } from '@jbrowse/core/util/markEncoding'
import { types } from '@jbrowse/mobx-state-tree'
import { stateModelFactory as markStateModelFactory } from '@jbrowse/plugin-marks/LinearMarkDisplay/stateModel'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'

import { LD_FIELD, LD_ROLE_FIELD } from '../GWASAdapter/ldFields.ts'
import { ldJoinFor } from './ldJoinResolver.ts'
import { LD_MARKS, readsLd } from './ldPlot.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { LinearManhattanDisplayConfigModel } from './configSchemaFactory.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const INDEX_SNP_MISSING =
  'No point has LD data to the index SNP, so every other point is grey: check that the LD file covers the index SNP and that the assembly’s aliases cover its reference names (e.g. “chr2” vs “2”)'

/**
 * #stateModel LinearManhattanDisplay
 * #category display
 * The mark display with the LD join: an index SNP each fetch joins r² to,
 * which follows the top hit until the user pins one, and the menus that colour
 * the points by it.
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: LinearManhattanDisplayConfigModel,
) {
  return types
    .compose(
      'LinearManhattanDisplay',
      markStateModelFactory(pluginManager, configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * The index SNP the LD join reads r² to: a SNP id or a 1-based
         * `chr:bp`. It follows the highest-scoring loaded SNP until the user
         * pins one.
         */
        indexSnp: types.maybe(types.string),
        /**
         * #property
         * True once the user pins an index SNP by right-clicking a point.
         */
        indexSnpPinned: types.stripDefault(types.boolean, false),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * No byte gate: a Manhattan plot's case is a genome-wide view of summary
       * statistics, which a region budget would refuse.
       */
      get gateEnabled(): boolean {
        return false
      },
      /**
       * #getter
       * The `ldAdapter` on the track's `GWASAdapter`, or undefined for none.
       * Read off the live track, since `self.adapterConfig` is a snapshot,
       * which leaves out a slot at its default.
       */
      get ldAdapterConfig(): Record<string, unknown> | undefined {
        return getConf(self.parentTrack, ['adapter', 'ldAdapter']) ?? undefined
      },
      /**
       * #getter
       */
      get hasLdData(): boolean {
        return this.ldAdapterConfig !== undefined
      },
      /**
       * #getter
       * Whether a fetch joins r² to the index: a mark's encoding names `ld`
       * or `ld_role`, and the adapter has an LD file to read them from.
       * Without one, a mark reads `ld` off the features like any other field.
       */
      get joinsLd(): boolean {
        return this.hasLdData && self.conf.marks.some(readsLd)
      },
      /**
       * #getter
       * The marks drawing at this zoom that name an LD field and plot a `y`,
       * whose points the top hit and the missing-index check read.
       */
      get ldMarkIndexes(): number[] {
        const { visible } = self.markView
        const requests = self.layerRequests
        return self.conf.marks.flatMap((m, i) =>
          visible[i] && readsLd(m) && requests[i]!.lanes.includes('y')
            ? [i]
            : [],
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The highest-scoring loaded SNP of the LD marks as a 1-based `chr:bp`,
       * the index the join follows while none is pinned.
       *
       * A tie goes to the lowest region index, then the lowest position,
       * never to arrival order or to the mark a SNP is drawn in. Ties at the
       * top are routine — `negLog10` clamps every underflowed p of 0 to the
       * same ~323.3 — and adopting the index refetches and moves it into the
       * index mark, so a tie broken either way would flip between the tied
       * SNPs and never paint (`ldAutoIndex.test.ts`).
       */
      get topSnp(): string | undefined {
        const marks = self.ldMarkIndexes
        let bestScore = -Infinity
        let bestPos = 0
        let bestIdx = -1
        const indexes = [...self.rpcDataMap.keys()].sort((a, b) => a - b)
        for (const idx of indexes) {
          const { layers } = self.rpcDataMap.get(idx)!
          for (const mark of marks) {
            const layer = layers[mark]
            const y = layer?.y
            if (layer && y) {
              for (let i = 0; i < layer.count; i++) {
                const score = y[i]!
                const pos = layer.x[i]!
                if (
                  score > bestScore ||
                  (score === bestScore && idx === bestIdx && pos < bestPos)
                ) {
                  bestScore = score
                  bestPos = pos
                  bestIdx = idx
                }
              }
            }
          }
        }
        const refName =
          bestIdx === -1
            ? undefined
            : self.host.displayedRegions[bestIdx]?.refName
        return refName ? `${refName}:${bestPos + 1}` : undefined
      },
      /**
       * #getter
       * A loaded region draws the index SNP but no loaded point is its
       * partner, so every other point is grey: the LD file lacks the index or
       * names it otherwise. The index is drawn where an LD mark's `ld_role`
       * shape met it, and a partner where an instance of a mark coloured by
       * `ld` is not the no-value grey; an index outside the loaded regions is
       * not missing.
       */
      get indexSnpMissing(): boolean {
        const marks = self.ldMarkIndexes
        const layers = [...self.rpcDataMap.values()].flatMap(d =>
          marks.flatMap(i => d.layers[i] ?? []),
        )
        const indexDrawn = layers.some(
          ({ shapeScale }) =>
            shapeScale?.field === LD_ROLE_FIELD &&
            shapeScale.entries.some(e => e.value === 'index'),
        )
        const partnerJoined = layers.some(
          ({ scale, color, count }) =>
            scale?.field === LD_FIELD &&
            !!color?.subarray(0, count).some(c => c !== NO_VALUE_ABGR),
        )
        return self.joinsLd && indexDrawn && !partnerJoined
      },
      /**
       * #getter
       * The index the fetch joins r² to, a fetch input, so adopting or
       * pinning one refetches. None before the first load names a top hit.
       */
      get adapterOptions(): { ld: string } | undefined {
        return self.joinsLd && self.indexSnp !== undefined
          ? { ld: self.indexSnp }
          : undefined
      },
      /**
       * #method
       * The LD join as one region's fetch asks the adapter for it.
       */
      async resolveAdapterOptions(
        { ld }: { ld: string },
        region: Region,
        signal: AbortSignal,
      ): Promise<{ ld: LdJoin } | undefined> {
        const config = self.ldAdapterConfig
        const join =
          config && (await ldJoinFor(self, config, ld, region, signal))
        return join ? { ld: join } : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The loaded data was joined under an index other than the top hit, so
       * adopting it will clear the data and refetch: `MultiRegionDisplayMixin`'s
       * supersession hook, and the auto-pick's trigger.
       */
      get dataSuperseded(): boolean {
        return (
          self.joinsLd &&
          !self.indexSnpPinned &&
          self.topSnp !== undefined &&
          self.topSnp !== self.indexSnp
        )
      },
      /**
       * #getter
       */
      get dataNotices(): string[] {
        return self.indexSnpMissing ? [INDEX_SNP_MISSING] : []
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setIndexSnp(snp?: string) {
        self.indexSnp = snp
      },
      /**
       * #action
       * Replace the marks with LocusZoom's plot — each point coloured by its
       * r² to the index SNP, the index a pink diamond over them — or return
       * to the default plot. The transform, facet, rows and scales stay.
       */
      setLdColoring(on: boolean) {
        setConf(self, 'marks', on ? LD_MARKS : undefined)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Right-click "Color by LD to this SNP": colour by r² to the clicked
       * point and pin it as the index, in one action so the fetch inputs
       * settle once.
       */
      colorByLdToHit(hit: { refName: string; start: number }) {
        if (!self.joinsLd) {
          self.setLdColoring(true)
        }
        self.indexSnp = `${hit.refName}:${hit.start + 1}`
        self.indexSnpPinned = true
      },
      /**
       * #action
       * Release a pinned index back to following the top hit.
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST action named for its semantic meaning, not a React hook
      useTopHitAsIndex() {
        self.indexSnpPinned = false
        self.indexSnp = self.topSnp
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        contextMenuItems: superContextMenuItems,
      } = self
      return {
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return [
            ...superTrackMenuItems(),
            ...(self.hasLdData
              ? [
                  {
                    label: 'LD',
                    subMenu: [
                      {
                        label: 'Color by LD to index SNP',
                        type: 'checkbox' as const,
                        checked: self.joinsLd,
                        onClick: () => {
                          self.setLdColoring(!self.joinsLd)
                        },
                      },
                      {
                        label: 'Set index SNP to top hit',
                        disabled:
                          !self.joinsLd || !self.topSnp || !self.indexSnpPinned,
                        onClick: () => {
                          self.useTopHitAsIndex()
                        },
                      },
                    ],
                  },
                ]
              : []),
          ]
        },
        /**
         * #method
         */
        contextMenuItems(): MenuItem[] {
          const hit = self.contextMenuInfo?.hit
          return [
            ...superContextMenuItems(),
            ...(hit && self.hasLdData
              ? [
                  {
                    label: `Color by LD to ${hit.refName}:${toLocale(hit.start + 1)}`,
                    onClick: () => {
                      self.colorByLdToHit(hit)
                    },
                  },
                ]
              : []),
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // adopted only from a complete load: mid-batch, topSnp is the best
        // of what has arrived, and adopting it would refetch forever
        // (ldAutoIndex.test.ts)
        namedAutorun(
          self,
          () => {
            if (
              self.dataSuperseded &&
              self.viewportWithinLoadedData &&
              !self.isLoading
            ) {
              self.setIndexSnp(self.topSnp)
            }
          },
          { name: 'ManhattanAdoptTopSnp' },
        )
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface LinearManhattanDisplayModel extends Instance<LinearManhattanDisplayStateModel> {}
