import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { fitToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { colorSchemeMenuItem } from '@jbrowse/display-kit/colorByMenu'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core/chrome'
import BalanceIcon from '@mui/icons-material/Balance'
import GridOnIcon from '@mui/icons-material/GridOn'
import InsightsIcon from '@mui/icons-material/Insights'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

import type { HicColorField, HicColorScale } from './hicColorConfigSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { TriangleHeightMode } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface HicMenuSelf extends IStateTreeNode {
  colorField: HicColorField
  paintedColorField: HicColorField
  hasControl: boolean
  setColorField: (field: HicColorField) => void
  colorScaleType: HicColorScale
  colorFollowsPercentile: boolean
  saturationQuantile: number
  showLegend: boolean
  heightMode: TriangleHeightMode
  colorScheme: ColorSchemeName
  hasResolutions: boolean
  canStepResolutionFiner: boolean
  canStepResolutionCoarser: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  appliedNormalization: string
  effectiveResolution: number | undefined
  resolutionSteps: number
  setLogScale: (log: boolean) => void
  setColorFollowsPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setHeightMode: (mode: TriangleHeightMode) => void
  setColorScheme: (scheme: ColorSchemeName) => void
  setSelectedNormalization: (s: string) => void
  stepResolution: (delta: number) => void
  resetResolution: () => void
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
            resetDisabled: self.resolutionSteps === 0,
          }),
          onFiner: () => {
            self.stepResolution(-1)
          },
          onCoarser: () => {
            self.stepResolution(1)
          },
          onReset: () => {
            self.resetResolution()
          },
          resetTitle: 'Back to auto (tracks zoom)',
        }),
      ]
    : []
}

function showMenuItems(self: HicMenuSelf): MenuItem[] {
  return [legendCheckboxItem(self)]
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
        helpText: `Saturate the color scale at the ${percentileName(self.saturationQuantile)} percentile of the loaded counts instead of their maximum, so faint off-diagonal contacts read more strongly. A domainMax set in Edit plot overrides both.`,
      },
    ),
  ]
}

const FIELD_ITEMS: { value: HicColorField; label: string; helpText: string }[] =
  [
    {
      value: 'observed',
      label: 'Observed',
      helpText: 'Each bin colored by its contact count.',
    },
    {
      value: 'observed/expected',
      label: 'Observed/expected',
      helpText:
        "Each count over the file's expected count at that distance, so compartments and loops show above the decay of contact with distance. Red is enriched, blue depleted.",
    },
    {
      value: 'observed/control',
      label: 'Observed/control',
      helpText:
        "Each count over the control condition's, both scaled to their files' depth, so gained contacts show red and lost ones blue.",
    },
  ]

const FALLBACK_HELP: Record<HicColorField, string> = {
  observed: '',
  'observed/expected':
    'This file has no expected values at the current resolution, so the cells show counts.',
  'observed/control':
    'The control has no matrix at the current resolution, so the cells show counts.',
}

// Ticks the field the loaded cells are; a file with no expected values at the
// binsize paints counts, and the row asked for says why.
function fieldMenuItem(self: HicMenuSelf): MenuItem {
  const { colorField, paintedColorField } = self
  return {
    label: 'Values',
    icon: InsightsIcon,
    subMenu: radioItems(
      FIELD_ITEMS.filter(
        item => item.value !== 'observed/control' || self.hasControl,
      ).map(item => ({
        ...item,
        helpText:
          item.value === colorField && paintedColorField !== colorField
            ? FALLBACK_HELP[item.value]
            : item.helpText,
      })),
      paintedColorField,
      field => {
        self.setColorField(field)
      },
    ),
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
    fieldMenuItem(self),
    colorSchemeMenuItem(
      self,
      self.paintedColorField === 'observed' ? colorScaleMenuItems(self) : [],
    ),
    ...normalizationMenuItems(self),
  ]
}
