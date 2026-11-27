import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import type { JunctionClass, JunctionSource } from './junctionVocabulary.ts'

export { JUNCTION_CLASSES, JUNCTION_SOURCES } from './junctionVocabulary.ts'
export type { JunctionClass, JunctionSource } from './junctionVocabulary.ts'

/** The split classes a junction arc draws: those spanning reference. */
export type JunctionSplitClass = Exclude<ArcSplitCategory, 'splitInsertion'>

export const SPLIT_JUNCTION_CLASSES = [
  'splitForward',
  'splitBack',
  'splitInvLL',
  'splitInvRR',
] as const satisfies readonly JunctionSplitClass[]

/**
 * What made a junction, in `junctionSplitClass` code order: a CIGAR `N`, a
 * split read of each class, or a CIGAR `D` of `SV_INDEL_MIN_BP` or more.
 */
export const JUNCTION_KINDS = [
  'splice',
  ...SPLIT_JUNCTION_CLASSES,
  'gapDeletion',
] as const

export type JunctionKind = (typeof JUNCTION_KINDS)[number]

export const GAP_DELETION_CODE = JUNCTION_KINDS.indexOf('gapDeletion')

export function junctionKindOf(code: number) {
  return JUNCTION_KINDS[code] ?? 'splice'
}

/** A split class's `junctionSplitClass` code. */
export function splitClassCode(split: JunctionSplitClass) {
  return JUNCTION_KINDS.indexOf(split)
}

export function splitClassOf(kind: JunctionKind) {
  return kind === 'splice' || kind === 'gapDeletion' ? undefined : kind
}

export function junctionColorClass(kind: JunctionKind) {
  return kind === 'gapDeletion' ? 'splitForward' : splitClassOf(kind)
}

const CLASS_OF_KIND: Record<JunctionKind, JunctionClass> = {
  splice: 'splice',
  splitForward: 'deletion',
  splitBack: 'duplication',
  splitInvLL: 'inversion',
  splitInvRR: 'inversion',
  gapDeletion: 'deletion',
}

/** A junction's `junction.class`. */
export function junctionClass(kind: JunctionKind) {
  return CLASS_OF_KIND[kind]
}

/** A junction's `junction.source`: one record's gap, or a join across records. */
export function junctionSource(kind: JunctionKind): JunctionSource {
  return splitClassOf(kind) ? 'split' : 'gap'
}

/** What the tooltip, feature widget and junction key call a split junction. */
export const SPLIT_JUNCTION_NAMES: Record<JunctionSplitClass, string> = {
  splitForward: 'Split junction (deletion-type)',
  splitBack: 'Split junction (duplication-type)',
  splitInvLL: 'Split junction (inversion, LL-type)',
  splitInvRR: 'Split junction (inversion, RR-type)',
}

export const GAP_DELETION_NAME = 'Deletion (gapped reads)'

export const GAP_AND_SPLIT_DELETION_NAME = 'Deletion (gapped and split reads)'

export function junctionName(kind: Exclude<JunctionKind, 'splice'>) {
  return kind === 'gapDeletion' ? GAP_DELETION_NAME : SPLIT_JUNCTION_NAMES[kind]
}

export function junctionCountLabel(kind: JunctionKind) {
  return kind === 'gapDeletion'
    ? 'Reads with exactly this gap'
    : 'Reads supporting junction'
}
