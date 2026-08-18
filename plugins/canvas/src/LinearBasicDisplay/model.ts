import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import {
  promotableRadioItems,
  promotableToggleItem,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import SegmentIcon from '@mui/icons-material/Segment'
import { autorun } from 'mobx'

import { budgetFeatureHeightPx } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  anyIsoformsHidden,
  mergeIsoformPicks,
} from '../RenderFeatureDataRPC/isoformPicks.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import {
  collapseIntronsMenuItem,
  isGeneLikeType,
} from './collapseIntronsMenu.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'
import { geneRowCostPx, isoformRowBudget } from './isoformBudget.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { Region } from '@jbrowse/core/util'

// Radio options for the "Subfeature labels" submenu. 'none' is the promotedBase
// of the promotable slot; every option is still customizable so any mode can be
// promoted back over another session default (mirrors the displayMode menu).
const SUBFEATURE_LABEL_OPTIONS = [
  { value: 'none', label: 'Off' },
  { value: 'below', label: 'Below' },
  { value: 'overlay', label: 'Overlay' },
] as const satisfies readonly {
  value: DisplayConfig['subfeatureLabels']
  label: string
}[]

// How long a track height has to hold still before the isoform cap follows it.
const HEIGHT_SETTLE_MS = 300

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

      // Same reset boundary for the declared color key's "×".
      colorLegendDismissed: false,

      // The track height the isoform cap is computed against, debounced (see
      // afterAttach). `maxIsoforms` is an RPC cache key and the resize handle
      // writes the height every drag frame, so reading it live re-runs the
      // worker pipeline dozens of times per drag. 0 = not measured, no cap.
      coarseTrackHeight: 0,
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

      // The height the isoform cap is measured against, before the debounce
      // `coarseTrackHeight` puts on it. `fitTargetHeight` is the raw slot, so
      // it reads before the view is measured; grow reports 0 (no cap) for the
      // reason effectiveMaxIsoforms gives.
      get cappableTrackHeight() {
        return self.heightMode === 'grow' ? 0 : self.fitTargetHeight
      },

      /**
       * #getter
       * How many isoforms a gene may draw, or undefined for no cap — `auto`'s
       * second reason to hide transcripts, after zoom: a gene with 28 of them
       * in a 100px lane draws all 28 inside the lane's own scrollbar.
       *
       * Rows, so it is the packer's own arithmetic solved for n rather than
       * approximated — see `geneRowCostPx` in isoformBudget.ts, which owns the
       * mirror of `decideLabelReservations` and the test pinning the two
       * together. This getter is only the display's half: which state turns the
       * cap on, and which height it is measured against.
       *
       * Only while the resolved mode is `all`: under `longestCoding` the worker
       * ignores it, so leaving it live would put a resize drag into the RPC
       * cache key for nothing.
       *
       * OFF in `grow`, and that gate is load-bearing: grow's height IS its
       * content's, so a cap read off it would be a fetch-derived value in
       * `rpcProps()` (the loop trap `makeSettingsLoopGuard` names). Hence
       * `fitTargetHeight`, the raw slot, rather than `height` (see
       * `cappableTrackHeight`).
       */
      get effectiveMaxIsoforms(): number | undefined {
        return this.geneGlyphMode !== 'auto' ||
          this.effectiveGeneGlyphMode !== 'all' ||
          self.heightMode === 'grow' ||
          !self.coarseTrackHeight
          ? undefined
          : isoformRowBudget(
              self.coarseTrackHeight,
              geneRowCostPx({
                featureHeightPx: budgetFeatureHeightPx(
                  self.configuration.featureHeight,
                ),
                displayMode: self.displayMode,
                subfeatureLabelsBelow: this.subfeatureLabels === 'below',
              }),
            )
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
        return mergeIsoformPicks(
          [...self.rpcDataMap.values()].map(data => data.isoformPicks),
        )
      },

      /**
       * #getter
       * The height cap, only when the cap is what is hiding transcripts — so
       * `undefined` also covers a cap every gene in view fits inside, which the
       * control must not announce.
       */
      get geneGlyphIsoformCap(): number | undefined {
        const cap = this.effectiveMaxIsoforms
        return cap !== undefined &&
          anyIsoformsHidden(this.geneGlyphIsoformPicks)
          ? cap
          : undefined
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
              // same reason — not a slot, so pickDisplayConfig reads undefined
              maxIsoforms: self.effectiveMaxIsoforms,
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

      setCoarseTrackHeight(height: number) {
        self.coarseTrackHeight = height
      },

      setColorLegendDismissed(value: boolean) {
        self.colorLegendDismissed = value
      },

      setShowOnlyGenes(value: boolean) {
        setConf(self, 'showOnlyGenes', value)
      },

      setDisplayDirectionalChevrons(value: boolean) {
        setConf(self, 'displayDirectionalChevrons', value)
      },
    }))
    .actions(self => ({
      // No superAfterAttach(): the fork auto-chains hooks.
      afterAttach() {
        // Seeded synchronously: a delayed autorun's first run is delayed too,
        // which would spend an uncapped round trip on every track load.
        self.setCoarseTrackHeight(self.cappableTrackHeight)
        addDisposer(
          self,
          autorun(
            () => {
              // read here, not in the action — an MST action runs untracked
              self.setCoarseTrackHeight(self.cappableTrackHeight)
            },
            { delay: HEIGHT_SETTLE_MS, name: 'CanvasCoarseTrackHeight' },
          ),
        )
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
        const items = getConf(self, 'legend') as LegendItem[]
        // Present whenever the slot declares a key, dismissed or not — see
        // CanvasColorLegend for why dismissal is a flag on the hook rather than
        // the hook's absence.
        return items.length > 0
          ? {
              items,
              dismissed: self.colorLegendDismissed,
              setDismissed: self.setColorLegendDismissed,
            }
          : undefined
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
        // "Labels" group; each option carries a "make default" pin.
        showSubmenuRadioGroups() {
          return [
            ...superShowSubmenuRadioGroups(),
            { type: 'subHeader' as const, label: 'Subfeature labels' },
            ...promotableRadioItems(
              SUBFEATURE_LABEL_OPTIONS,
              self.subfeatureLabels,
              mode => {
                self.setSubfeatureLabels(mode)
              },
              mode => makePin(self, 'subfeatureLabels', mode),
            ),
          ]
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Gene glyph',
              icon: SegmentIcon,
              subMenu: radioItems(
                GENE_GLYPH_MODE_OPTIONS,
                self.geneGlyphMode,
                value => {
                  self.setGeneGlyphMode(value)
                },
              ),
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
