import { toLocale } from '@jbrowse/core/util'
import { syntenyBlockLines } from '@jbrowse/synteny-core'

import {
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
} from '../../LinearSyntenyRPC/syntenyKinds.ts'

import type { SyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { FeatPos, SyntenyFeatureData } from '../model.ts'

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
  // Window-relative bp; the op length is a within-axis span, so the per-axis
  // base cancels in the subtraction (bp1/bp2 share base0, bp3/bp4 share base1).
  const bp1 = data.bp1[i]!
  const bp2 = data.bp2[i]!
  const bp3 = data.bp3[i]!
  const bp4 = data.bp4[i]!
  const length = Math.round(Math.max(Math.abs(bp2 - bp1), Math.abs(bp3 - bp4)))
  return { op, length }
}

// The distinct genes the loaded links pair one gene with, in genome order, read
// from both sides, since a link may hold the gene on either one; a
// self-comparison pools both, as the adapter's `partnerCounts` does
function partnersOf(
  data: SyntenyFeatureData,
  assemblyName: string,
  name: string,
) {
  const asm = data.assemblyNameDict.indexOf(assemblyName)
  const gene = data.nameDict.indexOf(name)
  const mateAsm = data.mateAssemblyNameDict.indexOf(assemblyName)
  const mateGene = data.mateNameDict.indexOf(name)
  const partners = new Map<string, { refName: string; start: number }>()
  for (let i = 0; i < data.featureIds.length; i++) {
    if (data.assemblyNameIds[i] === asm && data.nameIds[i] === gene) {
      partners.set(data.mateNameDict[data.mateNameIds[i]!]!, {
        refName: data.mateRefNameDict[data.mateRefNameIds[i]!]!,
        start: data.mateStarts[i]!,
      })
    }
    if (
      data.mateAssemblyNameIds[i] === mateAsm &&
      data.mateNameIds[i] === mateGene
    ) {
      partners.set(data.nameDict[data.nameIds[i]!]!, {
        refName: data.refNameDict[data.refNameIds[i]!]!,
        start: data.starts[i]!,
      })
    }
  }
  return [...partners]
    .sort(
      ([, a], [, b]) =>
        a.refName.localeCompare(b.refName, undefined, { numeric: true }) ||
        a.start - b.start,
    )
    .map(([partner]) => partner)
}

// The genes sharing a link's ortholog: the partners of whichever of its two
// genes has more, the side its syntenic depth was counted on
export function sharedByOf(data: SyntenyFeatureData, feat: FeatPos) {
  const mateName = feat.mate.name
  const ofGene = partnersOf(data, feat.assemblyName, feat.name)
  const ofMate =
    mateName === undefined
      ? []
      : partnersOf(data, feat.mate.assemblyName, mateName)
  return ofMate.length > ofGene.length ? ofMate : ofGene
}

// The hovered ribbon's tooltip, as LINES rather than a `<br/>`-joined HTML
// string, which `ComparativeTooltip` renders as text nodes. The block's
// description is synteny-core's, which the linear view's synteny hover shows
// too, so one block reads the same in both; this view adds the CIGAR operator
// under the cursor.
export function getTooltipLines(
  feat: FeatPos,
  cigarOp?: CigarOpInfo,
  sharedBy?: readonly string[],
) {
  return [
    ...syntenyBlockLines({
      sides: [
        {
          assemblyName: feat.assemblyName,
          name: feat.name,
          refName: feat.refName,
          start: feat.start,
          end: feat.end,
        },
        {
          assemblyName: feat.mate.assemblyName,
          name: feat.mate.name,
          refName: feat.mate.refName,
          start: feat.mate.start,
          end: feat.mate.end,
        },
      ],
      inverted: feat.strand === -1,
      attributes: feat.attributes,
      sharedBy,
    }),
    ...(cigarOp
      ? [`CIGAR operator: ${toLocale(cigarOp.length)}${cigarOp.op}`]
      : []),
  ]
}
