import { DEFAULT_SCORE_FIELD } from './summaryFields.ts'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const yFieldConfigSchemaFields = {
  y: {
    type: 'featureField',
    defaultValue: DEFAULT_SCORE_FIELD,
    description:
      "the feature field plotted on the value axis, as a mark's encoding.y names one. `score`, `minScore` and `maxScore` are a zoom bin's stored mean, minimum and maximum, which every quantitative source serves, a raw record answering its score for all three. Any other name, a dotted path or a `jexl:` expression reads a raw column the adapter left alone (a BED extra column, a GFF attribute) and draws no min-max extent. A feature with no finite value in the field plots at 0",
    plot: true,
  },
} as const

export type YFieldConfigModel = ConfigModelForFields<
  typeof yFieldConfigSchemaFields
>
