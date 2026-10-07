import { types } from '@jbrowse/mobx-state-tree'

export const SUMMARY_SCORE_MODES = ['max', 'min', 'mean', 'whiskers'] as const

// Three schemas declare this slot and each wants a different default: the
// wiggle display whiskers, a MultiQuantitativeTrack mean through its display
// defaults, gccontent mean because its adapter emits no per-bin min/max. Only
// the default and the prose vary, so the enumeration is supplied once here; a
// fifth mode added to one copy and not the others read as the slot rejecting it.
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
