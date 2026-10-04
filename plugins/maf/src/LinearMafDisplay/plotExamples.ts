import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multiple alignment track. */
export const MAF_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": "identity" }',
    description: 'bases shaded by identity to the reference',
  },
  {
    plot: '{ "y": "identity" }',
    description: 'each row a bar chart of its identity to the reference',
  },
  {
    plot: '{ "color": null }',
    description: 'the default base colors',
  },
]
