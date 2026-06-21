import { assembleLocString, toLocale } from '@jbrowse/core/util'

import {
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
} from '../../LinearSyntenyRPC/syntenyColors.ts'

import type { SyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { FeatPos } from '../model.ts'

export interface ClickCoord {
  clientX: number
  clientY: number
  feature: FeatPos
}

export interface CigarOpInfo {
  op: string
  length: number
}

const CIGAR_KIND_LETTER: Record<number, string> = {
  [KIND_CIGAR_I]: 'I',
  [KIND_CIGAR_D]: 'D',
  [KIND_CIGAR_N]: 'N',
}

// Resolve the CIGAR operator under the hovered GPU instance. Indel/skip tiles
// (KIND_CIGAR_I/D/N) are emitted on top of the KIND_BASE block, so the picked
// instance index lands on the tile directly. The op length in bp is the span
// of whichever axis advanced: deletions/skips advance loc1 (bp1→bp2),
// insertions advance loc2 (bp3→bp4); the other axis stays a point. See
// visitCigarRenderedSegments + buildSyntenyGeometry.addInstance.
export function getCigarOpAtInstance(
  data: SyntenyGeometry,
  i: number,
): CigarOpInfo | undefined {
  const op = CIGAR_KIND_LETTER[data.kinds[i]!]
  if (!op) {
    return undefined
  }
  const bp1 = data.bp1Hi[i]! + data.bp1Lo[i]!
  const bp2 = data.bp2Hi[i]! + data.bp2Lo[i]!
  const bp3 = data.bp3Hi[i]! + data.bp3Lo[i]!
  const bp4 = data.bp4Hi[i]! + data.bp4Lo[i]!
  const length = Math.round(Math.max(Math.abs(bp2 - bp1), Math.abs(bp3 - bp4)))
  return { op, length }
}

export function getTooltip(feat: FeatPos, cigarOp?: CigarOpInfo) {
  const l1 = feat.end - feat.start
  const l2 = feat.mate.end - feat.mate.start
  return [
    `Loc1: ${assembleLocString({ refName: feat.refName, start: feat.start, end: feat.end, assemblyName: feat.assemblyName })}`,
    `Loc2: ${assembleLocString({ refName: feat.mate.refName, start: feat.mate.start, end: feat.mate.end, assemblyName: feat.mate.assemblyName })}`,
    `Inverted: ${feat.strand === -1}`,
    `Query len: ${toLocale(l1)}`,
    `Target len: ${toLocale(l2)}`,
    feat.identity !== undefined
      ? `Identity: ${feat.identity.toPrecision(2)}`
      : '',
    cigarOp ? `CIGAR operator: ${toLocale(cigarOp.length)}${cigarOp.op}` : '',
    feat.name ? `Name: ${feat.name}` : '',
  ]
    .filter(Boolean)
    .join('<br/>')
}
