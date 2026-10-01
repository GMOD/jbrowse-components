export const PLOT_EXAMPLES = [
  {
    plot: '{ "color": { "field": "score", "scale": "threshold", "domain": [2], "range": ["#2166ac", "#b2182b"] } }',
    description: 'blue below 2, red at or above it',
  },
  {
    plot: '{ "color": { "field": "score", "scale": "linear", "scheme": "viridis" } }',
    description: 'viridis from the bottom of the axis to the top',
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
