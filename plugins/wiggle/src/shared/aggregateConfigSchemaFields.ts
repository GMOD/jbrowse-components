import { types } from '@jbrowse/mobx-state-tree'

export const AGGREGATES = ['max', 'min', 'mean', 'whiskers'] as const

// One enumeration for the three schemas that declare the slot, since each wants
// its own default (whiskers, mean on a multi track, mean on gccontent).
export function aggregateConfigSchemaFields({
  defaultMode,
  description:
    prose = 'which summary of a bin is drawn: max, min, mean, or whiskers, which draws all three',
}: {
  defaultMode: (typeof AGGREGATES)[number]
  description?: string
}) {
  return {
    aggregate: {
      type: 'stringEnum',
      model: types.enumeration('Aggregate', [...AGGREGATES]),
      defaultValue: defaultMode,
      description: prose,
    },
  } as const
}
