interface WithScaleAutoscale {
  scaleType: string
  autoscaleType: string
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
}

// Default autoscale modes shared by wiggle / multi-wiggle. The alignments
// coverage band exposes only a subset and a dynamic σ value, so it passes
// its own option list.
export const DEFAULT_AUTOSCALE_OPTIONS: [string, string][] = [
  ['local', 'Local'],
  ['global', 'Global'],
  ['globalsd', 'Global ± 3σ'],
  ['localsd', 'Local ± 3σ'],
]

export function makeScaleTypeSubMenu(self: WithScaleAutoscale) {
  return {
    label: 'Scale type',
    subMenu: [
      {
        label: 'Linear scale',
        type: 'radio' as const,
        checked: self.scaleType === 'linear',
        onClick: () => {
          self.setScaleType('linear')
        },
      },
      {
        label: 'Log scale',
        type: 'radio' as const,
        checked: self.scaleType === 'log',
        onClick: () => {
          self.setScaleType('log')
        },
      },
    ],
  }
}

export function makeAutoscaleTypeSubMenu(
  self: WithScaleAutoscale,
  options: [string, string][] = DEFAULT_AUTOSCALE_OPTIONS,
) {
  return {
    label: 'Autoscale type',
    subMenu: options.map(([val, label]) => ({
      label,
      type: 'radio' as const,
      checked: self.autoscaleType === val,
      onClick: () => {
        self.setAutoscale(val)
      },
    })),
  }
}
