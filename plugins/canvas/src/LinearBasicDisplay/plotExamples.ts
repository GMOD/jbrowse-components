import type { PlotExample } from '@jbrowse/core/configuration'

export const PLOT_EXAMPLES: PlotExample[] = [
  { plot: '{ "facet": "strand" }', description: 'one section per strand' },
  {
    plot: '{ "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] } }',
    description: 'a section per biotype, these two first',
  },
  {
    plot: '{ "color": { "field": "source" } }',
    description: 'one color per source',
  },
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } }',
    description:
      'those two biotypes blue and orange, and every other its own color',
  },
  { plot: '{ "color": "#1f77b4" }', description: 'one color for everything' },
  {
    plot: '{ "filter": ["jexl:feature.type == \'gene\'"] }',
    description: 'genes only',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]
