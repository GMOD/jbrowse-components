import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { pluralize } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import SegmentIcon from '@mui/icons-material/Segment'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'

import { SUBFEATURE_LABEL_OPTIONS } from '../RenderFeatureDataRPC/displayModes.ts'
import {
  addTrimmedIsoformPicks,
  mergeIsoformPicks,
} from '../RenderFeatureDataRPC/isoformPicks.ts'
import baseStateModelFactory from './baseModel.ts'
import {
  collapseIntronsMenuItem,
  isGeneLikeType,
} from './collapseIntronsMenu.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'
import { planIsoformTrims } from './isoformTrim.ts'
import { inertLabelHint, inlineRadioGroup } from './trackMenus.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { IsoformStack } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  LinearBasicDisplayConfig,
  LinearBasicDisplayConfigModel,
} from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { Region } from '@jbrowse/core/util'

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the shared
 * canvas base display (`LinearCanvasBaseDisplay`).
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
      // Reclaims this display's own slots: the base declares `configuration`
      // off the shared canvas schema, so `getConf`/`setConf` there see only
      // base slots.
      configuration: ConfigurationReference(configSchema),
    })
    .volatile(() => ({
      geneGlyphNoticeDismissed: false,
    }))
    .views(self => ({
      /**
       * #getter
       * The config typed off this display's own schema, reclaiming its slots
       * for direct reads the way `configuration` above does for `getConf`.
       */
      get conf(): LinearBasicDisplayConfig {
        return self.configuration
      },

      get subfeatureLabels(): DisplayConfig['subfeatureLabels'] {
        return resolveConf(self, 'subfeatureLabels')
      },

      get geneGlyphMode() {
        return getConf(self, 'geneGlyphMode')
      },

      // A config slot, not a display prop: MST drops a snapshot key the
      // schema never declared, so a config carrying `showOnlyGenes` silently
      // did nothing.
      get showOnlyGenes(): boolean {
        return getConf(self, 'showOnlyGenes')
      },

      get displayDirectionalChevrons(): boolean {
        return resolveConf(self, 'displayDirectionalChevrons')
      },

      // Off the debounced zoom, so a gesture crossing the `auto` threshold
      // moves `zoomFetchKey` once it settles, on the layout's cadence.
      get effectiveGeneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        return this.geneGlyphMode === 'auto'
          ? containingLgv(self).coarseBpPerPx > 100
            ? 'longestCoding'
            : 'all'
          : this.geneGlyphMode
      },

      // Off the raw mode, not `effectiveGeneGlyphMode`: `auto` resolves to
      // `all` under 100bp/px and its job is to fit the track; only the user
      // picking "All transcripts" withholds the trim.
      get showsEveryIsoform() {
        return this.geneGlyphMode === 'all'
      },

      // Shown in every mode, so picking "All transcripts" from the control
      // does not make the control disappear.
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

      // Re-planned from the stacks rather than read off the trimmed layout,
      // because a trimmed gene draws exactly like a gene with that many
      // transcripts.
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
        return planIsoformTrims(
          stacks,
          maxIsoforms,
          self.expandedGeneIdSet,
          self.layoutInputs.bpPerPx,
        ).trims
      },

      /**
       * #getter
       * The isoform count the fit ladder trimmed to, or undefined when
       * nothing on screen was trimmed.
       */
      get geneGlyphIsoformCap(): number | undefined {
        return self.fitStage.maxIsoforms
      },

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
          return {
            ...superRpcProps(),
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
      // Its own getter in an earlier block than its caller:
      // jbrowse-plugin-msaview reads it off the display, and inlining it took
      // "Launch MSA view" out of every gene track's menu with nothing
      // failing; pluginFacingDisplayApi.test.ts is the guard.
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
       * `geneGlyphNotice` on the canvas base): absent unless the loaded data
       * has a multi-isoform gene, so switching modes is meaningful.
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
       * This display's answer to the base's `colorLegend` chrome hook, from
       * the `legend` config slot.
       */
      get colorLegend() {
        return getConf(self, 'legend') as LegendItem[]
      },
    }))
    .views(self => {
      const superShowSubmenuCheckboxItems = self.showSubmenuCheckboxItems
      const superShowSubmenuRadioGroups = self.showSubmenuRadioGroups
      const superTrackMenuItems = self.trackMenuItems
      const superContextMenuItems = self.contextMenuItems
      const superFeatureNarrowings = self.featureNarrowings
      return {
        // "Show only genes" is a worker-side admission filter, so it is one
        // of this display's narrowings; otherwise the track menu never offers
        // "Clear filters".
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

        showSubmenuCheckboxItems() {
          return [
            ...superShowSubmenuCheckboxItems(),
            toggleItem(
              'Show only genes',
              self.showOnlyGenes,
              self.setShowOnlyGenes,
            ),
            toggleItem(
              'Show chevrons',
              self.displayDirectionalChevrons,
              show => {
                self.setDisplayDirectionalChevrons(show)
              },
              { pin: makePin(self, 'displayDirectionalChevrons') },
            ),
          ]
        },
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
                self.renderedShowSubfeatureLabels ? undefined : 'hidden to fit',
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
                // Absent while nothing is expanded, so the submenu stays the
                // mode radio on every ordinary track.
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
