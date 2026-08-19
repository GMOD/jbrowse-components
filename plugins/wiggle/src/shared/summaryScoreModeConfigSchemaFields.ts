import { types } from '@jbrowse/mobx-state-tree'

export const SUMMARY_SCORE_MODES = ['max', 'min', 'avg', 'whiskers'] as const

// Three schemas declare this slot and each wants a different default —
// single-wiggle whiskers, multi-wiggle avg, gccontent avg because its adapter
// emits no per-bin min/max. Only the default and the prose vary, so the
// enumeration is supplied once here rather than copied into each; a fifth mode
// added to one copy and not the others read as the slot silently rejecting it.
export function summaryScoreModeConfigSchemaFields({
  defaultMode,
  description:
    prose = 'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
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
