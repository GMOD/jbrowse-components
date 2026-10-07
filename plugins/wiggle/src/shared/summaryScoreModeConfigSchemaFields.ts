import { types } from '@jbrowse/mobx-state-tree'

export const SUMMARY_SCORE_MODES = ['max', 'min', 'mean', 'whiskers'] as const

// One enumeration for the three schemas that declare the slot, since each wants
// its own default (whiskers, mean on a multi track, mean on gccontent).
export function summaryScoreModeConfigSchemaFields({
  defaultMode,
  description:
    prose = 'which summary of a bin is drawn: max, min, mean, or whiskers, which draws all three',
}: {
  defaultMode: (typeof SUMMARY_SCORE_MODES)[number]
  description?: string
}) {
  return {
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', [...SUMMARY_SCORE_MODES]),
      defaultValue: defaultMode,
      description: prose,
    },
  } as const
}
