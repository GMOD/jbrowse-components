import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multi-sample variant track. */
export const MULTI_SAMPLE_VARIANT_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "impact" } }',
    description: 'alt cells colored by consequence impact',
  },
  {
    plot: '{ "encoding": { "color": { "field": "INFO.AF", "scale": { "type": "threshold", "domain": [0.01, 0.05] } } } }',
    description: 'rare, low-frequency and common variants in three colors',
  },
  {
    plot: '{ "filter": ["jexl:feature.QUAL > 30"] }',
    description: 'variants with QUAL above 30',
  },
  {
    plot: '{ "encoding": { "color": null } }',
    description: 'the genotype colors',
  },
]
