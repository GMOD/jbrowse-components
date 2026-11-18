/** The values the filter's `junction.class` field tests. */
export const JUNCTION_CLASSES = [
  'splice',
  'deletion',
  'duplication',
  'inversion',
] as const

export type JunctionClass = (typeof JUNCTION_CLASSES)[number]

/** The values the filter's `junction.source` field tests. */
export const JUNCTION_SOURCES = ['gap', 'split'] as const

export type JunctionSource = (typeof JUNCTION_SOURCES)[number]
