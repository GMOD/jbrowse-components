// The VCF vocabulary for Edit as JSON...: a field is a record field or an INFO
// key, as the Group by and Color by attribute dialogs read them.
export const VARIANT_CHANNEL_SPEC_EXAMPLES = [
  {
    spec: '{ "color": { "field": "type" } }',
    description: 'one color per variant class: SNV, deletion, insertion',
  },
  {
    spec: '{ "color": { "field": "SVTYPE" } }',
    description: 'one color per structural variant type, read from INFO',
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
