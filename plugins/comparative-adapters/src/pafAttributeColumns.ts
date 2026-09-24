/**
 * The PAF adapters' `attributeColumns`: which optional tags (column 13 on,
 * `name:type:value`) the synteny views offer as color-by fields. Every tag
 * already reaches the feature, and so the tooltip; a declared one is also
 * collected per feature, which is what a color mode reads. A tag named
 * `color` holding CSS colors is what a text tag's labels paint in.
 */
export const pafAttributeColumns = {
  attributeColumns: {
    type: 'stringArray',
    defaultValue: [],
    description:
      'PAF tags to offer as color-by fields, by name: ["syri", "color"] offers `syri:Z:INV` as a field whose labels paint in the `color:Z:` beside them',
  },
} as const
