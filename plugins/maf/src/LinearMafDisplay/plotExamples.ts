import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multiple alignment track. */
export const MAF_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "identity" } }',
    description: 'bases shaded by identity to the reference',
  },
  {
    plot: '{ "encoding": { "color": { "field": "identity", "scale": { "domainMin": 0.7 } } } }',
    description: 'the identity ramp spread over close relatives',
  },
  {
    plot: '{ "encoding": { "y": "identity" } }',
    description: 'each row a bar chart of its identity to the reference',
  },
  {
    plot: '{ "alignments": { "bases": { "show": true } } }',
    description: 'every base in its color, not just the mismatches',
  },
  {
    plot: '{ "encoding": { "color": "refNameRank" } }',
    description:
      'blocks colored by their source sequence, so rearrangements stand out',
  },
  {
    plot: '{ "encoding": { "color": null } }',
    description: 'the default fill, with the mismatches over it',
  },
]
