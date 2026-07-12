import { lazy } from 'react'

import {
  getConf,
  getConfResolved,
  makeCurrentValueSessionDefaultControl,
  makeSessionDefaultControl,
  readConfObject,
} from '@jbrowse/core/configuration'
import { promotableRadioItem, promotableToggleItem } from '@jbrowse/core/ui'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import SegmentIcon from '@mui/icons-material/Segment'

import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import { radioSubMenu } from './baseModelHelpers.ts'
import { GENE_GLYPH_MODE_OPTIONS } from './geneGlyphMode.ts'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

export type { Region } from '@jbrowse/core/util'

// Radio options for the "Subfeature labels" submenu. 'none' is the promotedBase
// of the promotable slot; every option is still pinnable so any mode can be
// promoted back over another session default (mirrors the displayMode menu).
const SUBFEATURE_LABEL_OPTIONS = [
  { value: 'none', label: 'Off' },
  { value: 'below', label: 'Below' },
  { value: 'overlay', label: 'Overlay' },
] as const satisfies readonly {
  value: Exclude<DisplayConfig['subfeatureLabels'], 'inherit'>
  label: string
}[]

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the
 * shared canvas base display (`LinearCanvasBaseDisplay`). This is the GPU
 * stack — despite the name it does NOT extend `BaseLinearDisplay` (the legacy
 * block stack). See agent-docs/ARCHITECTURE.md "Display stacks".
 *
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
 * or `superCompact`):
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
  configSchema: AnyConfigurationSchemaType,
) {
  return baseStateModelFactory(configSchema)
    .props({
      type: types.literal('LinearBasicDisplay'),
      showOnlyGenes: types.stripDefault(types.boolean, false),
    })
    .views(self => ({
      // Promotable sentinel enum (see baseConfigSchema.ts): getConfResolved walks
      // the cascade (pinned track value -> session default -> base 'none') and
      // always yields a real mode, never the 'inherit' sentinel.
      get subfeatureLabels(): DisplayConfig['subfeatureLabels'] {
        return getConfResolved(self, 'subfeatureLabels')
      },

      get geneGlyphMode() {
        return getConf(self, 'geneGlyphMode')
      },

      // Promotable `maybeBoolean` slot (see baseConfigSchema.ts): getConfResolved
      // walks the cascade (pinned track value -> session default -> base `true`)
      // and always yields a concrete boolean, never the unset sentinel.
      get displayDirectionalChevrons(): boolean {
        return getConfResolved(self, 'displayDirectionalChevrons')
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

      // Persistent gene-glyph control gate: shown whenever the loaded data has a
      // gene with >1 isoform, so there's an actual auto/all/longestCoding choice
      // to make. Independent of the current mode (unlike the old collapse-only
      // notice) since the control stays available to switch back and forth.
      get showGeneGlyphControl() {
        return [...self.rpcDataMap.values()].some(
          data => data.hasMultiIsoformGenes,
        )
      },

      get isGeneLike() {
        const type = (self.contextMenuInfo?.item.type ?? '').toLowerCase()
        return (
          type.includes('gene') ||
          type.includes('rna') ||
          type.includes('transcript')
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
              // base rpcProps via resolvePromotableConfigSnapshot.
              geneGlyphMode: self.effectiveGeneGlyphMode,
            },
            showOnlyGenes: self.showOnlyGenes,
          }
        },
      }
    })
    .actions(self => ({
      setSubfeatureLabels(value: DisplayConfig['subfeatureLabels']) {
        self.configuration.setSlot('subfeatureLabels', value)
      },

      setGeneGlyphMode(value: DisplayConfig['geneGlyphMode']) {
        self.configuration.setSlot('geneGlyphMode', value)
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      setDisplayDirectionalChevrons(value: boolean) {
        self.configuration.setSlot('displayDirectionalChevrons', value)
      },
    }))
    .views(self => {
      const superShowSubmenuMenuItems = self.showSubmenuMenuItems
      const superTrackMenuItems = self.trackMenuItems
      const superContextMenuItems = self.contextMenuItems
      return {
        // Append gene-specific toggles to the base "Show..." submenu.
        showSubmenuMenuItems() {
          return [
            ...superShowSubmenuMenuItems(),
            {
              label: 'Subfeature labels',
              subMenu: SUBFEATURE_LABEL_OPTIONS.map(option =>
                promotableRadioItem({
                  label: option.label,
                  checked: self.subfeatureLabels === option.value,
                  onClick: () => {
                    self.setSubfeatureLabels(option.value)
                  },
                  sessionDefault: makeSessionDefaultControl(
                    self,
                    'subfeatureLabels',
                    option.value,
                  ),
                }),
              ),
            },
            {
              label: 'Show only genes',
              type: 'checkbox' as const,
              checked: self.showOnlyGenes,
              onClick: () => {
                self.setShowOnlyGenes(!self.showOnlyGenes)
              },
            },
            promotableToggleItem({
              label: 'Show chevrons',
              checked: self.displayDirectionalChevrons,
              onToggle: () => {
                self.setDisplayDirectionalChevrons(
                  !self.displayDirectionalChevrons,
                )
              },
              sessionDefault: makeCurrentValueSessionDefaultControl(self, [
                'displayDirectionalChevrons',
              ]),
            }),
          ]
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              icon: SegmentIcon,
              ...radioSubMenu(
                'Gene glyph',
                self.geneGlyphMode,
                GENE_GLYPH_MODE_OPTIONS,
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
            displayedRegionIndex,
          } = info
          return [
            ...base,
            {
              label: 'Collapse introns',
              icon: CloseFullscreenIcon,
              onClick: async () => {
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
                const transcripts = getTranscripts(fullFeature)
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
                      featureId,
                      trackId,
                    },
                  ])
                }
              },
            },
          ]
        },
      }
    })
}

type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
