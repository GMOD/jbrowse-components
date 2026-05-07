import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { FIELD_OFFSET_F32 as FILL_FIELD } from '../shaders/slang/multiSyntenyFill.generated.ts'

import type { SyntenyColors } from './types.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

export function addInstance(
  builder: InstanceBuilder,
  startBp: number,
  endBp: number,
  genomeRow: number,
  featureId: number,
  color: number,
) {
  const off = builder.alloc()
  builder.u32[off + FILL_FIELD.startBp] = startBp >>> 0
  builder.u32[off + FILL_FIELD.endBp] = endBp >>> 0
  builder.u32[off + FILL_FIELD.genomeRow] = genomeRow >>> 0
  builder.u32[off + FILL_FIELD.featureId] = featureId >>> 0
  builder.u32[off + FILL_FIELD.color] = color
}

export interface CigarColorArrays {
  mismatch: number
  deletion: number
  insertion: number
  bases: Record<string, number>
}

export function buildColorArrays(colors: SyntenyColors): CigarColorArrays {
  const baseA = cssColorToABGR(colors.baseA)
  const baseC = cssColorToABGR(colors.baseC)
  const baseG = cssColorToABGR(colors.baseG)
  const baseT = cssColorToABGR(colors.baseT)
  return {
    mismatch: cssColorToABGR(colors.mismatch),
    deletion: cssColorToABGR(colors.deletion),
    insertion: cssColorToABGR(colors.insertion),
    bases: {
      A: baseA,
      a: baseA,
      C: baseC,
      c: baseC,
      G: baseG,
      g: baseG,
      T: baseT,
      t: baseT,
    },
  }
}
