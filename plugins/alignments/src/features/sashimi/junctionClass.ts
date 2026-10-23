import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'

/**
 * The split classes in `sashimiClass` code order: code 0 is a splice junction
 * counted from N gaps, code `i + 1` the class at `i`.
 */
export const SPLIT_JUNCTION_CLASSES = [
  'splitForward',
  'splitBack',
  'splitInvLL',
  'splitInvRR',
] as const satisfies readonly ArcSplitCategory[]

/** The split class a `sashimiClass` code names, undefined for an N-gap splice. */
export function splitClassOf(code: number): ArcSplitCategory | undefined {
  return SPLIT_JUNCTION_CLASSES[code - 1]
}

/** What the tooltip, feature widget and junction key call a split junction. */
export const SPLIT_JUNCTION_NAMES: Record<ArcSplitCategory, string> = {
  splitForward: 'Split junction (deletion-type)',
  splitBack: 'Split junction (duplication-type)',
  splitInvLL: 'Split junction (inversion, LL-type)',
  splitInvRR: 'Split junction (inversion, RR-type)',
}

/** A split class's `sashimiClass` code. */
export function splitClassCode(split: ArcSplitCategory) {
  return SPLIT_JUNCTION_CLASSES.indexOf(split) + 1
}

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

const CLASS_OF_SPLIT: Record<ArcSplitCategory, JunctionClass> = {
  splitForward: 'deletion',
  splitBack: 'duplication',
  splitInvLL: 'inversion',
  splitInvRR: 'inversion',
}

/** A junction's `junction.class`, by its split class or none. */
export function junctionClass(split: ArcSplitCategory | undefined) {
  return split ? CLASS_OF_SPLIT[split] : 'splice'
}

/** The `junction.source` a `junction.class` comes from. */
export function junctionSource(c: JunctionClass): JunctionSource {
  return c === 'splice' ? 'gap' : 'split'
}
