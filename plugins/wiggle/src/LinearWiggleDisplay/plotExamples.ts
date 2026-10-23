export const PLOT_EXAMPLES = [
  {
    plot: '{ "encoding": { "color": { "scale": { "type": "threshold", "domain": [2], "range": ["#2166ac", "#b2182b"] } } } }',
    description: 'blue below 2, red at or above it',
  },
  {
    plot: '{ "encoding": { "color": { "scale": { "type": "linear", "scheme": "viridis" } } } }',
    description: 'viridis from the bottom of the axis to the top',
  },
  {
    plot: '{ "mark": { "type": "line", "interpolate": "linear" }, "size": 2 }',
    description: 'a 2px line from one bin centre to the next',
  },
  {
    plot: '{ "rows": "source" }',
    description: 'one row per subtrack, with the sidebar',
  },
  {
    plot: '{ "rows": null, "encoding": { "color": null } }',
    description: 'one shared plot, default color',
  },
]
