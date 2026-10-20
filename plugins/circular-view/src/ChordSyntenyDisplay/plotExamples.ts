import type { PlotExample } from '@jbrowse/core/configuration'

/** Worked examples of the chord synteny display's plot. */
export const CHORD_SYNTENY_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "mark": { "depth": 0.5 } }',
    description:
      'ribbons that curve halfway to the center, keeping the middle clear',
  },
  {
    plot: '{ "mark": { "depth": 0 } }',
    description: 'ribbons bowed out toward the rim',
  },
]
