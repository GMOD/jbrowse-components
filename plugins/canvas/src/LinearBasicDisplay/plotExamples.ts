import type { PlotExample } from '@jbrowse/core/configuration'

export const PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "facet": "strand" }',
    description: 'one section per strand',
  },
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "filter": ["jexl:feature.type == \'gene\'"] }',
    description: 'genes only',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]
