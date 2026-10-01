export const PLOT_EXAMPLES = [
  { plot: '{ "color": "darkgreen" }', description: 'one color for every bar' },
  {
    plot: '{ "color": { "field": "score", "scale": "threshold", "domain": [2], "range": ["#2166ac", "#b2182b"] } }',
    description: 'blue below 2, red at or above it',
  },
  {
    plot: '{ "color": { "field": "score", "scale": "linear", "scheme": "viridis" } }',
    description: 'viridis from the bottom of the axis to the top',
  },
  {
    plot: '{ "color": { "field": "score", "scale": "linear", "range": ["#2166ac", "white", "#b2182b"], "domainMid": 0 } }',
    description: 'blue through white to red, white at 0',
  },
  {
    plot: '{ "color": { "field": "source" } }',
    description: 'one color per subtrack',
  },
  {
    plot: '{ "rows": "source" }',
    description: 'one row per subtrack, with the sidebar',
  },
  {
    plot: '{ "rows": null, "color": null }',
    description: 'one shared plot, default color',
  },
]
