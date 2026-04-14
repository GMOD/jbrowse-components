import { lazy } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'

import baseStateModelFactory, {
  fetchCanvasFeatureDetails,
} from './baseModel.ts'
import {
  getTranscripts,
  hasIntrons,
} from './components/CollapseIntronsDialog/util.ts'

const CollapseIntronsDialog = lazy(
  () => import('./components/CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the
 * shared canvas base display.
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return baseStateModelFactory(configSchema)
    .props({
      type: types.literal('LinearBasicDisplay'),
      showOnlyGenes: false,
    })
    .views(self => ({
      get subfeatureLabels() {
        return self.getConfWithOverride<string>('subfeatureLabels')
      },

      get displayMode() {
        return self.getConfWithOverride<string>('displayMode')
      },

      get geneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        return self.getConfWithOverride<DisplayConfig['geneGlyphMode']>(
          'geneGlyphMode',
        )
      },

      get displayDirectionalChevrons() {
        return self.getConfWithOverride<boolean>('displayDirectionalChevrons')
      },

      get effectiveGeneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        if (this.geneGlyphMode === 'auto') {
          const view = getContainingView(self) as LGV
          return view.bpPerPx > 100 ? 'longestCoding' : 'all'
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
    .views(self => ({
      get displayConfigOverrides(): Record<string, unknown> {
        return { geneGlyphMode: self.effectiveGeneGlyphMode }
      },

      get extraRpcArgs(): Record<string, unknown> {
        return { showOnlyGenes: self.showOnlyGenes }
      },

      get settingsCacheKey(): Record<string, unknown> {
        return {
          subfeatureLabels: self.subfeatureLabels,
          geneGlyphMode: self.effectiveGeneGlyphMode,
          showOnlyGenes: self.showOnlyGenes,
          displayMode: self.displayMode,
        }
      },
    }))
    .actions(self => ({
      setSubfeatureLabels(value: string) {
        self.setOverride('subfeatureLabels', value)
      },

      setGeneGlyphMode(value: string) {
        self.setOverride('geneGlyphMode', value)
      },

      setDisplayMode(value: string) {
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
            {
              label: 'Subfeature labels',
              subMenu: (
                [
                  { value: 'none', label: 'None' },
                  { value: 'overlay', label: 'Overlay' },
                  { value: 'below', label: 'Below' },
                ] as const
              ).map(({ value, label }) => ({
                label,
                type: 'radio' as const,
                checked: self.subfeatureLabels === value,
                onClick: () => {
                  self.setSubfeatureLabels(value)
                },
              })),
            },
            {
              label: 'Gene glyph',
              subMenu: (
                [
                  { value: 'auto', label: 'Auto' },
                  { value: 'all', label: 'All transcripts' },
                  { value: 'longest', label: 'Longest transcript' },
                  {
                    value: 'longestCoding',
                    label: 'Longest coding transcript',
                  },
                ] as const
              ).map(({ value, label }) => ({
                label,
                type: 'radio' as const,
                checked: self.geneGlyphMode === value,
                onClick: () => {
                  self.setGeneGlyphMode(value)
                },
              })),
            },
            {
              label: 'Display mode',
              subMenu: (
                [
                  { value: 'normal', label: 'Normal' },
                  { value: 'compact', label: 'Compact' },
                  { value: 'superCompact', label: 'Super-compact' },
                ] as const
              ).map(({ value, label }) => ({
                label,
                type: 'radio' as const,
                checked: self.displayMode === value,
                onClick: () => {
                  self.setDisplayMode(value)
                },
              })),
            },
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
            regionNumber,
          } = info
          const region = self.loadedRegions.get(regionNumber)
          return [
            ...base,
            {
              label: 'Collapse introns',
              icon: CloseFullscreenIcon,
              onClick: () => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  if (!region) {
                    return
                  }
                  const session = getSession(self)
                  const fullFeature = await fetchCanvasFeatureDetails(
                    session,
                    getRpcSessionId(self),
                    self.adapterConfigSnapshot,
                    featureId,
                    region,
                  )
                  if (!fullFeature) {
                    return
                  }
                  const transcripts = getTranscripts(fullFeature)
                  if (!hasIntrons(transcripts)) {
                    session.notify('No introns found in this feature', 'info')
                    return
                  }
                  const view = getContainingView(self) as LGV
                  const assembly = session.assemblyManager.get(
                    view.assemblyNames[0]!,
                  )
                  if (assembly) {
                    session.queueDialog(handleClose => [
                      CollapseIntronsDialog,
                      { view, transcripts, handleClose, assembly },
                    ])
                  }
                })()
              },
            },
          ]
        },
      }
    })
    .postProcessSnapshot(snap => {
      const { showOnlyGenes, ...rest } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(showOnlyGenes && { showOnlyGenes }),
      } as typeof snap
    })
}

export type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
