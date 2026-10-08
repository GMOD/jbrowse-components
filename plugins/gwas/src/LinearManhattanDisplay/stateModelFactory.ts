import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { toLocale } from '@jbrowse/core/util'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { stateModelFactory as markStateModelFactory } from '@jbrowse/plugin-marks/LinearMarkDisplay/stateModel'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'

import { readTopHit } from '../GWASAdapter/topHit.ts'
import { ldJoinFor } from './ldJoinResolver.ts'
import {
  colorsByLd,
  placesEachSnp,
  readsLd,
  withLd,
  withoutLd,
} from './ldPlot.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { LinearManhattanDisplayConfigModel } from './configSchemaFactory.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { MarkTransformStepConfig } from '@jbrowse/plugin-marks'

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
         * The index SNP the LD join reads r² to, as a 1-based `chr:bp`. It
         * follows the highest-scoring loaded SNP until the user pins one.
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
       * Whether a fetch joins r² to the index: a mark's encoding names `r2`
       * or `ld_role`, and the adapter has an LD file to read them from.
       * Without one, a mark reads `r2` off the features like any other field.
       */
      get joinsLd(): boolean {
        return this.hasLdData && self.conf.marks.some(readsLd)
      },
      /**
       * #getter
       * The steps every mark runs before its own: the display's, then the
       * facet's.
       */
      get sharedSteps(): MarkTransformStepConfig[] {
        return [...self.conf.transform, ...self.conf.facet.transform]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether "Color by LD to index SNP" has a point mark to colour.
       */
      get ldColorable(): boolean {
        return self.conf.marks.some(m => colorsByLd(m, self.sharedSteps))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The highest-scoring loaded SNP as a 1-based `chr:bp`, the index the
       * join follows while none is pinned. `GWASAdapter` reports each region's
       * top hit off the file, so no filter, zoom gate or mark of the plot
       * moves it.
       *
       * A tie goes to the lowest region index, then the lowest position,
       * never to arrival order: adopting the index refetches, so a tie broken
       * by arrival would flip between the tied SNPs and never paint
       * (`ldAutoIndex.test.ts`).
       */
      get topSnp(): string | undefined {
        let best: { score: number; start: number; idx: number } | undefined
        const indexes = [...self.rpcDataMap.keys()].sort((a, b) => a - b)
        for (const idx of indexes) {
          const hit = readTopHit(self.rpcDataMap.get(idx)!.facts)
          if (hit && (!best || hit.score > best.score)) {
            best = { ...hit, idx }
          }
        }
        const refName = best && self.host.displayedRegions[best.idx]?.refName
        return refName ? `${refName}:${best!.start + 1}` : undefined
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
       * Colour each point by its r² to the index SNP, the index a pink
       * diamond over them, or take that colouring off, leaving every other
       * member and mark of the plot as it was (`withLd`, `withoutLd`).
       */
      setLdColoring(on: boolean) {
        if (on === self.conf.marks.some(readsLd)) {
          return
        }
        const marks = on
          ? withLd(self.conf.marks, self.sharedSteps)
          : withoutLd(getSnapshot(self.conf.marks))
        if (!on || marks) {
          setConf(self, 'marks', marks)
        }
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
        self.setLdColoring(true)
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
                        disabled: !self.joinsLd && !self.ldColorable,
                        disabledHelpText:
                          'LD colouring colours a point mark that plots each SNP at its own position, and this plot has none: add one with Edit plot...',
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
          const mark = hit && self.conf.marks[hit.markIndex]
          return [
            ...superContextMenuItems(),
            ...(hit &&
            mark &&
            self.hasLdData &&
            (self.joinsLd || self.ldColorable) &&
            placesEachSnp(mark, self.sharedSteps)
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
