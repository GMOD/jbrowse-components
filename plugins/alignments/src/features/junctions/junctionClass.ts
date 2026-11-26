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

/**
 * The `junctionSplitClass` code of a deletion the reads carry inside one
 * record, as a CIGAR `D` of `SV_INDEL_MIN_BP` or more. It draws as a
 * deletion-type split junction draws and stays a junction of its own.
 */
export const IN_READ_DELETION_CODE = SPLIT_JUNCTION_CLASSES.length + 1

/** Whether a `junctionSplitClass` code names a deletion counted from CIGAR gaps. */
export function isInReadDeletionCode(code: number) {
  return code === IN_READ_DELETION_CODE
}

/**
 * The split class a `junctionSplitClass` code draws as, undefined for an N-gap
 * splice: an in-read deletion draws as the deletion-type class.
 */
export function splitClassOf(code: number): JunctionSplitClass | undefined {
  return isInReadDeletionCode(code)
    ? 'splitForward'
    : SPLIT_JUNCTION_CLASSES[code - 1]
}

/** What the tooltip, feature widget and junction key call a split junction. */
export const SPLIT_JUNCTION_NAMES: Record<JunctionSplitClass, string> = {
  splitForward: 'Split junction (deletion-type)',
  splitBack: 'Split junction (duplication-type)',
  splitInvLL: 'Split junction (inversion, LL-type)',
  splitInvRR: 'Split junction (inversion, RR-type)',
}

/** What the tooltip and feature widget call a deletion counted from CIGAR gaps. */
export const IN_READ_DELETION_NAME = 'Deletion within reads (CIGAR gap)'

/** A junction's name: its split class's, or the in-read deletion's. */
export function splitJunctionName(split: JunctionSplitClass, inRead: boolean) {
  return inRead ? IN_READ_DELETION_NAME : SPLIT_JUNCTION_NAMES[split]
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

/** A junction's `junction.source`: one record's gap, or a join across records. */
export function sourceOfJunction(
  split: JunctionSplitClass | undefined,
  inRead: boolean,
): JunctionSource {
  return inRead ? 'gap' : junctionSource(junctionClass(split))
}

/** The `junction.source` a `junction.class` comes from. */
export function junctionSource(c: JunctionClass): JunctionSource {
  return c === 'splice' ? 'gap' : 'split'
}
