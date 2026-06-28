import type { HicColorScheme } from './components/colorRamp.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface HicMenuSelf {
  useLogScale: boolean
  useColorPercentile: boolean
  showLegend: boolean | undefined
  fitToHeight: boolean
  colorScheme: HicColorScheme | undefined
  showResolutionControls: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  setUseLogScale: (f: boolean) => void
  setUseColorPercentile: (f: boolean) => void
  setShowResolutionControls: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setFitToHeight: (f: boolean) => void
  setColorScheme: (s?: HicColorScheme) => void
  setActiveNormalization: (s: string) => void
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    {
      label: 'Show...',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Show legend',
          type: 'checkbox',
          checked: !!self.showLegend,
          onClick: () => {
            self.setShowLegend(!self.showLegend)
          },
        },
        {
          label: 'Show resolution controls',
          type: 'checkbox',
          checked: self.showResolutionControls,
          onClick: () => {
            self.setShowResolutionControls(!self.showResolutionControls)
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
    {
      label: 'Color scheme',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Juicebox (default)',
          type: 'radio',
          // undefined resolves to the juicebox default in generateColorRamp, so
          // treat both as "Juicebox" rather than offering a redundant 'Default'
          checked:
            self.colorScheme === undefined || self.colorScheme === 'juicebox',
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
