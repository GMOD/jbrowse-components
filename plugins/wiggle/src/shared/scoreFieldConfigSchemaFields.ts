import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const DEFAULT_SCORE_FIELD = 'score'

// One declaration for the three displays that plot a feature field on a score
// axis — the two wiggle displays and the Manhattan plot — so the slot has one
// name, one default and one description wherever it appears.
export const scoreFieldConfigSchemaFields = {
  scoreField: {
    type: 'string',
    defaultValue: DEFAULT_SCORE_FIELD,
    description:
      "Feature field plotted on the score axis, read natively off each feature. The default `score` is the field every adapter serves — including the value a BED adapter's `scoreColumn` rewrote it to — so an explicit name here reaches a raw column the adapter left alone (a BED extra column, a GFF attribute) and takes precedence over that adapter-tier rewrite. The Manhattan plot skips a feature with no finite value in the field; the wiggle renderings plot it at 0",
  },
} as const

export type ScoreFieldConfigModel = ConfigModelForFields<
  typeof scoreFieldConfigSchemaFields
>
