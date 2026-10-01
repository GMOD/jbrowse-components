import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multi-way synteny track. */
export const MULTI_WAY_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "ribbonColor": { "field": "strand" } }',
    description: 'ribbons colored by strand',
  },
  {
    plot: '{ "color": { "field": "cluster" } }',
    description: 'genes colored by ortholog cluster',
  },
  {
    plot: '{ "color": null, "ribbonColor": null }',
    description: 'the default colors',
  },
]
