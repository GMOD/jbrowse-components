import {
  ConfigurationReference,
  getConf,
  makePin,
  setConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItems,
  getHitMenuItems,
  getSortByMenuItem,
  NO_HIDDEN_GROUPS,
  pickColorOptions,
} from '@jbrowse/plugin-alignments'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the alignments display model would undo that display's lazy loading.
// This module is itself only reached through LGVSyntenyDisplay's own loader.
import linearAlignmentsDisplayStateModelFactory from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'
import {
  LodTierInfoMixin,
  getCoarseBpPerPxThreshold,
  installLodTierInfoFetch,
  lodMenuItems,
  resolveLodTier,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'

import { featureMenuItems } from './contextMenuItems.ts'
import { getSyntenyGroupByMenuItem, getSyntenyShowMenuItems } from './menus.ts'

import type { LGVSyntenyDisplayConfigModel } from './configSchemaF.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  ColorBy,
  DerivativePathEvidence,
} from '@jbrowse/plugin-alignments'
import type { LodMode } from '@jbrowse/synteny-core'

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
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
  return (
    types
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
          /**
           * #property
           * Level-of-detail tier selection for tiered PIF adapters. 'auto' uses
           * the adapter's bpPerPx threshold; 'fine' pins the per-row CIGAR tier
           * (t/q); 'coarse' the tier whose CIGAR is folded to its large
           * indels (T/Q). Matches the synteny view and
           * dotplot setting of the same name — this display draws the same tracks
           * and had no way to pin a tier.
           */
          lodMode: types.stripDefault(
            types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
            'auto',
          ),
        }),
      )
      // showCoverage defaults to false for synteny via the config-slot override
      // in configSchemaF (the base alignments display defaults it to true).
      .views(() => ({
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

        /**
         * #getter
         * A chain here is one contig's blocks, and an assembly carries one or
         * two contigs across a locus, so one is a route. Nothing names a block
         * the view has not fetched (a PAF line has no SA tag), so a route is only
         * what is on screen.
         */
        get derivativePathEvidence(): DerivativePathEvidence {
          return { noun: 'contigs', minReads: 1, namesOffScreenSegments: false }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the view's own assembly lane is hidden — see the slot.
         */
        get hideSelfAlignments(): boolean {
          return getConf(self, 'hideSelfAlignments')
        },

        /**
         * #getter
         * The lane an all-vs-all track draws for the view's own assembly: its
         * mate-assembly group key IS that assembly name. Hidden as a group key
         * rather than filtered out of the fetch, so unchecking the option shows
         * it again without a refetch.
         *
         * The display's own half of `hiddenGroupKeys`, which unions it with the
         * lanes the user hid from a chip — overriding that would have dropped
         * theirs.
         *
         * The key is the name the adapter resolved out of the track's
         * `assemblyNames`, and the view may spell the same assembly another way,
         * so every declared name that is this assembly goes in beside the
         * view's own.
         */
        get displayHiddenGroupKeys(): ReadonlySet<string> {
          const assemblyName = self.view.assemblyNames[0]
          if (
            !this.hideSelfAlignments ||
            self.groupBy?.type !== 'mateAssembly' ||
            assemblyName === undefined
          ) {
            return NO_HIDDEN_GROUPS
          }
          const { assemblyManager } = getSession(self)
          return new Set([
            assemblyName,
            ...(getConf(self.parentTrack, 'assemblyNames') as string[]).filter(
              name => isSameAssemblyName(name, assemblyName, assemblyManager),
            ),
          ])
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
         * base's `zoomFetchKey` term and rides the RPC at the call site, so a
         * tier flip refetches the regions on screen while they keep drawing —
         * and, being settled, a gesture travelling through the threshold does
         * not hand `FetchVisibleRegions` a tier of a zoom it never stops at,
         * on the pipeline whose extract is the expensive one. The tier the
         * adapter will serve once `lodTierInfo` has landed: a file with no
         * coarse tier is 'fine' at any zoom, and the threshold is clamped up
         * to the file's `--coarse` bound.
         */
        get lodTier() {
          return this.tierAt(self.host.coarseBpPerPx)
        },
        /**
         * #getter
         * The same tier off the live zoom, for the base's `dataSuperseded`.
         */
        get liveLodTier() {
          return this.tierAt(self.host.bpPerPx)
        },
        tierAt(bpPerPx: number) {
          return resolveLodTier({
            bpPerPx,
            coarseBpPerPxThreshold: getCoarseBpPerPxThreshold(self.parentTrack),
            lodMode: self.lodMode,
            tierInfo: self.lodTierInfo,
          })
        },
      }))
      .actions(self => ({
        afterAttach() {
          installLodTierInfoFetch(self)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Show/hide the view's own assembly lane of an all-vs-all track.
         */
        setHideSelfAlignments(flag: boolean) {
          setConf(self, 'hideSelfAlignments', flag)
          self.scrollTop = 0
        },
        /**
         * #action
         */
        setLodMode(arg: LodMode) {
          self.lodMode = arg
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
              colorOptions: pickColorOptions(
                'normal',
                'strand',
                'mappingQuality',
                { type: 'mateRefName', label: 'Query name' },
              ),
              // This display's `colorBy` is promotable in its own right — the
              // schema override in configSchemaF.ts exists precisely to give it
              // a synteny `promotedBase` (`strand`, not `normal`). Without the
              // pin the slot was promotable with nowhere to promote from: a
              // promoted default is keyed by display type, so no alignments pin
              // could ever write LGVSyntenyDisplay's key either, and the slot
              // resolved to its base forever unless a track customized it.
              pin: (colorBy: ColorBy) => makePin(self, 'colorBy', colorBy),
            }),
            // No base pair / tag: a PAF block has no per-base sequence to sort a
            // column by, and no SAM tags. 'Longest features first' is the
            // largeFeaturesFirst layout flag, folded in as a peer radio because
            // it competes with a real sort for the same ordering.
            getSortByMenuItem(self, {
              noun: self.featureNoun,
              modes: ['position', 'length', 'strand'],
            }),
            ...getFiltersMenuItems(self),
            getSyntenyGroupByMenuItem(self),
            ...getSyntenyShowMenuItems(self),
            // Same submenu the synteny view and dotplot show, from one source, so
            // the three surfaces can't word the same setting differently
            ...lodMenuItems(self),
            getFeatureHeightMenuItem(self, self.featureNoun),
          ] satisfies MenuItem[]
        },
      }))
  )
}

export type LGVSyntenyDisplayStateModel = ReturnType<typeof stateModelFactory>

declare module '@jbrowse/core/PluginManager' {
  interface DisplayTypeRegistry {
    LGVSyntenyDisplay: LGVSyntenyDisplayStateModel
  }
}

export default stateModelFactory
