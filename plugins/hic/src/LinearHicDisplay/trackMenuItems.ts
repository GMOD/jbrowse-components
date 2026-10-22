import { lazy } from 'react'

import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getBpDisplayStr, getDialogHost } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { fitToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { colorSchemeMenuItem } from '@jbrowse/display-kit/colorByMenu'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core/chrome'
import BalanceIcon from '@mui/icons-material/Balance'
import GradientIcon from '@mui/icons-material/Gradient'
import GridOnIcon from '@mui/icons-material/GridOn'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

import type { ColorRangeHost } from './components/ColorRangeDialog.tsx'
import type { HicColorScale } from './hicColorConfigSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { TriangleHeightMode } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const ColorRangeDialog = lazy(() => import('./components/ColorRangeDialog.tsx'))

interface HicMenuSelf extends ColorRangeHost, IStateTreeNode {
  colorScaleType: HicColorScale
  colorFollowsPercentile: boolean
  saturationQuantile: number
  showLegend: boolean
  showResolutionControls: boolean
  heightMode: TriangleHeightMode
  colorScheme: ColorSchemeName
  hasResolutions: boolean
  canStepResolutionFiner: boolean
  canStepResolutionCoarser: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  appliedNormalization: string
  effectiveResolution: number | undefined
  resolutionBias: number
  setLogScale: (log: boolean) => void
  setColorFollowsPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowResolutionControls: (f: boolean) => void
  setHeightMode: (mode: TriangleHeightMode) => void
  setColorScheme: (scheme: ColorSchemeName) => void
  setSelectedNormalization: (s: string) => void
  stepResolution: (delta: number) => void
  resetResolutionBias: () => void
}

const NORM_HELP: Record<string, string> = {
  KR: 'Knight-Ruiz matrix balancing — the recommended normalization for most files.',
  SCALE: 'Fast matrix-balancing normalization that approximates KR.',
  VC: 'Vanilla coverage: divide each cell by its row and column contact sums.',
  VC_SQRT: 'Vanilla coverage using the square root of the row/column sums.',
  NONE: 'Raw observed contact counts, with no normalization applied.',
}

function resolutionMenuItems(self: HicMenuSelf): MenuItem[] {
  return self.hasResolutions
    ? [
        makeResolutionSubMenuItem({
          icon: GridOnIcon,
          getState: () => ({
            label:
              self.effectiveResolution === undefined
                ? ''
                : getBpDisplayStr(self.effectiveResolution),
            finerDisabled: !self.canStepResolutionFiner,
            coarserDisabled: !self.canStepResolutionCoarser,
            resetDisabled: self.resolutionBias === 0,
          }),
          onFiner: () => {
            self.stepResolution(-1)
          },
          onCoarser: () => {
            self.stepResolution(1)
          },
          onReset: () => {
            self.resetResolutionBias()
          },
          resetTitle: 'Back to auto (tracks zoom)',
        }),
      ]
    : []
}

function showMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    ...(self.hasResolutions
      ? [
          toggleItem(
            'Resolution controls',
            self.showResolutionControls,
            self.setShowResolutionControls,
            {
              helpText:
                'Show an on-figure binsize dropdown in the track overlay, e.g. to bake a chosen resolution into a screenshot.',
            },
          ),
        ]
      : []),
    legendCheckboxItem(self),
  ]
}

function layoutMenuItem(self: HicMenuSelf): MenuItem {
  return {
    label: 'Layout',
    icon: ViewQuiltIcon,
    subMenu: [fitToHeightCheckboxItem(self)],
  }
}

// 0.95 as the key reads it, "95th".
function percentileName(quantile: number) {
  const n = Math.round(quantile * 100)
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th'
  return `${n}${suffix}`
}

function colorScaleMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    toggleItem('Log scale', self.colorScaleType !== 'linear', self.setLogScale),
    toggleItem(
      `Emphasize faint contacts (${percentileName(self.saturationQuantile)} percentile)`,
      self.colorFollowsPercentile,
      self.setColorFollowsPercentile,
      {
        helpText: `Saturate the color scale at the ${percentileName(self.saturationQuantile)} percentile of the loaded counts instead of their maximum, so faint off-diagonal contacts read more strongly. A Color range max overrides both.`,
      },
    ),
  ]
}

// The caption carries only the pinned ends, as the Y axis row's does.
function colorRangeMenuItem(self: HicMenuSelf): MenuItem {
  const { colorDomainMin: min, colorDomainMax: max } = self
  const caption =
    min === undefined && max === undefined
      ? ''
      : ` (${min ?? 'auto'} – ${max ?? 'auto'})`
  return {
    label: `Color range${caption}...`,
    icon: GradientIcon,
    helpText:
      'Pin the counts the color ramp spans, or the percentile an open top follows.',
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
        ColorRangeDialog,
        { model: self, handleClose },
      ])
    },
  }
}

// The schemes the file offers, ticked by what the loaded matrix carries: a
// file can hold a scheme at one binsize and not another.
function normalizationMenuItems(self: HicMenuSelf): MenuItem[] {
  const avail = self.availableNormalizations
  const { activeNormalization, appliedNormalization } = self
  return avail?.length
    ? [
        {
          label: 'Normalization',
          icon: BalanceIcon,
          subMenu: radioItems(
            avail.map(norm => ({
              value: norm,
              label: norm,
              helpText:
                norm === activeNormalization &&
                appliedNormalization !== activeNormalization
                  ? `Not available at the current resolution in this file — showing ${appliedNormalization}. Zoom to a finer binsize to use it.`
                  : (NORM_HELP[norm] ??
                    'Matrix normalization scheme provided by this .hic file.'),
            })),
            appliedNormalization,
            norm => {
              self.setSelectedNormalization(norm)
            },
          ),
        },
      ]
    : []
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    ...resolutionMenuItems(self),
    ...makeShowSubMenu(showMenuItems(self)),
    layoutMenuItem(self),
    colorSchemeMenuItem(self, colorScaleMenuItems(self)),
    colorRangeMenuItem(self),
    ...normalizationMenuItems(self),
  ]
}
