import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core'
import GridOnIcon from '@mui/icons-material/GridOn'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import type { HicColorScheme } from './components/colorRamp.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The stepper's centered value, e.g. "25kbp (auto)" or "25kbp (+1)" (the "Resolution"
// prefix is redundant under the submenu of that name); the signed bias suffix
// reflects how far the user has stepped off the zoom-derived binsize.
function formatResolutionLabel(
  effectiveResolution: number | undefined,
  bias: number,
) {
  const value =
    effectiveResolution !== undefined
      ? getBpDisplayStr(effectiveResolution)
      : '…'
  const suffix =
    bias === 0 ? ' (auto)' : ` (${bias > 0 ? '+' : '−'}${Math.abs(bias)})`
  return `${value}${suffix}`
}

interface HicMenuSelf {
  useLogScale: boolean
  useColorPercentile: boolean
  showLegend: boolean
  fitToHeight: boolean
  colorScheme: HicColorScheme
  availableResolutions: number[] | undefined
  availableNormalizations: string[] | undefined
  activeNormalization: string
  resolutionBias: number
  effectiveResolution: number | undefined
  nextResolution: (dir: -1 | 1) => number | undefined
  stepResolution: (dir: -1 | 1) => void
  resetResolutionBias: () => void
  setUseLogScale: (f: boolean) => void
  setUseColorPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setFitToHeight: (f: boolean) => void
  setColorScheme: (s?: HicColorScheme) => void
  setActiveNormalization: (s: string) => void
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    {
      label: 'Show...',
      icon: VisibilityIcon,
      type: 'subMenu',
      subMenu: [
        {
          label: 'Show legend',
          type: 'checkbox',
          checked: self.showLegend,
          onClick: () => {
            self.setShowLegend(!self.showLegend)
          },
        },
        {
          label: 'Fit to display height',
          type: 'checkbox',
          checked: self.fitToHeight,
          onClick: () => {
            self.setFitToHeight(!self.fitToHeight)
          },
        },
        {
          label: 'Log scale',
          type: 'checkbox',
          checked: self.useLogScale,
          onClick: () => {
            self.setUseLogScale(!self.useLogScale)
          },
        },
        {
          label: 'Show faint contacts (95th percentile)',
          type: 'checkbox',
          checked: self.useColorPercentile,
          onClick: () => {
            self.setUseColorPercentile(!self.useColorPercentile)
          },
        },
      ],
    },
    ...(self.availableResolutions
      ? [
          makeResolutionSubMenuItem({
            icon: GridOnIcon,
            resetTitle: 'Reset to auto (tracks zoom)',
            getState: () => ({
              label: formatResolutionLabel(
                self.effectiveResolution,
                self.resolutionBias,
              ),
              finerDisabled: self.nextResolution(-1) === undefined,
              coarserDisabled: self.nextResolution(1) === undefined,
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
          }),
        ]
      : []),
    {
      label: 'Color scheme',
      icon: PaletteIcon,
      type: 'subMenu',
      subMenu: [
        {
          label: 'Juicebox (default)',
          type: 'radio',
          checked: self.colorScheme === 'juicebox',
          onClick: () => {
            self.setColorScheme(undefined)
          },
        },
        {
          label: 'Fall',
          type: 'radio',
          checked: self.colorScheme === 'fall',
          onClick: () => {
            self.setColorScheme('fall')
          },
        },
        {
          label: 'Viridis',
          type: 'radio',
          checked: self.colorScheme === 'viridis',
          onClick: () => {
            self.setColorScheme('viridis')
          },
        },
      ],
    },
    ...(self.availableNormalizations
      ? [
          {
            label: 'Normalization',
            type: 'subMenu' as const,
            subMenu: self.availableNormalizations.map((norm): MenuItem => ({
              label: norm,
              type: 'radio',
              checked: norm === self.activeNormalization,
              onClick: () => {
                self.setActiveNormalization(norm)
              },
            })),
          },
        ]
      : []),
  ]
}
