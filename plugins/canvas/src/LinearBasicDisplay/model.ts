import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  makePin,
  readConfObject,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import {
  checkboxItem,
  promotableRadioItems,
  promotableToggleItem,
  radioItems,
} from '@jbrowse/core/ui/menuItems'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import SegmentIcon from '@mui/icons-material/Segment'
import { autorun } from 'mobx'

import {
  FALLBACK_FEATURE_HEIGHT,
  HEIGHT_MULTIPLIERS,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { TRANSCRIPT_PADDING_RATIO as ISOFORM_GAP_RATIO } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { getFeatureName } from '../RenderFeatureDataRPC/labelUtils.ts'
import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import { findSubfeatureById } from './baseModelHelpers.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

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

// Loose type test, matched case-insensitively like isCDS/isExon: real GFFs
// carry 'mRNA', 'lnc_RNA', 'protein_coding_gene', 'transcript'. Gates the
// collapse-introns menu item on the clicked feature and its transcript scope on
// the clicked subfeature, so a mature-protein or repeat subpart hit doesn't
// offer to collapse itself.
function isGeneLikeType(type: string | undefined) {
  const t = (type ?? '').toLowerCase()
  return t.includes('gene') || t.includes('rna') || t.includes('transcript')
}

// How long a track height has to hold still before the isoform cap follows it.
// The resize handle writes the height on every drag frame (TrackContainer ->
// resizeHeight -> setConf), and the cap is an RPC cache key, so an undelayed
// read of it re-runs the worker at every row boundary the drag crosses.
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
      // Session-only acknowledgement of the "showing longest isoform" chip.
      // Dismissing collapses the loud text chip down to the quiet icon button
      // for the session (the button stays, so re-opening the menu is always one
      // click away); it never changes the collapse itself. Volatile, so a
      // reload is the natural reset boundary.
      geneGlyphNoticeDismissed: false,

      // Same reset boundary for the declared color key's "×".
      colorLegendDismissed: false,

      // The track height the isoform cap is computed against, updated on a
      // delay (see the autorun in afterAttach). The live height cannot be read
      // for this: it is what `maxIsoforms` is derived from, `maxIsoforms` is an
      // RPC cache key, and the resize handle writes the height on every drag
      // frame — so a read of the live value re-runs the whole worker pipeline
      // a few dozen times over one drag. That is the exact failure
      // `pickDisplayConfig` exists to have stopped happening for `height`
      // itself; this is the one derived value that has to bring it back, so it
      // brings back the debounce with it, the way `coarseBpPerPx` does for
      // zoom.
      //
      // 0 means "not measured yet", which reads as no cap.
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

      /**
       * #getter
       * How many isoforms a gene may draw, or undefined for no cap.
       *
       * **`auto` has two reasons to hide transcripts, and this is the second
       * one.** The first is zoom (above): past 100 bp/px a transcript is a few
       * pixels wide and there is nothing to compare. The second is ROOM — a
       * gene with 28 transcripts in a 100 px lane draws them all inside the
       * lane's own scrollbar, so the last rows and the gene's name are off the
       * bottom of a track that gives no sign of it. That is the state
       * `genomes_basics/search_tp53` was denied for: "it should truncate the
       * number of isoforms so that it fits in the display height".
       *
       * The cap counts rows, so it is the same arithmetic the packer does: a
       * transcript row is the body height at this display mode plus the
       * inter-transcript gap `layoutSubfeatures` spends (its
       * TRANSCRIPT_PADDING_RATIO), and one row is kept back for the gene's own
       * label. It is deliberately not exact — a jexl `featureHeight` resolves
       * per feature and the worker is the only place that can evaluate it, so a
       * callback height falls back to the same 10 px the worker's own fallback
       * uses. Being a row out costs a row of whitespace or a row of scroll,
       * where being absent costs the 21 rows this is about.
       *
       * OFF IN `grow`, and that is the one gate that is load-bearing rather
       * than a nicety: grow's height IS its content's height, so a cap read off
       * it would be a fetch-derived value in `rpcProps()` — the loop trap
       * `makeSettingsLoopGuard` exists to name. `fitTargetHeight` is the raw
       * slot in every other mode, which is why it is read instead of `height`.
       * `fit` keeps the cap and wants it: squeezing 28 transcripts into 100 px
       * is what its 2 px floor does, and 2 px of transcript is not a reading.
       */
      get effectiveMaxIsoforms(): number | undefined {
        if (this.geneGlyphMode !== 'auto' || self.heightMode === 'grow') {
          return undefined
        }
        const height = self.coarseTrackHeight
        if (!height) {
          return undefined
        }
        const raw = readConfObject(self.configuration, 'featureHeight')
        const body =
          typeof raw === 'number' && raw > 0 ? raw : FALLBACK_FEATURE_HEIGHT
        const rowPx =
          body * HEIGHT_MULTIPLIERS[self.displayMode] * (1 + ISOFORM_GAP_RATIO)
        return Math.max(1, Math.floor(height / rowPx) - 1)
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
       * The height cap, when the cap is what is actually hiding transcripts —
       * so `undefined` covers both "no cap" and "a cap every gene in view fits
       * inside", which the control must not announce.
       *
       * `effectiveMaxIsoforms` alone cannot answer that: it is defined for the
       * whole of `auto`, including at a zoom where the mode has already
       * resolved to `longestCoding` and the cap is doing nothing. The worker's
       * `isoformsHidden` says a gene really lost isoforms; the mode test says
       * which of the two rules took them.
       */
      get geneGlyphIsoformCap(): number | undefined {
        const cap = this.effectiveMaxIsoforms
        return this.effectiveGeneGlyphMode !== 'longestCoding' &&
          cap !== undefined &&
          [...self.rpcDataMap.values()].some(data => data.isoformsHidden)
          ? cap
          : undefined
      },

      // Transcripts are being left out, so the control shows its loud chip
      // rather than the quiet icon button.
      //
      // Two ways that happens and they are answered from different places. The
      // `longestCoding` mode is the display's own resolved decision, so it is
      // read off the mode and not off the data — which is what keeps it from
      // lagging a region behind while a refetch lands. The height cap is a
      // property of the genes in view (a gene with two isoforms in a 100 px
      // lane loses nothing), so the worker has to say whether it fired.
      get geneGlyphCollapsed() {
        return (
          this.effectiveGeneGlyphMode === 'longestCoding' ||
          this.geneGlyphIsoformCap !== undefined
        )
      },

      get isGeneLike() {
        return isGeneLikeType(self.contextMenuInfo?.item.type)
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
              // …and the height-derived cap, for the same reason: it is not a
              // slot at all, so `pickDisplayConfig` reads `undefined` for it and
              // the resolved value is written over that here. Its own debounce
              // is `coarseTrackHeight`, since this payload is the RPC cache key.
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
      // No superAfterAttach() call: the fork auto-chains hooks, so the canvas
      // base's own afterAttach still runs (afterAttachAutoChain.test.ts).
      afterAttach() {
        // Seeded SYNCHRONOUSLY, because a delayed autorun's first run is
        // delayed too — that would spend an uncapped round trip on every track
        // load and throw it away a moment later. `fitTargetHeight` is the raw
        // height slot, so it is readable before the view is measured.
        self.setCoarseTrackHeight(
          self.heightMode === 'grow' ? 0 : self.fitTargetHeight,
        )
        addDisposer(
          self,
          autorun(
            () => {
              // The reads are here rather than inside the action: an MST action
              // runs untracked, so an autorun whose whole body was a call would
              // have no dependencies and fire exactly once.
              const height =
                self.heightMode === 'grow' ? 0 : self.fitTargetHeight
              self.setCoarseTrackHeight(height)
            },
            { delay: HEIGHT_SETTLE_MS, name: 'CanvasCoarseTrackHeight' },
          ),
        )
      },
    }))
    .views(self => ({
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
            checkboxItem('Show only genes', self.showOnlyGenes, () => {
              self.setShowOnlyGenes(!self.showOnlyGenes)
            }),
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
          if (!info || !self.isGeneLike) {
            return base
          }
          const {
            item: { featureId },
            subfeature,
            displayedRegionIndex,
          } = info
          // `subfeatureId` scopes the collapse to the isoform actually clicked;
          // omitted, the whole gene's transcripts are unioned. A gene glyph's
          // transcript hit boxes cover its entire span, so a glyph right-click
          // always resolves to a transcript and the two scopes have to be
          // offered side by side (same shape as the Highlight submenu) rather
          // than narrowing unconditionally, which would leave no way to ask for
          // the union.
          const openDialog = async (subfeatureId?: string) => {
            const session = getSession(self)
            const fullFeature = await self.fetchFullFeature(
              featureId,
              displayedRegionIndex,
            )
            // isAlive guards against the display being closed while
            // fetchFullFeature was in flight; getView/getContainingTrack
            // below would throw on a detached node.
            if (!fullFeature || !isAlive(self)) {
              return
            }
            const target =
              subfeatureId === undefined
                ? fullFeature
                : findSubfeatureById(fullFeature, subfeatureId)
            if (!target) {
              session.notify('Could not find the clicked transcript', 'warning')
              return
            }
            const transcripts = getTranscripts(target)
            if (!hasIntrons(transcripts)) {
              session.notify('No introns found in this feature', 'info')
              return
            }
            const view = getView(self)
            const assemblyName = view.assemblyNames[0]
            const assembly = assemblyName
              ? session.assemblyManager.get(assemblyName)
              : undefined
            if (assembly) {
              const trackId = readConfObject(
                getContainingTrack(self).configuration,
                'trackId',
              )
              session.queueDialog(handleClose => [
                CollapseIntronsDialog,
                {
                  view,
                  transcripts,
                  handleClose,
                  assembly,
                  // solo is an exact uniqueId match and a gene-shaped feature
                  // draws from its top-level id, so this stays the gene even
                  // when a single transcript was picked
                  featureId,
                  // names the resulting view; the scope that was chosen, not
                  // transcripts[0], since the gene scope collapses the union of
                  // all its transcripts
                  featureName: getFeatureName(target) ?? 'feature',
                  trackId,
                },
              ])
            } else {
              // silently doing nothing here reads as a broken menu item
              session.notify(
                "Could not resolve this view's assembly, which is needed to clamp the collapsed regions",
                'warning',
              )
            }
          }
          const transcriptHit =
            subfeature && isGeneLikeType(subfeature.type)
              ? subfeature
              : undefined
          // One row's identity, spread into whichever of the two shapes the hit
          // earns — a submenu of the two scopes, or the plain gene-scope action.
          // Written once so the two can't drift into reading as two different
          // menu entries.
          const collapseIntrons = {
            label: 'Collapse introns',
            icon: CloseFullscreenIcon,
          }
          return [
            ...base,
            transcriptHit
              ? {
                  ...collapseIntrons,
                  subMenu: [
                    {
                      label: transcriptHit.displayLabel
                        ? `This transcript (${transcriptHit.displayLabel})`
                        : 'This transcript',
                      onClick: async () => {
                        await openDialog(transcriptHit.featureId)
                      },
                    },
                    {
                      label: 'All transcripts',
                      onClick: async () => {
                        await openDialog()
                      },
                    },
                  ],
                }
              : {
                  ...collapseIntrons,
                  onClick: async () => {
                    await openDialog()
                  },
                },
          ]
        },
      }
    })
}

type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
