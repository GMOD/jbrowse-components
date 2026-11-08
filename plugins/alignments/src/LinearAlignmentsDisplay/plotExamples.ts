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
    plot: '{ "pileup": { "bases": { "show": true, "encoding": { "color": "modifications" } } } }',
    description: 'base modifications such as 5mC from the MM/ML tags',
  },
  {
    plot: '{ "sashimi": { "show": true, "labels": { "show": true } } }',
    description: 'splice junctions as arcs labeled with their read counts',
  },
  {
    plot: '{ "readConnections": { "show": true } }',
    description:
      'arcs joining each pair and split read, for structural variants',
  },
  {
    plot: '{ "facet": null, "encoding": null }',
    description: 'one pileup, default colors',
  },
]
