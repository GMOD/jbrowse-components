import {
  makeRadioSubMenu,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { capitalizeFirst, getBpDisplayStr } from '@jbrowse/core/util'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { squashToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core/chrome'
import GridOnIcon from '@mui/icons-material/GridOn'
import PaletteIcon from '@mui/icons-material/Palette'
import TuneIcon from '@mui/icons-material/Tune'

import type { HicColorScale } from './hicColorConfigSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

const COLOR_SCHEME_OPTIONS = COLOR_SCHEMES.map(
  scheme => [scheme, capitalizeFirst(scheme)] as const,
)

interface HicMenuSelf {
  colorScaleType: HicColorScale
  colorFollowsPercentile: boolean
  colorQuantile: number
  showLegend: boolean
  showResolutionControls: boolean
  squashToHeight: boolean
  colorScheme: ColorSchemeName
  hasResolutions: boolean
  canStepResolutionFiner: boolean
  canStepResolutionCoarser: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  appliedNormalization: string
  effectiveResolution: number | undefined
  resolutionBias: number
  setColorScale: (scale: HicColorScale) => void
  setColorFollowsPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowResolutionControls: (f: boolean) => void
  setSquashToHeight: (f: boolean) => void
  setColorScheme: (scheme: ColorSchemeName) => void
  setActiveNormalization: (s: string) => void
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
    legendCheckboxItem(self),
    ...(self.hasResolutions
      ? [
          toggleItem(
            'Show resolution controls',
            self.showResolutionControls,
            self.setShowResolutionControls,
            {
              helpText:
                'Show an on-figure binsize dropdown in the track overlay, e.g. to bake a chosen resolution into a screenshot.',
            },
          ),
        ]
      : []),
    squashToHeightCheckboxItem(self),
  ]
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
    toggleItem('Log scale', self.colorScaleType === 'log', log => {
      self.setColorScale(log ? 'log' : 'linear')
    }),
    toggleItem(
      `Emphasize faint contacts (${percentileName(self.colorQuantile)} percentile)`,
      self.colorFollowsPercentile,
      self.setColorFollowsPercentile,
      {
        helpText: `Saturate the color scale at the ${percentileName(self.colorQuantile)} percentile of the loaded counts instead of their maximum, so faint off-diagonal contacts read more strongly. A color.domainMax in the config overrides both.`,
      },
    ),
  ]
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
          icon: TuneIcon,
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
              self.setActiveNormalization(norm)
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
    makeRadioSubMenu({
      label: 'Color scheme',
      icon: PaletteIcon,
      value: self.colorScheme,
      onChange: scheme => {
        self.setColorScheme(scheme)
      },
      options: COLOR_SCHEME_OPTIONS,
      extraItems: colorScaleMenuItems(self),
    }),
    ...normalizationMenuItems(self),
  ]
}
