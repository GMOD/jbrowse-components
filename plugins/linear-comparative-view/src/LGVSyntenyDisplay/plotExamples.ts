import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a synteny track in a linear genome view. */
export const LGV_SYNTENY_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'blocks colored by strand',
  },
  {
    plot: '{ "color": { "field": "mateRefName" } }',
    description: 'one color per query chromosome',
  },
  {
    plot: '{ "color": null }',
    description: 'the default colors',
  },
]
