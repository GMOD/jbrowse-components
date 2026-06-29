import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'
import CategoryIcon from '@mui/icons-material/Category'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'
import SortIcon from '@mui/icons-material/Sort'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { createMAFFilterMenuItem } from './mafFilterUtils.ts'

import type { MultiSampleVariantBaseModel } from './MultiSampleVariantBaseModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// lazies
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

const ClusterDialog = lazy(
  () =>
    import('./components/MultiSampleVariantClusterDialog/ClusterDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

// "population" -> "Population" for the metadata-attribute menu labels.
function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Items for the "Show..." submenu — toggles for sidebar labels, the clustering
// tree, subtree filter, and the legend. Extended by subclasses via super-capture
// (e.g. the matrix display adds "Show reference alleles").
export function variantShowSubmenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  return [
    {
      label: 'Show sidebar labels',
      type: 'checkbox',
      checked: self.showSidebarLabels,
      onClick: () => {
        self.setShowSidebarLabels(!self.showSidebarLabels)
      },
    },
    {
      label: `Show tree${!self.clusterTree ? ' (run clustering first)' : ''}`,
      type: 'checkbox',
      checked: self.showTree,
      disabled: !self.clusterTree,
      disabledHelpText: 'Run clustering first',
      onClick: () => {
        self.setShowTree(!self.showTree)
      },
    },
    treeBranchLengthMenuItem(self),
    ...(self.subtreeFilter?.length
      ? [
          {
            label: 'Clear subtree filter',
            onClick: () => {
              self.setSubtreeFilter(undefined)
            },
          },
        ]
      : []),
    {
      label: 'Show legend',
      type: 'checkbox',
      checked: self.showLegend,
      onClick: () => {
        self.setShowLegend(!self.showLegend)
      },
    },
  ]
}

// The display-specific track-menu items (row height, rendering mode, filtering,
// clustering, colors/arrangement). The model's `trackMenuItems` view prepends
// the inherited base items via super-capture.
export function variantTrackMenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  return [
    {
      label: 'Show...',
      icon: VisibilityIcon,
      type: 'subMenu',
      subMenu: self.showSubmenuItems(),
    },
    {
      label: 'Row height',
      icon: HeightIcon,
      subMenu: [
        {
          label: 'Manually set row height',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              SetRowHeightDialog,
              {
                model: self,
                handleClose,
              },
            ])
          },
        },
        {
          label: 'Fit to display height',
          type: 'checkbox',
          checked: self.rowHeight === 0,
          onClick: () => {
            self.setFitToHeight()
          },
        },
      ],
    },
    {
      label: 'Rendering mode',
      icon: SplitscreenIcon,
      subMenu: [
        {
          label: 'Allele count (dosage)',
          helpText:
            'Draws the color darker the more times this allele exists, so homozygous variants are darker than heterozygous. Works on polyploid also',
          type: 'radio',
          checked: self.renderingMode === 'alleleCount',
          onClick: () => {
            self.setPhasedMode('alleleCount')
          },
        },
        {
          label: `Phased${
            self.hasPhased
              ? ''
              : !self.featuresVolatile
                ? ' (checking for phased variants...)'
                : ' (disabled, no phased variants found)'
          }`,
          helpText:
            'Phased mode splits each sample into multiple rows representing each haplotype, and the phasing of the variants is used to color the variant in the individual haplotype rows. For example, a diploid sample SAMPLE1 will generate two rows SAMPLE1-HP0 and SAMPLE1 HP1 and a variant 1|0 will draw a box in the top row but not the bottom row',
          disabled: !self.hasPhased,
          disabledHelpText: !self.featuresVolatile
            ? 'Checking for phased variants...'
            : 'No phased variants found in this dataset',
          checked: self.renderingMode === 'phased',
          type: 'radio',
          onClick: () => {
            self.setPhasedMode('phased')
          },
        },
      ],
    },

    {
      label: 'Filter by',
      icon: ClearAllIcon,
      subMenu: [
        createMAFFilterMenuItem(self),
        {
          label: 'Edit filters',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              AddFiltersDialog,
              {
                model: self,
                handleClose,
              },
            ])
          },
        },
      ],
    },
    {
      label: 'Cluster by genotype',
      icon: CategoryIcon,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          ClusterDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
    },
    ...(self.colorByAttributes.length
      ? [
          {
            label: 'Color samples by',
            icon: PaletteIcon,
            subMenu: [
              {
                label: 'None',
                type: 'radio' as const,
                checked: !self.colorBy,
                onClick: () => {
                  self.setColorBy('')
                },
              },
              ...self.colorByAttributes.map(attr => ({
                label: titleCase(attr),
                type: 'radio' as const,
                checked: self.colorBy === attr,
                onClick: () => {
                  self.setColorBy(attr)
                },
              })),
            ],
          },
        ]
      : []),
    {
      label: 'Edit colors/arrangement...',
      disabled: !self.sourcesVolatile?.length,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetColorDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
    },
  ]
}

// Right-click context-menu items for the hovered/clicked variant feature.
export function variantContextMenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  const feat = self.contextMenuFeature
  if (!feat) {
    return []
  }
  return [
    {
      label: 'Open feature details',
      onClick: () => {
        self.selectFeature(feat)
      },
    },
    {
      label: 'Copy to clipboard',
      onClick: async () => {
        try {
          const loc = `${feat.get('refName')}:${feat.get('start') + 1}..${feat.get('end')}`
          const id = feat.get('name') || feat.id()
          const { default: copy } =
            await import('@jbrowse/core/util/copyToClipboard')
          copy(`${id} ${loc}`)
          getSession(self).notify('Copied to clipboard', 'info')
        } catch (e) {
          console.error(e)
          getSession(self).notifyError(`${e}`, e)
        }
      },
    },
    {
      label: 'Sort by genotype',
      icon: SortIcon,
      onClick: () => {
        self.sortByGenotype(feat.id())
      },
    },
  ]
}
