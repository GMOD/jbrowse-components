import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a Hi-C track. */
export const HIC_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "scale": "log", "scheme": "viridis" } }',
    description: 'contacts on a log viridis ramp',
  },
  {
    plot: '{ "color": { "scale": "log", "scheme": "viridis", "domainMax": 500 } }',
    description: 'the same ramp, saturating at 500 contacts',
  },
  {
    plot: '{ "color": "observed/expected" }',
    description: 'each count over its expected count, diverging around 1',
  },
  {
    plot: '{ "color": null }',
    description: 'the default ramp',
  },
]
