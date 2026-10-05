import type { PlotExample } from '@jbrowse/core/configuration'

// The VCF vocabulary for "Edit plot...": a field is a record field, a path
// into INFO, or one of the `impact` and `svType` presets.
export const VARIANT_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "color": { "field": "type" } }',
    description: 'one color per variant class: SNV, deletion, insertion',
  },
  {
    plot: '{ "color": { "field": "INFO.CLNSIG" } }',
    description: 'one color per ClinVar significance',
  },
  {
    plot: '{ "filter": ["jexl:feature.QUAL > 30"] }',
    description: 'site quality above 30',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]
