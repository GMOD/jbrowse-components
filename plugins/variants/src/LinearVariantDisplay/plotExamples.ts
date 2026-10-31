import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a variant track. */
export const VARIANT_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "impact" } }',
    description: 'records and alt cells colored by consequence impact',
  },
  {
    plot: '{ "encoding": { "color": { "field": "INFO.AF", "scale": { "type": "threshold", "domain": [0.01, 0.05] } } } }',
    description: 'rare, low-frequency and common variants in three colors',
  },
  {
    plot: '{ "encoding": { "color": "INFO.CLNSIG" } }',
    description: 'one color per ClinVar significance',
  },
  {
    plot: '{ "filter": [{ "field": "QUAL", "gt": 30 }] }',
    description: 'variants with QUAL above 30',
  },
  {
    plot: '{ "encoding": { "color": null } }',
    description: 'the SV type and genotype colors',
  },
]
