import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a synteny track in a linear genome view. */
export const LGV_SYNTENY_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "strand" } }',
    description: 'blocks colored by strand',
  },
  {
    plot: '{ "encoding": { "color": "mateRefName" } }',
    description: 'one color per query chromosome',
  },
  {
    plot: '{ "encoding": null }',
    description: 'the default colors',
  },
]
