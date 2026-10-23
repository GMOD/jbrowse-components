import type { PlotExample } from '@jbrowse/core/configuration'

export const LD_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "dprime" } }',
    description: "cells show D' on blues instead of R² on reds",
  },
  {
    plot: '{ "encoding": { "color": { "field": "r2", "scale": { "scheme": "viridis" } } } }',
    description: 'R² on the viridis scheme',
  },
  {
    plot: '{ "encoding": { "color": { "field": "r2", "scale": { "domainMin": 0.2 } } } }',
    description: 'R² below 0.2 draws as the low end of the ramp',
  },
]
