interface WithResolution {
  hasResolution: boolean
  resolution: number
  summaryScoreMode: string
  setResolution: (n: number) => void
  setSummaryScoreMode: (v: string) => void
}

interface WithScaleAutoscale {
  scaleType: string
  autoscaleType: string
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
}

export function makeResolutionAndSummarySubMenus(self: WithResolution) {
  if (!self.hasResolution) {
    return []
  }
  return [
    {
      label: 'Resolution',
      subMenu: [
        {
          label: 'Finer resolution',
          onClick: () => {
            self.setResolution(self.resolution * 5)
          },
        },
        {
          label: 'Coarser resolution',
          onClick: () => {
            self.setResolution(self.resolution / 5)
          },
        },
      ],
    },
    {
      label: 'Summary score mode',
      subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(elt => ({
        label: elt,
        type: 'radio' as const,
        checked: self.summaryScoreMode === elt,
        onClick: () => {
          self.setSummaryScoreMode(elt)
        },
      })),
    },
  ]
}

export function makeScaleTypeSubMenu(self: WithScaleAutoscale) {
  return {
    label: 'Scale type',
    subMenu: [
      {
        label: 'Linear scale',
        type: 'radio',
        checked: self.scaleType === 'linear',
        onClick: () => {
          self.setScaleType('linear')
        },
      },
      {
        label: 'Log scale',
        type: 'radio',
        checked: self.scaleType === 'log',
        onClick: () => {
          self.setScaleType('log')
        },
      },
    ],
  }
}

export function makeAutoscaleTypeSubMenu(self: WithScaleAutoscale) {
  return {
    label: 'Autoscale type',
    subMenu: (
      [
        ['local', 'Local'],
        ['global', 'Global'],
        ['globalsd', 'Global ± 3σ'],
        ['localsd', 'Local ± 3σ'],
      ] as const
    ).map(([val, label]) => ({
      label,
      type: 'radio' as const,
      checked: self.autoscaleType === val,
      onClick: () => {
        self.setAutoscale(val)
      },
    })),
  }
}
