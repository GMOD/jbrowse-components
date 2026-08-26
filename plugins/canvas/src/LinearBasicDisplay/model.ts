import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import {
  promotableToggleItem,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { pluralize } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import SegmentIcon from '@mui/icons-material/Segment'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'

import { SUBFEATURE_LABEL_OPTIONS } from '../RenderFeatureDataRPC/displayModes.ts'
import {
  addTrimmedIsoformPicks,
  mergeIsoformPicks,
} from '../RenderFeatureDataRPC/isoformPicks.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import {
  collapseIntronsMenuItem,
  isGeneLikeType,
} from './collapseIntronsMenu.ts'
import { exportRCode } from './exportRCode.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'
import { planIsoformTrims } from './isoformTrim.ts'
import { inertLabelHint, inlineRadioGroup } from './trackMenus.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { IsoformStack } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type { RTrackFragment } from '@jbrowse/display-kit/RExportFragment'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { Region } from '@jbrowse/core/util'

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the
 * shared canvas base display (`LinearCanvasBaseDisplay`). This is the GPU
 * stack — despite the name it does NOT extend `BaseLinearDisplay` (the legacy
 * block stack). See
 * [display stacks](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks).
 *
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
 * or `superCompact`), or `collapsed` for a single-row overview:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.gff3.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearBasicDisplay',
 *       displayId: 'genes-LinearBasicDisplay',
 *       height: 200,
 *       displayMode: 'compact',
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: LinearBasicDisplayConfigModel,
) {
  return baseStateModelFactory(configSchema)
    .props({
      type: types.literal('LinearBasicDisplay'),
      // Reclaims this display's own slots for the config readers. The base
      // declares `configuration` off the SHARED canvas schema (LinearVariantDisplay
      // composes the same model), so `getConf`/`setConf`, which name their slots
      // off `self.configuration`, could only see base slots — a read of
      // `showOnlyGenes`, declared on this schema alone, was a type error. See
      // packages/core/src/configuration/CLAUDE.md §"Read type narrowing".
      configuration: ConfigurationReference(configSchema),
    })
    .volatile(() => ({
      // Session-only acknowledgement of the isoform-collapse chip.
      // Dismissing collapses the loud text chip down to the quiet icon button
      // for the session (the button stays, so re-opening the menu is always one
      // click away); it never changes the collapse itself. Volatile, so a
      // reload is the natural reset boundary.
      geneGlyphNoticeDismissed: false,
    }))
    .views(self => ({
      // Promotable sentinel enum (see baseConfigSchema.ts): getConf walks
      // the cascade (pinned track value -> session default -> base 'none') and
      // always yields a real mode, never the unset sentinel.
      get subfeatureLabels(): DisplayConfig['subfeatureLabels'] {
        return resolveConf(self, 'subfeatureLabels')
      },

      get geneGlyphMode() {
        return getConf(self, 'geneGlyphMode')
      },

      // Config slot rather than a display prop, like every other toggle in this
      // menu. It was a prop until a config carrying `showOnlyGenes` was found to
      // do nothing at all — MST drops a snapshot key the schema never declared,
      // so test_data/config_demo.json had asked eleven NCBI gene tracks to show
      // only genes since June and none of them had.
      get showOnlyGenes(): boolean {
        return getConf(self, 'showOnlyGenes')
      },

      // Promotable `maybeBoolean` slot (see baseConfigSchema.ts): getConf
      // walks the cascade (pinned track value -> session default -> base `true`)
      // and always yields a concrete boolean, never the unset sentinel.
      get displayDirectionalChevrons(): boolean {
        return resolveConf(self, 'displayDirectionalChevrons')
      },

      get effectiveGeneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        if (this.geneGlyphMode === 'auto') {
          // coarseBpPerPx (debounced) so crossing the threshold during a zoom
          // gesture doesn't thrash the RPC cache key — the collapse refetch
          // fires once zoom settles, on the same cadence as the layout.
          return getView(self).coarseBpPerPx > 100 ? 'longestCoding' : 'all'
        }
        return this.geneGlyphMode
      },

      // Gate for the bottom-right isoform-collapse control: the loaded data has
      // a multi-isoform gene, so switching modes is meaningful. Shown in every
      // mode (not just when collapsed) so picking "All transcripts" from the
      // control's menu doesn't make the control itself disappear — the user can
      // always switch back. Independent of dismissal — dismissing only shrinks
      // the loud text chip down to the quiet icon button
      // (geneGlyphNoticeDismissed), it never removes the control.
      get showGeneGlyphNotice() {
        return [...self.rpcDataMap.values()].some(
          data => data.hasMultiIsoformGenes,
        )
      },

      /**
       * #getter
       * What picked the transcript each collapsed gene in the loaded view is
       * showing, summed over its regions: the chip names the commonest rule
       * (`RefSeq Select`) instead of only saying that transcripts are hidden.
       */
      get geneGlyphIsoformPicks() {
        return addTrimmedIsoformPicks(
          mergeIsoformPicks(
            [...self.rpcDataMap.values()].map(data => data.isoformPicks),
          ),
          [...this.geneGlyphTrimmedGenes.values()],
        )
      },

      // The genes the ladder's isoform rung actually took transcripts off, at
      // the count it committed to. Re-planned from the stacks rather than read
      // off the trimmed layout, because a trimmed gene draws exactly like a
      // gene with that many transcripts — nothing in the arrays says one was
      // cut. `planIsoformTrims` is the same function the pack ran, so the two
      // cannot disagree about which genes those are.
      get geneGlyphTrimmedGenes() {
        const maxIsoforms = self.fitStage.maxIsoforms
        const stacks: [string, IsoformStack][] = []
        const seen = new Set<string>()
        for (const data of self.rpcDataMap.values()) {
          for (const item of data.flatbushItems) {
            if (item.isoformStack && !seen.has(item.featureId)) {
              seen.add(item.featureId)
              stacks.push([item.featureId, item.isoformStack])
            }
          }
        }
        return planIsoformTrims(stacks, maxIsoforms, self.expandedGeneIdSet)
          .trims
      },

      /**
       * #getter
       * The isoform count the fit ladder trimmed to, or undefined when nothing
       * on screen was trimmed. Read off the solve that did the trimming
       * (`fitStage.maxIsoforms`) rather than off anything merely being hidden:
       * a region fetched under `longestCoding` reports every multi-isoform gene
       * as collapsed and the ladder never touched it.
       */
      get geneGlyphIsoformCap(): number | undefined {
        return self.fitStage.maxIsoforms
      },

      // Transcripts are being left out, so the control shows its loud chip
      // rather than the quiet icon button.
      get geneGlyphCollapsed() {
        return (
          this.effectiveGeneGlyphMode === 'longestCoding' ||
          this.geneGlyphIsoformCap !== undefined
        )
      },
    }))
    .views(self => {
      const { rpcProps: superRpcProps } = self
      return {
        rpcProps() {
          const base = superRpcProps()
          return {
            ...base,
            displayConfig: {
              ...base.displayConfig,
              // effectiveGeneGlyphMode is a zoom-dependent transform (not a plain
              // promotable resolve), so it's substituted here; the promotable
              // slots (chevrons, subfeatureLabels) are already resolved by the
              // base rpcProps via getConfigSnapshotWithPromotables.
              geneGlyphMode: self.effectiveGeneGlyphMode,
            },
            showOnlyGenes: self.showOnlyGenes,
          }
        },
      }
    })
    .actions(self => ({
      setSubfeatureLabels(value: DisplayConfig['subfeatureLabels']) {
        setConf(self, 'subfeatureLabels', value)
      },

      setGeneGlyphMode(value: DisplayConfig['geneGlyphMode']) {
        setConf(self, 'geneGlyphMode', value)
      },

      dismissGeneGlyphNotice() {
        self.geneGlyphNoticeDismissed = true
      },

      setShowOnlyGenes(value: boolean) {
        setConf(self, 'showOnlyGenes', value)
      },

      setDisplayDirectionalChevrons(value: boolean) {
        setConf(self, 'displayDirectionalChevrons', value)
      },
    }))
    .views(self => ({
      // Its own getter rather than the inline `isGeneLikeType(info.item.type)`
      // the one caller in this file would need, and in an EARLIER block than
      // that caller so `self` carries it there. jbrowse-plugin-msaview reads it
      // off the display; inlining it (684142b329) took "Launch MSA view" out of
      // the right-click menu on every gene track and nothing failed, because
      // the plugin still had contextMenuInfo and fetchFullFeature and its gate
      // simply read undefined. pluginFacingDisplayApi.test.ts is the guard.
      /**
       * #getter
       * whether the right-clicked feature is a gene, transcript or RNA
       */
      get isGeneLike() {
        return isGeneLikeType(self.contextMenuInfo?.item.type)
      },

      /**
       * #getter
       * This display's answer to the base's isoform-collapse chrome hook (see
       * `geneGlyphNotice` on the canvas base): absent unless the loaded data has
       * a multi-isoform gene, so switching modes is meaningful. Its own block,
       * after the actions it hands over, so `self` carries them.
       */
      get geneGlyphNotice() {
        return self.showGeneGlyphNotice
          ? {
              collapsed: self.geneGlyphCollapsed,
              maxIsoforms: self.geneGlyphIsoformCap,
              picks: self.geneGlyphIsoformPicks,
              dismissed: self.geneGlyphNoticeDismissed,
              mode: self.geneGlyphMode,
              setMode: self.setGeneGlyphMode,
              dismiss: self.dismissGeneGlyphNotice,
            }
          : undefined
      },

      /**
       * #getter
       * This display's answer to the base's `colorLegend` chrome hook, from the
       * `legend` config slot. A `jexl:` color expression is a lookup table whose
       * keys are readable only in the config, so the drawn feature carries the
       * color and nothing carries its meaning; declaring the vocabulary is the
       * only place that can come from. Empty slot draws nothing, so a track that
       * declares no key is unaffected.
       *
       * Not auto-derived: the color a feature is painted has no name attached to
       * it, and guessing one from a feature field would name whichever field
       * happened to correlate.
       */
      get colorLegend() {
        return getConf(self, 'legend') as LegendItem[]
      },

      /**
       * #method
       * Build the R ggplot gene-model panel for the view's "Export R script",
       * regenerating this feature track from source in ggplot2.
       */
      exportRCode(): RTrackFragment | undefined {
        return exportRCode(self as LinearBasicDisplayModel)
      },
    }))
    .views(self => {
      const superShowSubmenuCheckboxItems = self.showSubmenuCheckboxItems
      const superShowSubmenuRadioGroups = self.showSubmenuRadioGroups
      const superTrackMenuItems = self.trackMenuItems
      const superContextMenuItems = self.contextMenuItems
      const superFeatureNarrowings = self.featureNarrowings
      return {
        // "Show only genes" is a worker-side admission filter (see
        // featureAdmission.ts), so it is one of this display's narrowings —
        // otherwise a track showing only genes reports nothing is filtering it
        // and the track menu never offers "Clear filters".
        //
        // ONE override, where this used to be two: a `featureFilterCount` that
        // added to the base's total and a `clearAllFeatureFilters` that reset the
        // slot, held together by comments on each pointing at the other. The
        // count, the group clear and any row all derive from this entry now.
        featureNarrowings() {
          return {
            ...superFeatureNarrowings(),
            showOnlyGenes: {
              count: self.showOnlyGenes ? 1 : 0,
              clear: () => {
                self.setShowOnlyGenes(false)
              },
            },
          }
        },

        // Append gene-specific checkbox toggles after the base display toggles,
        // so the "Show..." submenu reads generic-then-gene-specific.
        showSubmenuCheckboxItems() {
          return [
            ...superShowSubmenuCheckboxItems(),
            toggleItem(
              'Show only genes',
              self.showOnlyGenes,
              self.setShowOnlyGenes,
            ),
            promotableToggleItem({
              label: 'Show chevrons',
              checked: self.displayDirectionalChevrons,
              onToggle: () => {
                self.setDisplayDirectionalChevrons(
                  !self.displayDirectionalChevrons,
                )
              },
              pin: makePin(self, 'displayDirectionalChevrons'),
            }),
          ]
        },
        // Append the promotable "Subfeature labels" radio group after the base
        // "Labels" group, through the same builder so the two label groups keep
        // the same shape, the same pin-per-option rule and the same
        // collapsed-mode note — `rpcProps` forces this slot to 'none' whenever
        // the display mode is collapsed, exactly as it drops the base group's.
        showSubmenuRadioGroups() {
          return [
            ...superShowSubmenuRadioGroups(),
            ...inlineRadioGroup(
              'Subfeature labels',
              self.subfeatureLabels,
              SUBFEATURE_LABEL_OPTIONS,
              mode => {
                self.setSubfeatureLabels(mode)
              },
              mode => makePin(self, 'subfeatureLabels', mode),
              inertLabelHint(
                self,
                self.subfeatureLabels,
                self.renderedShowSubfeatureLabels
                  ? undefined
                  : 'hidden while squeezed to fit',
              ),
            ),
          ]
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Gene glyph',
              icon: SegmentIcon,
              subMenu: [
                ...radioItems(
                  GENE_GLYPH_MODE_OPTIONS,
                  self.geneGlyphMode,
                  value => {
                    self.setGeneGlyphMode(value)
                  },
                ),
                // The way back from a run of per-gene expansions. Each badge
                // re-collapses its own gene, but a reader who opened six of them
                // across a locus has six badges to find again — and the ones
                // they panned away from are not on screen to find. Absent while
                // nothing is expanded, so the submenu stays the mode radio it is
                // on every ordinary track.
                ...(self.expandedGeneIds.length > 0
                  ? [
                      { type: 'divider' as const },
                      {
                        label: `Collapse ${self.expandedGeneIds.length} expanded ${pluralize(self.expandedGeneIds.length, 'gene')}`,
                        icon: UnfoldLessIcon,
                        onClick: () => {
                          self.clearExpandedGenes()
                        },
                      },
                    ]
                  : []),
              ],
            },
          ]
        },

        contextMenuItems() {
          const base = superContextMenuItems()
          const info = self.contextMenuInfo
          return info && self.isGeneLike
            ? [...base, collapseIntronsMenuItem(self, info)]
            : base
        },
      }
    })
}

type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
