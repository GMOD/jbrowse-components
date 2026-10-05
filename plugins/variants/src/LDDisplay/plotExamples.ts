import type { PlotExample } from '@jbrowse/core/configuration'

export const LD_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "dprime" } }',
    description: "cells show D' on blues instead of R² on reds",
  },
  {
    plot: '{ "color": { "field": "r2", "scheme": "viridis" } }',
    description: 'R² on the viridis scheme',
  },
  {
    plot: '{ "color": { "field": "r2", "domainMin": 0.2 } }',
    description: 'R² below 0.2 draws as the low end of the ramp',
  },
]
