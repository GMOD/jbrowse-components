import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const DEFAULT_SCORE_FIELD = 'score'

export const yFieldConfigSchemaFields = {
  y: {
    type: 'featureField',
    defaultValue: DEFAULT_SCORE_FIELD,
    description:
      "the feature field plotted on the value axis, as a mark's encoding.y names one: a name, a dotted path or a `jexl:` expression. The default `score` is the field every adapter serves, including the value a BED adapter's `scoreColumn` rewrote it to; an explicit name reaches a raw column the adapter left alone (a BED extra column, a GFF attribute). A feature with no finite value in the field plots at 0",
  },
} as const

export type YFieldConfigModel = ConfigModelForFields<
  typeof yFieldConfigSchemaFields
>
