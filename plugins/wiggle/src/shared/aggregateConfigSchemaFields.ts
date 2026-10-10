import { types } from '@jbrowse/mobx-state-tree'

export const AGGREGATES = ['mean', 'min', 'max'] as const
export type Aggregate = (typeof AGGREGATES)[number]

export const EXTENTS = ['min-max', 'none'] as const
export type Extent = (typeof EXTENTS)[number]

// One table for the three schemas that declare the pair, since each wants its
// own extent (min-max, none on a multi track, none on gccontent).
export function aggregateConfigSchemaFields({
  extent,
  extentDescription = "the span drawn around each bin's aggregate: 'min-max' draws the bin's stored min and max with it, as a lighter band",
}: {
  extent: Extent
  extentDescription?: string
}) {
  return {
    aggregate: {
      type: 'stringEnum',
      model: types.enumeration('Aggregate', [...AGGREGATES]),
      defaultValue: 'mean',
      description:
        "which of a zoom bin's stored summaries is drawn: mean, min or max. A BigWig's zoom levels, and the bins JBrowse makes over its raw section, store all three; where the source serves raw values they are one number and the setting changes nothing",
    },
    extent: {
      type: 'stringEnum',
      model: types.enumeration('Extent', [...EXTENTS]),
      defaultValue: extent,
      description: extentDescription,
    },
  } as const
}
