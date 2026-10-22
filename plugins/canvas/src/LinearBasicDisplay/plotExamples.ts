import type { PlotExample } from '@jbrowse/core/configuration'

export const PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "facet": "strand" }',
    description: 'one section per strand',
  },
  {
    plot: '{ "encoding": { "color": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "filter": { "genes": "only" } }',
    description: 'genes only',
  },
  {
    plot: '{ "filter": ["jexl:feature.score > 100"] }',
    description: 'scores above 100',
  },
  {
    plot: '{ "facet": null, "encoding": null }',
    description: 'ungrouped, default color',
  },
]
