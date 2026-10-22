import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { types } from '@jbrowse/mobx-state-tree'
import {
  colorFieldOptions,
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItems,
  getHitMenuItems,
  getSortMenuItem,
} from '@jbrowse/plugin-alignments'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the alignments display model would undo that display's lazy loading.
// This module is itself only reached through LGVSyntenyDisplay's own loader.
import linearAlignmentsDisplayStateModelFactory from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'
import {
  LodTierInfoMixin,
  installLodTierInfoFetch,
  lodMenuItems,
  lodTierAt,
  regionsInAssemblyNamespace,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'

import { featureMenuItems } from './contextMenuItems.ts'
import { getSyntenyGroupByMenuItem, getSyntenyShowMenuItems } from './menus.ts'

import type { LGVSyntenyDisplayConfigModel } from './configSchemaF.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { LodMode } from '@jbrowse/synteny-core'

/**
 * #stateModel LGVSyntenyDisplay
 * Draws where a `SyntenyTrack`'s alignments fall in a plain linear genome
 * view, with menu items that open them in a synteny view.
 *
 * #example
 * Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
 * two-row synteny view). Same track config as a synteny track — just pick this
 * display type:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LGVSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function stateModelFactory(schema: LGVSyntenyDisplayConfigModel) {
  const baseModel = linearAlignmentsDisplayStateModelFactory(schema)
  return types
    .compose(
      'LGVSyntenyDisplay',
      baseModel,
      LodTierInfoMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LGVSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(schema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * the level-of-detail tier the reader pinned, or 'auto' for the
       * adapter's own bpPerPx threshold. `lodTier` is what resolves it
       */
      get resolution(): LodMode {
        return getConf(self, ['data', 'resolution'])
      },
      /**
       * #getter
       * synteny features open the SyntenyFeatureWidget; the inherited
       * `selectFeature` action reads this getter, so no override is needed.
       */
      get featureWidgetType() {
        return {
          type: 'SyntenyFeatureWidget',
          id: 'syntenyFeature',
        }
      },

      /**
       * #getter
       * A row here is a PAF block, not a read — the group-label chips say
       * "Show all features". The ONE place that word is chosen: the two menu
       * builders below that take a `noun` read it from here rather than
       * spelling it again, so the chips and the menus cannot end up naming the
       * same row two different things.
       */
      get featureNoun() {
        return 'feature'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The mate-assembly keys of the lane an all-vs-all track draws for the
       * view's own assembly: the view's name, and every name the track
       * declares for the same assembly, since the adapter keys a lane by the
       * track's spelling.
       */
      get selfLaneKeys(): string[] {
        const assemblyName = self.view.assemblyNames[0]
        if (assemblyName === undefined) {
          return []
        }
        const { assemblyManager } = getSession(self)
        return [
          ...new Set([
            assemblyName,
            ...getConf(self.parentTrack, 'assemblyNames').filter(name =>
              isSameAssemblyName(name, assemblyName, assemblyManager),
            ),
          ]),
        ]
      },
      /**
       * #getter
       * Whether `facet.hidden` holds the self lane, the "Hide self-alignment
       * lane" box.
       */
      get selfLaneHidden(): boolean {
        const keys = this.selfLaneKeys
        return keys.length > 0 && keys.every(k => self.hiddenGroups.has(k))
      },

      /**
       * #method
       * A mate-assembly chip reads the assembly's display name
       */
      groupChipLabel(label: string) {
        return self.facet?.field === 'mateAssembly'
          ? getSession(self).assemblyManager.getDisplayName(label)
          : label
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether this track's adapter has tiered storage to switch between —
       * gates the "Level of detail" menu.
       */
      get hasLodCapableAdapter() {
        return trackHasLodTiers(self.parentTrack)
      },
      /**
       * #getter
       * The tier this display's fetch asks for: the alignments base's hook,
       * resolved here on the main thread off the SETTLED zoom. It is the
       * base's `zoomFetchArgs` term and rides the RPC at the call site, so a
       * tier flip refetches the regions on screen while they keep drawing —
       * and, being settled, a gesture travelling through the threshold does
       * not hand `FetchVisibleRegions` a tier of a zoom it never stops at,
       * on the pipeline whose extract is the expensive one. The tier the
       * adapter will serve once `lodTierInfo` has landed: a file with no
       * coarse tier is 'fine' at any zoom, and the threshold is clamped up
       * to the file's `--coarse` bound.
       */
      get lodTier() {
        return lodTierAt(self, self.host.coarseBpPerPx, self.resolution)
      },
      /**
       * #getter
       * The same tier off the live zoom, for the base's `dataSuperseded`.
       */
      get liveLodTier() {
        return lodTierAt(self, self.host.bpPerPx, self.resolution)
      },
    }))
    .actions(self => {
      const { fetchNeeded } = self
      return {
        afterAttach() {
          installLodTierInfoFetch(self)
        },
        /**
         * #action
         * The inherited fetch, with each region's assembly respelled the way
         * the track declares it. The view names its assembly canonically and
         * the adapter answers a region by comparing that text against its configured
         * `assemblyNames` in a worker with no assembly manager, so a track
         * declaring an alias would fetch nothing. The comparative views do the
         * same through `renameRegionsForAdapter`.
         */
        fetchNeeded(needed: IndexedRegion[]) {
          const { assemblyManager } = getSession(self)
          const assemblyNames = getConf(self.parentTrack, 'assemblyNames')
          fetchNeeded(
            needed.map(({ region, displayedRegionIndex }) => ({
              displayedRegionIndex,
              region: regionsInAssemblyNamespace(
                [region],
                assemblyNames,
                assemblyManager,
              )[0]!,
            })),
          )
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Write the self lane into `facet.hidden`, or take it out.
       */
      setSelfLaneHidden(flag: boolean) {
        const keys = new Set(self.selfLaneKeys)
        const rest = [...self.hiddenGroups].filter(k => !keys.has(k))
        setConf(self, ['facet', 'hidden'], flag ? [...rest, ...keys] : rest)
        self.setScrollTop(0)
      },
      /**
       * #action
       */
      setResolution(arg: LodMode) {
        setConf(self, ['data', 'resolution'], arg)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      contextMenuItems(): MenuItem[] {
        // The mismatch / interbase-indicator details come from the base
        // alignments display: this display renders those same layers off the
        // PAF cs/CIGAR (see its "Show..." menu), so a right-click on one has
        // to reach its details — before this, a right-click on an interbase
        // indicator (which carries no feature) produced no menu at all. The
        // read-specific half of the base menu (mate, read/HP/RG filters, read
        // name + sequence copies) is what a PAF block has no answer for, and
        // is replaced by the feature items. `sort: false` because the curated
        // "Sort by..." menu offers no position-anchored mode.
        return [
          ...getHitMenuItems(self, { sort: false }),
          ...featureMenuItems(self),
        ]
      },
      /**
       * #method
       */
      // Every entry is a submenu, in the same order as the alignments display's
      // track menu (color, sort, filter, group, show, height) — the two share a
      // state model and a component, so the menus should read the same way. The
      // per-setting curation (which color schemes, which sort modes, which
      // layers) is what makes this synteny's menu rather than a copy.
      trackMenuItems() {
        return [
          // Paired-end and modification/bisulfite coloring are deliberately
          // not opted into: a PAF block has no mate pair and no basecaller
          // tags. 'mateRefName' is named for the mate a BAM read has, so it
          // is relabelled here for the thing a PAF block aligns to —
          // chromosome painting, matching the synteny view's Query mode.
          getColorByMenuItem(self, {
            colorOptions: colorFieldOptions('', 'strand', 'mapq', {
              field: 'mateRefName',
              label: 'Query',
            }),
          }),
          ...editPlotMenuItems(self),
          // No base pair / tag: a PAF block has no per-base sequence to sort a
          // column by, and no SAM tags.
          getSortMenuItem(self, {
            noun: self.featureNoun,
            modes: ['position', 'length', 'strand', 'mapq'],
            disabledHelpText: self.collapseSortBlockedReason,
          }),
          ...getFiltersMenuItems(self),
          getSyntenyGroupByMenuItem(self),
          ...getSyntenyShowMenuItems(self),
          // Same submenu the synteny view and dotplot show, from one source, so
          // the three surfaces can't word the same setting differently
          ...lodMenuItems(self),
          getFeatureHeightMenuItem(self, self.featureNoun, {
            disabled: !self.showPileup,
            disabledHelpText: `Turn on "Show... → Alignments" to change ${self.featureNoun} height`,
          }),
        ] satisfies MenuItem[]
      },
    }))
}

export type LGVSyntenyDisplayStateModel = ReturnType<typeof stateModelFactory>

declare module '@jbrowse/core/PluginManager' {
  interface DisplayTypeRegistry {
    LGVSyntenyDisplay: LGVSyntenyDisplayStateModel
  }
}

export default stateModelFactory
