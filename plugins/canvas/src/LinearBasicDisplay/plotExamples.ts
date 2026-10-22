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
    plot: '{ "filter": ["geneLike"] }',
    description: 'genes only',
  },
  {
    plot: '{ "filter": ["jexl:feature.score > 100"] }',
    description: 'scores above 100',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]
