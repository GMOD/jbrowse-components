// Beside the colour object rather than in its file: a `#slot` docblock there
// would be filed under `#config ArcColor`, and a table a schema spreads renders
// from `description` alone.
export const arcLegendConfigSchemaFields = {
  showLegend: {
    type: 'boolean',
    defaultValue: true,
    description: 'draw the colour key where color binds a field',
  },
} as const
