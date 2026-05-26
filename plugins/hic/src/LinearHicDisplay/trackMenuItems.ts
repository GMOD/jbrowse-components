import type { MenuItem } from '@jbrowse/core/ui'

interface HicMenuSelf {
  useLogScale: boolean
  useColorPercentile: boolean
  showLegend: boolean | undefined
  mode: string
  colorScheme: string | undefined
  resolution: number | undefined
  availableNormalizations: string[] | undefined
  activeNormalization: string
  setUseLogScale: (f: boolean) => void
  setUseColorPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setMode: (m: string) => void
  setColorScheme: (s?: string) => void
  stepResolution: (dir: -1 | 1) => void
  resetResolutionToAuto: () => void
  setActiveNormalization: (s: string) => void
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    {
      label: 'Use log scale',
      type: 'checkbox',
      checked: self.useLogScale,
      onClick: () => {
        self.setUseLogScale(!self.useLogScale)
      },
    },
    {
      label: 'Use 95th percentile color scale',
      type: 'checkbox',
      checked: self.useColorPercentile,
      onClick: () => {
        self.setUseColorPercentile(!self.useColorPercentile)
      },
    },
    {
      label: 'Show legend',
      type: 'checkbox',
      checked: !!self.showLegend,
      onClick: () => {
        self.setShowLegend(!self.showLegend)
      },
    },
    {
      label: 'Rendering mode',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Triangular',
          type: 'radio',
          checked: self.mode === 'triangular',
          onClick: () => {
            self.setMode('triangular')
          },
        },
        {
          label: 'Adjust to height of display',
          type: 'radio',
          checked: self.mode === 'adjust',
          onClick: () => {
            self.setMode('adjust')
          },
        },
      ],
    },
    {
      label: 'Color scheme',
      type: 'subMenu',
      subMenu: [
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
        {
          label: 'Juicebox',
          type: 'radio',
          checked: self.colorScheme === 'juicebox',
          onClick: () => {
            self.setColorScheme('juicebox')
          },
        },
        {
          label: 'Default',
          type: 'radio',
          checked: self.colorScheme === undefined,
          onClick: () => {
            self.setColorScheme(undefined)
          },
        },
      ],
    },
    {
      label: 'Resolution',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Finer resolution',
          onClick: () => {
            self.stepResolution(-1)
          },
        },
        {
          label: 'Coarser resolution',
          onClick: () => {
            self.stepResolution(1)
          },
        },
        {
          label: 'Auto (track zoom)',
          type: 'checkbox',
          checked: self.resolution === undefined,
          onClick: () => {
            self.resetResolutionToAuto()
          },
        },
      ],
    },
    ...(self.availableNormalizations
      ? [
          {
            label: 'Normalization scheme',
            type: 'subMenu' as const,
            subMenu: self.availableNormalizations.map(
              (norm): MenuItem => ({
                label: norm,
                type: 'radio',
                checked: norm === self.activeNormalization,
                onClick: () => {
                  self.setActiveNormalization(norm)
                },
              }),
            ),
          },
        ]
      : []),
  ]
}
