import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multi-way synteny track. */
export const MULTI_WAY_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "ribbons": { "encoding": { "color": "identity" } } }',
    description: 'ribbons colored by percent identity',
  },
  {
    plot: '{ "encoding": { "color": "cluster" } }',
    description: 'genes colored by ortholog cluster',
  },
  {
    plot: '{ "encoding": { "color": null }, "ribbons": { "encoding": { "color": null } } }',
    description: 'the default colors',
  },
]
