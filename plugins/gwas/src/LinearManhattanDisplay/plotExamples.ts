import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a Manhattan plot. */
export const MANHATTAN_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "y": { "scale": { "domainMin": 0, "domainMax": 20 } } } }',
    description: 'the axis from 0 to 20',
  },
  {
    plot: '{ "encoding": { "y": { "rules": [{ "value": 7.3, "label": "p = 5e-8" }] } } }',
    description: 'a genome-wide significance line',
  },
  {
    plot: '{ "encoding": null }',
    description: 'the axis following the data',
  },
]
