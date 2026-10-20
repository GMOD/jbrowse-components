import type { PlotExample } from '@jbrowse/core/configuration'

/** Worked examples of a chord display's plot. */
export const CHORD_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "svType" } }',
    description: 'chords colored by structural-variant class',
  },
  {
    plot: '{ "color": "#1f77b4" }',
    description: 'one color for every chord',
  },
  {
    plot: '{ "mark": { "depth": 0.5 } }',
    description:
      'chords that curve halfway to the center, keeping the middle clear',
  },
]
