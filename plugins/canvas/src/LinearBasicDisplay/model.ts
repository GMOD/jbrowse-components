import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'

import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import { radioSubMenu } from './baseModelHelpers.ts'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type {
  DisplayConfig,
  DisplayMode,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

export type { Region } from '@jbrowse/core/util'

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the
 * shared canvas base display (`LinearCanvasBaseDisplay`). This is the GPU
 * stack — despite the name it does NOT extend `BaseLinearDisplay` (the legacy
 * block stack). See agent-docs/TRACK_DISPLAY_CONCEPTS.md.
 *
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` switches between `normal`, `compact`,
 * `superCompact`, `reducedRepresentation`, and `collapse`:
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
      get subfeatureLabels(): DisplayConfig['subfeatureLabels'] {
        return self.getConfWithOverride(
          'subfeatureLabels',
        ) as DisplayConfig['subfeatureLabels']
      },

      get displayMode(): DisplayMode {
        return self.getConfWithOverride('displayMode') as DisplayMode
      },

      get geneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        return self.getConfWithOverride(
          'geneGlyphMode',
        ) as DisplayConfig['geneGlyphMode']
      },

      get displayDirectionalChevrons() {
        return self.getConfWithOverride('displayDirectionalChevrons')
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
              geneGlyphMode: self.effectiveGeneGlyphMode,
            },
            showOnlyGenes: self.showOnlyGenes,
          }
        },
      }
    })
    .actions(self => ({
      setSubfeatureLabels(value: DisplayConfig['subfeatureLabels']) {
        self.setOverride('subfeatureLabels', value)
      },

      setGeneGlyphMode(value: DisplayConfig['geneGlyphMode']) {
        self.setOverride('geneGlyphMode', value)
      },

      setDisplayMode(value: DisplayMode) {
        self.setOverride('displayMode', value)
      },

      setCompactness(level: 'normal' | 'compact' | 'super-compact') {
        self.setOverride(
          'displayMode',
          level === 'super-compact' ? 'superCompact' : level,
        )
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      setDisplayDirectionalChevrons(value: boolean) {
        self.setOverride('displayDirectionalChevrons', value)
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
              label: 'Show subfeature labels',
              type: 'checkbox' as const,
              checked: self.subfeatureLabels !== 'none',
              onClick: () => {
                self.setSubfeatureLabels(
                  self.subfeatureLabels === 'none' ? 'overlay' : 'none',
                )
              },
            },
            {
              label: 'Show only genes',
              type: 'checkbox' as const,
              checked: self.showOnlyGenes,
              onClick: () => {
                self.setShowOnlyGenes(!self.showOnlyGenes)
              },
            },
            {
              label: 'Show chevrons',
              type: 'checkbox' as const,
              checked: self.displayDirectionalChevrons,
              onClick: () => {
                self.setDisplayDirectionalChevrons(
                  !self.displayDirectionalChevrons,
                )
              },
            },
          ]
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            radioSubMenu(
              'Gene glyph',
              self.geneGlyphMode,
              [
                { value: 'auto', label: 'Auto' },
                { value: 'all', label: 'All transcripts' },
                { value: 'longestCoding', label: 'Longest coding transcript' },
              ],
              value => {
                self.setGeneGlyphMode(value)
              },
            ),
            radioSubMenu(
              'Display mode',
              self.displayMode,
              [
                { value: 'normal', label: 'Normal' },
                { value: 'compact', label: 'Compact' },
                { value: 'superCompact', label: 'Super-compact' },
              ],
              value => {
                self.setDisplayMode(value)
              },
            ),
          ]
        },

        contextMenuItems() {
          const base = superContextMenuItems()
          if (base.length === 0 || !self.isGeneLike) {
            return base
          }
          const info = self.contextMenuInfo!
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
                if (!fullFeature) {
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
                  session.queueDialog(handleClose => [
                    CollapseIntronsDialog,
                    { view, transcripts, handleClose, assembly },
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
