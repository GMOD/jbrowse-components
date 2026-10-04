import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multi-row feature track. */
export const MULTI_ROW_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "facet": "group" }',
    description: 'one band per row group',
  },
  {
    plot: '{ "color": "#1f77b4" }',
    description: 'one color for everything',
  },
]
