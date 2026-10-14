import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { getSession, toLocale } from '@jbrowse/core/util'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { stateModelFactory as markStateModelFactory } from '@jbrowse/plugin-marks/LinearMarkDisplay/stateModel'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'

import { LD_FIELD, LD_ROLE_FIELD } from '../GWASAdapter/ldFields.ts'
import { LD_WINDOW_BP } from '../GWASAdapter/ldJoin.ts'
import { readTopHit } from '../GWASAdapter/topHit.ts'
import { ldJoinFor } from './ldJoinResolver.ts'
import {
  colorsByLd,
  namesLd,
  placesEachSnp,
  readsLd,
  withLd,
  withoutLd,
} from './ldPlot.ts'
import { parseChrBp } from './parseChrBp.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { LinearManhattanDisplayConfigModel } from './configSchemaFactory.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { MarkTransformStepConfig } from '@jbrowse/plugin-marks'

const LD_PLOT_FIELDS = { numeric: [LD_FIELD], categorical: [LD_ROLE_FIELD] }
const NO_PLOT_FIELDS = { numeric: [], categorical: [] }

/**
 * #stateModel LinearManhattanDisplay
 * #category display
 * The mark display with the LD join: an index SNP each fetch joins r² to,
 * picked once from the top hit, and the menus that color the points by it.
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
         * The index SNP the LD join reads r² to, as a 1-based `chr:bp`. The
         * display picks the top hit on screen once, when a plot first joins
         * LD or LD coloring is turned on; after that only the user moves it.
         */
        indexSnp: types.maybe(types.string),
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
       * Whether a fetch joins r² to the index: the plot names `r2` or
       * `ld_role` anywhere the worker reads, an expression or a filter
       * included, and the adapter has an LD file to read them from. Without
       * one, a plot reads `r2` off the features like any other field.
       */
      get joinsLd(): boolean {
        return this.hasLdData && namesLd(self.plotRequest())
      },
      /**
       * #getter
       * Whether "Color by LD to index SNP" is on: a mark's encoding names an
       * LD field, which is what the item writes and takes off.
       */
      get ldColored(): boolean {
        return this.hasLdData && self.conf.marks.some(readsLd)
      },
      /**
       * #getter
       * The two fields the LD join writes, for Edit plot to offer.
       */
      get joinedPlotFields() {
        return this.hasLdData ? LD_PLOT_FIELDS : NO_PLOT_FIELDS
      },
      /**
       * #getter
       * The steps every mark runs before its own: the display's, then the
       * facet's.
       */
      get sharedSteps(): MarkTransformStepConfig[] {
        return [...self.conf.transform, ...self.conf.facet.transform]
      },
      /**
       * #getter
       * Whether "Color by LD to index SNP" has a point mark to color.
       */
      get ldColorable(): boolean {
        return self.conf.marks.some(m => colorsByLd(m, this.sharedSteps))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The highest-scoring SNP loaded for the regions on screen, as a 1-based
       * `chr:bp`. `GWASAdapter` reports each region's top hit off the file, so
       * no filter, zoom gate or mark of the plot moves it. A region scrolled
       * off screen stays loaded, and is not counted.
       *
       * A tie goes to the lowest region index, then the lowest position,
       * never to arrival order, so one load picks the same SNP however its
       * regions land (`ldAutoIndex.test.ts`).
       */
      get topSnp(): string | undefined {
        const onScreen = new Set(
          self.trackVisibleRegions.map(b => b.displayedRegionIndex),
        )
        let best: { score: number; start: number; refName: string } | undefined
        for (const idx of [...onScreen].sort((a, b) => a - b)) {
          const loaded = self.loadedRegions.get(idx)
          const hit = readTopHit(self.rpcDataMap.get(idx)?.facts)
          if (loaded && hit && (!best || hit.score > best.score)) {
            best = { ...hit, refName: loaded.refName }
          }
        }
        return best ? `${best.refName}:${best.start + 1}` : undefined
      },
      /**
       * #getter
       * `topSnp` once the load covering the screen is complete, or undefined:
       * mid-batch, `topSnp` is the best of what has arrived.
       */
      get settledTopSnp(): string | undefined {
        return self.viewportWithinLoadedData && !self.isLoading
          ? this.topSnp
          : undefined
      },
      /**
       * #getter
       * The index the fetch joins r² to, a fetch input, so picking one
       * refetches. None before the first load names a top hit.
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
      /**
       * #getter
       * The plot joins LD and no index is picked yet, though the loaded data
       * names a top hit: the one-time pick is due, and its refetch with it.
       */
      get indexPending(): boolean {
        return (
          self.joinsLd &&
          self.indexSnp === undefined &&
          this.topSnp !== undefined
        )
      },
      /**
       * #getter
       * `MultiRegionDisplayMixin`'s supersession hook, true while the mark
       * display's row listing is unsettled or the index pick is due.
       */
      get dataSuperseded(): boolean {
        return !self.rowListingSettled || this.indexPending
      },
      /**
       * #getter
       * Where the plot joins LD, a notice that no point on screen lies in
       * the LD window of the index, so none can be colored by it.
       */
      get displayNotices(): string[] {
        const locus = self.joinsLd && parseChrBp(self.indexSnp ?? '')
        if (!locus || self.trackVisibleRegions.length === 0) {
          return []
        }
        const { assemblyManager } = getSession(self)
        const start = locus.bp - 1
        const inReach = self.trackVisibleRegions.some(
          block =>
            (assemblyManager
              .get(block.assemblyName)
              ?.getCanonicalRefName2(locus.refName) ?? locus.refName) ===
              block.refName &&
            block.end > start - LD_WINDOW_BP &&
            block.start <= start + LD_WINDOW_BP,
        )
        return inReach
          ? []
          : [
              `No point on screen is within ${LD_WINDOW_BP / 1_000_000} Mb of the LD index SNP ${self.indexSnp}, so none is colored by LD: right-click a point to color by LD to it, or use LD → Set index SNP to top hit in the track menu`,
            ]
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
       * Color each point by its r² to the index SNP, the index a pink
       * diamond over them, or take that coloring off, leaving every other
       * member and mark of the plot as it was (`withLd`, `withoutLd`).
       * Turning it on picks the top hit on screen as the index, or leaves the
       * pick for the load in flight to make.
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
        if (on && marks) {
          self.indexSnp = self.settledTopSnp
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Right-click "Color by LD to this SNP": color by r² to the clicked
       * point as the index, in one action so the fetch inputs settle once.
       */
      colorByLdToHit(hit: { refName: string; start: number }) {
        self.setLdColoring(true)
        self.indexSnp = `${hit.refName}:${hit.start + 1}`
      },
      /**
       * #action
       * Make the top hit on screen the index.
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST action named for its semantic meaning, not a React hook
      useTopHitAsIndex() {
        self.indexSnp = self.settledTopSnp ?? self.indexSnp
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
                        checked: self.ldColored,
                        disabled: !self.ldColored && !self.ldColorable,
                        disabledHelpText:
                          'LD coloring colors a point mark that plots each SNP at its own position, and this plot has none: add one with Edit plot...',
                        onClick: () => {
                          self.setLdColoring(!self.ldColored)
                        },
                      },
                      {
                        label: self.settledTopSnp
                          ? `Set index SNP to top hit (${self.settledTopSnp})`
                          : 'Set index SNP to top hit',
                        disabled:
                          !self.joinsLd ||
                          !self.settledTopSnp ||
                          self.settledTopSnp === self.indexSnp,
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
        // writes only while no index is picked, and its write ends that
        namedAutorun(
          self,
          () => {
            const top = self.settledTopSnp
            if (self.indexPending && top !== undefined) {
              self.setIndexSnp(top)
            }
          },
          { name: 'ManhattanPickIndexSnp' },
        )
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface LinearManhattanDisplayModel extends Instance<LinearManhattanDisplayStateModel> {}
