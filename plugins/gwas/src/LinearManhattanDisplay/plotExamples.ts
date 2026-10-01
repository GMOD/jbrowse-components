import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a Manhattan plot. */
export const MANHATTAN_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "scales": { "y": { "domainMin": 0, "domainMax": 20 } } }',
    description: 'the axis from 0 to 20',
  },
  {
    plot: '{ "scales": null }',
    description: 'the axis following the data',
  },
]
