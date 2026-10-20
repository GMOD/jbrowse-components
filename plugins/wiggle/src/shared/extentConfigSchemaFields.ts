import { types } from '@jbrowse/mobx-state-tree'

export const EXTENTS = ['min-max', 'none'] as const
export type Extent = (typeof EXTENTS)[number]

// One table for the three schemas that declare it, since each wants its own
// default (min-max, none on a multi track, none on gccontent).
export function extentConfigSchemaFields({
  extent,
  extentDescription = "the span drawn around each bin's plotted value: 'min-max' draws the bin's stored min and max with it, as a lighter band, while `y` names a stored summary",
}: {
  extent: Extent
  extentDescription?: string
}) {
  return {
    extent: {
      type: 'stringEnum',
      model: types.enumeration('Extent', [...EXTENTS]),
      defaultValue: extent,
      description: extentDescription,
      plot: true,
    },
  } as const
}
