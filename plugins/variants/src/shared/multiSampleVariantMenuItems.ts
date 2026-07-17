import { lazy } from 'react'

import { makeSizeMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'
import CategoryIcon from '@mui/icons-material/Category'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import HeightIcon from '@mui/icons-material/Height'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import TuneIcon from '@mui/icons-material/Tune'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { capitalizeFirst } from './constants.ts'
import { CONSEQUENCE_IMPACT_JEXL } from './variantConsequence.ts'

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
      // rowHeight is a single coupled axis: 0 is the fit-to-view sentinel, any
      // positive value is a fixed row height. Expressed as one mutually-exclusive
      // radio group; "Squeeze to fit view" shares the verb the MAF/multi-row
      // displays use for the same idea.
      subMenu: [
        {
          label: 'Squeeze to fit view',
          type: 'radio',
          checked: self.rowHeight === 0,
          onClick: () => {
            self.setFitToHeight()
          },
        },
        {
          label: 'Custom...',
          type: 'radio',
          checked: self.rowHeight !== 0,
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
    // One "Color by..." with the cell coloring and the (optional) sample
    // metadata coloring as subHeader-separated radio groups: they're
    // independent axes (cell fill vs. sidebar/sample palette) but both answer
    // "color by what", so they read better sectioned than as two sibling menus.
    {
      label: 'Color by...',
      icon: PaletteIcon,
      subMenu: [
        {
          label: 'Cells',
          type: 'subHeader',
        },
        {
          label: 'Genotype',
          helpText:
            'Default coloring: allele dosage in allele-count mode, haplotype/allele color in phased mode',
          type: 'radio',
          checked: !self.featureColor,
          onClick: () => {
            self.setFeatureColor('')
          },
        },
        {
          label: `Consequence impact${
            self.hasConsequence
              ? ''
              : !self.featuresVolatile
                ? ' (checking for annotations...)'
                : ' (no SnpEff/VEP annotations found)'
          }`,
          helpText:
            'Color every alt-carrying cell by the variant’s most severe SnpEff (ANN) / VEP (CSQ) consequence impact tier; ref and no-call cells keep their normal coloring',
          type: 'radio',
          checked: self.featureColor === CONSEQUENCE_IMPACT_JEXL,
          disabled: !self.hasConsequence,
          disabledHelpText: !self.featuresVolatile
            ? 'Checking for annotations...'
            : 'No SnpEff/VEP annotations (ANN/CSQ) found in this dataset',
          onClick: () => {
            self.setFeatureColor(CONSEQUENCE_IMPACT_JEXL)
          },
        },
        ...(self.colorByAttributes.length
          ? [
              {
                label: 'Samples',
                type: 'subHeader' as const,
              },
              {
                label: 'None',
                type: 'radio' as const,
                checked: !self.colorBy,
                onClick: () => {
                  self.setColorBy('')
                },
              },
              ...self.colorByAttributes.map(attr => ({
                label: capitalizeFirst(attr),
                type: 'radio' as const,
                checked: self.colorBy === attr,
                onClick: () => {
                  self.setColorBy(attr)
                },
              })),
            ]
          : []),
      ],
    },
    {
      label: 'Filter by...',
      icon: FilterAltIcon,
      subMenu: [
        // Both are bounded fractions tuned by feel, so they're inline sliders
        // rather than a dialog round-trip. They're fetch inputs (rpcProps), so
        // commitOnRelease keeps a drag from firing a worker refetch per step.
        makeSizeMenu({
          label: 'Minor allele frequency',
          title: 'MAF',
          min: 0,
          max: 0.5,
          step: 0.01,
          format: n => (n === 0 ? 'off' : n.toFixed(2)),
          commitOnRelease: true,
          getValue: () => self.minorAlleleFrequencyFilter,
          isDefault: self.minorAlleleFrequencyFilter === 0,
          onChange: n => {
            self.setMafFilter(n)
          },
          onReset: () => {
            self.setMafFilter(0)
          },
        }),
        makeSizeMenu({
          label: 'Missingness',
          title: 'Max missingness',
          min: 0,
          max: 1,
          step: 0.01,
          // 1 keeps every variant, i.e. the filter is off
          format: n => (n === 1 ? 'off' : n.toFixed(2)),
          commitOnRelease: true,
          getValue: () => self.maxMissingnessFilter,
          isDefault: self.maxMissingnessFilter === 1,
          onChange: n => {
            self.setMaxMissingnessFilter(n)
          },
          onReset: () => {
            self.setMaxMissingnessFilter(1)
          },
        }),
        {
          label: 'Edit filters...',
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
      label: 'Cluster by genotype...',
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
    {
      label: 'Edit colors/arrangement...',
      icon: TuneIcon,
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
  return feat
    ? [
        {
          label: 'Open feature details',
          icon: MenuOpenIcon,
          onClick: () => {
            self.selectFeature(feat)
          },
        },
        {
          label: 'Copy to clipboard',
          icon: ContentCopyIcon,
          onClick: async () => {
            try {
              const loc = `${feat.get('refName')}:${feat.get('start') + 1}..${feat.get('end')}`
              // Only the VCF ID column; a feature with no ID ('.') copies as
              // bare location rather than feat.id(), an internal adapter string.
              const name = feat.get('name')
              const { default: copy } =
                await import('@jbrowse/core/util/copyToClipboard')
              copy(name ? `${name} ${loc}` : loc)
              getSession(self).notify('Copied to clipboard', 'info')
            } catch (e) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          },
        },
        {
          label: 'Sort by genotype',
          icon: SwapVertIcon,
          onClick: () => {
            self.sortByGenotype(feat.id())
          },
        },
      ]
    : []
}
