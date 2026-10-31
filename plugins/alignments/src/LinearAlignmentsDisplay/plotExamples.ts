import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on an alignments track. */
export const ALIGNMENTS_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "strand" } }',
    description: 'reads colored by strand',
  },
  {
    plot: '{ "encoding": { "color": "mapq" } }',
    description: 'reads shaded by mapping quality',
  },
  {
    plot: '{ "facet": "pairOrientation" }',
    description: 'one section per pair orientation',
  },
  {
    plot: '{ "sort": "split", "encoding": { "color": "insertSizeAndOrientation" } }',
    description:
      'split reads stacked first, colored by insert size and orientation',
  },
  {
    plot: '{ "facet": null, "encoding": null }',
    description: 'one pileup, default colors',
  },
]
