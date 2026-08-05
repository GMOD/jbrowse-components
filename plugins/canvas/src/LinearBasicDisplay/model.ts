import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  makeCurrentValueDisplayTypeDefaultControl,
  makeDisplayTypeDefaultControl,
  readConfObject,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import {
  checkboxItem,
  promotableRadioItem,
  promotableToggleItem,
  radioItems,
} from '@jbrowse/core/ui'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import SegmentIcon from '@mui/icons-material/Segment'

import { getFeatureName } from '../RenderFeatureDataRPC/labelUtils.ts'
import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import { findSubfeatureById } from './baseModelHelpers.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
      // core/configuration/CLAUDE.md, "Read type narrowing".
      configuration: ConfigurationReference(configSchema),
    })
    .volatile(() => ({
      // Session-only acknowledgement of the "showing longest isoform" chip.
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

      // Isoforms are currently collapsed to a single transcript, so the control
      // shows its loud "Longest isoform" chip; otherwise it renders as the quiet
      // icon button.
      get geneGlyphCollapsed() {
        return this.effectiveGeneGlyphMode === 'longestCoding'
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
              dismissed: self.geneGlyphNoticeDismissed,
              mode: self.geneGlyphMode,
              setMode: self.setGeneGlyphMode,
              dismiss: self.dismissGeneGlyphNotice,
            }
          : undefined
      },
    }))
    .views(self => {
      const superShowSubmenuCheckboxItems = self.showSubmenuCheckboxItems
      const superShowSubmenuRadioGroups = self.showSubmenuRadioGroups
      const superTrackMenuItems = self.trackMenuItems
      const superContextMenuItems = self.contextMenuItems
      const superHasFeatureFilters = self.hasFeatureFilters
      return {
        // "Show only genes" is a worker-side admission filter (see
        // featureAdmission.ts), so it counts here — otherwise a track showing
        // only genes reports nothing is filtering it and the track menu never
        // offers "Clear filters".
        hasFeatureFilters() {
          return superHasFeatureFilters() || self.showOnlyGenes
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
              displayTypeDefault: makeCurrentValueDisplayTypeDefaultControl(
                self,
                'displayDirectionalChevrons',
              ),
            }),
          ]
        },
        // Append the promotable "Subfeature labels" radio group after the base
        // "Labels" group; each option carries a "make default" pin.
        showSubmenuRadioGroups() {
          return [
            ...superShowSubmenuRadioGroups(),
            { type: 'subHeader' as const, label: 'Subfeature labels' },
            ...SUBFEATURE_LABEL_OPTIONS.map(option =>
              promotableRadioItem({
                label: option.label,
                checked: self.subfeatureLabels === option.value,
                onClick: () => {
                  self.setSubfeatureLabels(option.value)
                },
                displayTypeDefault: makeDisplayTypeDefaultControl(
                  self,
                  'subfeatureLabels',
                  option.value,
                ),
              }),
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
          return [
            ...base,
            transcriptHit
              ? {
                  label: 'Collapse introns',
                  icon: CloseFullscreenIcon,
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
                  label: 'Collapse introns',
                  icon: CloseFullscreenIcon,
                  onClick: async () => {
                    await openDialog()
                  },
                },
          ]
        },
      }
    })
    .actions(self => {
      const superClearAllFeatureFilters = self.clearAllFeatureFilters
      return {
        // The other half of the hasFeatureFilters override above: "Clear
        // filters" has to actually clear the gene-only view too, or it leaves
        // the one filter it was offered for still in effect.
        clearAllFeatureFilters() {
          superClearAllFeatureFilters()
          self.setShowOnlyGenes(false)
        },
      }
    })
}

type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
