export const wiggleConfigSchemaFields = {
  origin: {
    type: 'number',
    defaultValue: 0,
    description:
      "The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin",
    plot: true,
  },
} as const
