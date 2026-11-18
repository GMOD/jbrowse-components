import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import type { JunctionClass, JunctionSource } from './junctionVocabulary.ts'

export { JUNCTION_CLASSES, JUNCTION_SOURCES } from './junctionVocabulary.ts'
export type { JunctionClass, JunctionSource } from './junctionVocabulary.ts'

/** The split classes a junction arc draws: those spanning reference. */
export type JunctionSplitClass = Exclude<ArcSplitCategory, 'splitInsertion'>

/**
 * The split classes in `junctionSplitClass` code order: code 0 is a splice junction
 * counted from N gaps, code `i + 1` the class at `i`.
 */
export const SPLIT_JUNCTION_CLASSES = [
  'splitForward',
  'splitBack',
  'splitInvLL',
  'splitInvRR',
] as const satisfies readonly JunctionSplitClass[]

/** The split class a `junctionSplitClass` code names, undefined for an N-gap splice. */
export function splitClassOf(code: number): JunctionSplitClass | undefined {
  return SPLIT_JUNCTION_CLASSES[code - 1]
}

/** What the tooltip, feature widget and junction key call a split junction. */
export const SPLIT_JUNCTION_NAMES: Record<JunctionSplitClass, string> = {
  splitForward: 'Split junction (deletion-type)',
  splitBack: 'Split junction (duplication-type)',
  splitInvLL: 'Split junction (inversion, LL-type)',
  splitInvRR: 'Split junction (inversion, RR-type)',
}

/** A split class's `junctionSplitClass` code. */
export function splitClassCode(split: JunctionSplitClass) {
  return SPLIT_JUNCTION_CLASSES.indexOf(split) + 1
}

const CLASS_OF_SPLIT: Record<JunctionSplitClass, JunctionClass> = {
  splitForward: 'deletion',
  splitBack: 'duplication',
  splitInvLL: 'inversion',
  splitInvRR: 'inversion',
}

/** A junction's `junction.class`, by its split class or none. */
export function junctionClass(split: JunctionSplitClass | undefined) {
  return split ? CLASS_OF_SPLIT[split] : 'splice'
}

/** The `junction.source` a `junction.class` comes from. */
export function junctionSource(c: JunctionClass): JunctionSource {
  return c === 'splice' ? 'gap' : 'split'
}
