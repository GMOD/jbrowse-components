import GridOnIcon from '@mui/icons-material/GridOn'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import HicResolutionMenuRow from './components/HicResolutionMenuRow.tsx'

import type { HicColorScheme } from './components/colorRamp.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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
          {
            label: 'Resolution',
            icon: GridOnIcon,
            type: 'custom' as const,
            render: () => <HicResolutionMenuRow model={self} />,
          },
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
