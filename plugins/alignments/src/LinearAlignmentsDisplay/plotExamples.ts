import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on an alignments track. */
export const ALIGNMENTS_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'reads colored by strand',
  },
  {
    plot: '{ "color": { "field": "mapq" } }',
    description: 'reads shaded by mapping quality',
  },
  {
    plot: '{ "facet": "pairOrientation" }',
    description: 'one section per pair orientation',
  },
  {
    plot: '{ "sort": "split", "color": { "field": "pairOrientation" } }',
    description: 'split reads stacked first, colored by pair orientation',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'one pileup, default colors',
  },
]
