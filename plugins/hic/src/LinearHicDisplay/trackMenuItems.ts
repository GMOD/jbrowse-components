import { checkboxItem, radioItems } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { squashToHeightCheckboxItem } from '@jbrowse/plugin-linear-genome-view'
import {
  makeRadioSubMenu,
  makeResolutionSubMenuItem,
} from '@jbrowse/wiggle-core'
import GridOnIcon from '@mui/icons-material/GridOn'
import PaletteIcon from '@mui/icons-material/Palette'
import TuneIcon from '@mui/icons-material/Tune'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { HIC_COLOR_SCHEME_OPTIONS } from './components/colorRamp.ts'

import type { HicColorScheme } from './components/colorRamp.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface HicMenuSelf {
  useLogScale: boolean
  useColorPercentile: boolean
  showLegend: boolean
  showResolutionControls: boolean
  squashToHeight: boolean
  colorScheme: HicColorScheme
  hasResolutions: boolean
  canStepResolutionFiner: boolean
  canStepResolutionCoarser: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  appliedNormalization: string
  effectiveResolution: number | undefined
  resolutionBias: number
  setUseLogScale: (f: boolean) => void
  setUseColorPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowResolutionControls: (f: boolean) => void
  setSquashToHeight: (f: boolean) => void
  setColorScheme: (s: HicColorScheme) => void
  setActiveNormalization: (s: string) => void
  stepResolution: (delta: number) => void
  resetResolutionBias: () => void
}

// One-line explanation per matrix-balancing scheme, so the Normalization radios
// aren't bare jargon (KR/SCALE/VC/…). Falls back to a generic note for schemes
// a file might expose that we don't have specific copy for.
const NORM_HELP: Record<string, string> = {
  KR: 'Knight-Ruiz matrix balancing — the recommended normalization for most files.',
  SCALE: 'Fast matrix-balancing normalization that approximates KR.',
  VC: 'Vanilla coverage: divide each cell by its row and column contact sums.',
  VC_SQRT: 'Vanilla coverage using the square root of the row/column sums.',
  NONE: 'Raw observed contact counts, with no normalization applied.',
}

// Resolution sits at the top level (not buried behind the on-figure overlay
// toggle) for discoverability — binsize is the primary Hi-C control. The
// "Show resolution controls" checkbox in the Show menu is a separate, opt-in
// on-figure dropdown for baking a chosen binsize into a screenshot/figure.
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
    checkboxItem('Show legend', self.showLegend, () => {
      self.setShowLegend(!self.showLegend)
    }),
    ...(self.hasResolutions
      ? [
          checkboxItem(
            'Show resolution controls',
            self.showResolutionControls,
            () => {
              self.setShowResolutionControls(!self.showResolutionControls)
            },
            {
              helpText:
                'Show an on-figure binsize dropdown in the track overlay, e.g. to bake a chosen resolution into a screenshot.',
            },
          ),
        ]
      : []),
    squashToHeightCheckboxItem(self),
    checkboxItem('Log scale', self.useLogScale, () => {
      self.setUseLogScale(!self.useLogScale)
    }),
    checkboxItem(
      'Show faint contacts (95th percentile)',
      self.useColorPercentile,
      () => {
        self.setUseColorPercentile(!self.useColorPercentile)
      },
      {
        helpText:
          'Saturate the color scale at the 95th percentile of counts instead of the max, so faint off-diagonal contacts read more strongly.',
      },
    ),
  ]
}

// Only the schemes the file actually offers, so the radios can't check a
// normalization hic-straw would silently answer with NONE. `appliedNormalization`
// — not the raw config slot, and not the requested scheme either — drives the
// tick, so the radios always describe the matrix on screen. Two things can make
// them diverge from the user's pick: a file that lacks the scheme entirely
// (handled by `activeNormalization`), and a file that has it but not at the
// current binsize — vectors are stored per (type, chr, unit, binsize). The
// second only becomes visible once data has loaded, so the requested-but-
// unapplied entry says so rather than leaving an unexplained tick elsewhere.
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
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: showMenuItems(self),
    },
    makeRadioSubMenu({
      label: 'Color scheme',
      icon: PaletteIcon,
      value: self.colorScheme,
      onChange: scheme => {
        self.setColorScheme(scheme)
      },
      options: HIC_COLOR_SCHEME_OPTIONS,
    }),
    ...normalizationMenuItems(self),
  ]
}
