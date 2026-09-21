export const CHANNEL_SPEC_EXAMPLES = [
  { spec: '{ "color": "darkgreen" }', description: 'one color for every bar' },
  {
    spec: '{ "color": { "field": "score", "scale": "threshold", "domain": [2], "range": ["#2166ac", "#b2182b"] } }',
    description: 'blue below 2, red at or above it',
  },
  {
    spec: '{ "color": { "field": "score", "scale": "linear", "scheme": "viridis" } }',
    description: 'viridis from the bottom of the axis to the top',
  },
  {
    spec: '{ "color": { "field": "score", "scale": "linear", "range": ["#2166ac", "white", "#b2182b"], "domainMid": 0 } }',
    description: 'blue through white to red, white at 0',
  },
  {
    spec: '{ "color": { "field": "source" } }',
    description: 'one color per subtrack',
  },
  {
    spec: '{ "facet": "source" }',
    description: 'one row per subtrack, with the sidebar',
  },
  {
    spec: '{ "facet": null, "color": null }',
    description: 'one shared plot, default color',
  },
]
