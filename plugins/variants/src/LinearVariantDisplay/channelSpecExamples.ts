// The VCF vocabulary for Edit as JSON...: a field is a record field, a path
// into INFO, or one of the `impact` and `svType` presets.
export const VARIANT_CHANNEL_SPEC_EXAMPLES = [
  {
    spec: '{ "color": { "field": "type" } }',
    description: 'one color per variant class: SNV, deletion, insertion',
  },
  {
    spec: '{ "color": { "field": "svType" } }',
    description: 'one color per structural variant class',
  },
  {
    spec: '{ "color": { "field": "INFO.CLNSIG" } }',
    description: 'one color per ClinVar significance',
  },
  { spec: '{ "facet": "FILTER" }', description: 'a section per FILTER value' },
  {
    spec: '{ "filter": ["feature.QUAL > 30"] }',
    description: 'site quality above 30',
  },
  {
    spec: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]
