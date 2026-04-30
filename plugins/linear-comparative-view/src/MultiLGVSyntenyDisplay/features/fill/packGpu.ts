import {
  InstanceBuilder,
  visitCigarOps,
  visitCsOps,
} from '@jbrowse/alignments-core'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import {
  FIELD_OFFSET_F32 as FILL_FIELD,
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE,
  INSTANCE_STRIDE_F32 as FILL_STRIDE,
} from '../../shaders/slang/multiSyntenyFill.generated.ts'
import { getFeatureColor } from '../../shared/colorUtils.ts'
import { buildGpuOpsVisitor } from '../../shared/extractCigarFeatures.ts'
import { addInstance, buildColorArrays } from '../../shared/instanceWriter.ts'

import type { SyntenyColors } from '../../shared/types.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface BlockGeometryData {
  buffer: ArrayBuffer
  instanceCount: number
}

// SYNC: field layout must match Instance struct in multiSyntenyFill shader
// [startBp: u32, endBp: u32, genomeRow: u32, featureId: u32, color: u32, _pad×3]
export function prepareBlockGeometry(
  genomeFeatures: [string, MultiPairFeature[]][],
  displayedGenomes: string[],
  colorBy: string,
  showSnps: boolean,
  colors: SyntenyColors,
): BlockGeometryData {
  const tStart = performance.now()
  const rgba = buildColorArrays(colors)
  let totalFeatures = 0
  let withCs = 0
  let withCigar = 0
  for (const [, features] of genomeFeatures) {
    totalFeatures += features.length
    for (const f of features) {
      if (f.cs) withCs++
      else if (f.cigar) withCigar++
    }
  }

  const builder = new InstanceBuilder(INSTANCE_BYTE_SIZE, totalFeatures * 2)

  const genomeIndexMap = new Map(
    displayedGenomes.map((g, i) => [g, i] as const),
  )

  let featureIdx = 0
  let mmCount = 0
  let delCount = 0
  let insCount = 0
  for (const [genomeName, features] of genomeFeatures) {
    const g = genomeIndexMap.get(genomeName)
    if (g === undefined) {
      continue
    }
    for (const feat of features) {
      const fId = ++featureIdx
      addInstance(
        builder,
        feat.start,
        feat.end,
        g,
        fId,
        cssColorToABGR(getFeatureColor(feat, colorBy)),
      )

      if (showSnps) {
        const baseVisitor = buildGpuOpsVisitor(builder, g, fId, rgba)
        const visitor = {
          onMismatch: (refPos: number, len: number, queryBase?: string) => {
            mmCount++
            baseVisitor.onMismatch(refPos, len, queryBase)
          },
          onDeletion: (refPos: number, len: number) => {
            delCount++
            baseVisitor.onDeletion(refPos, len)
          },
          onInsertion: (refPos: number, len: number) => {
            insCount++
            baseVisitor.onInsertion(refPos, len)
          },
        }
        if (feat.cs) {
          visitCsOps(feat.cs, feat.start, visitor)
        } else if (feat.cigar) {
          visitCigarOps(parseCigar2(feat.cigar), feat.start, visitor)
        }
      }
    }
  }
  console.log(
    `[MultiLGVSynteny] ops emitted: mismatches=${mmCount} deletions=${delCount} insertions=${insCount}`,
  )

  const n = builder.getCount()
  const rawBuf = builder.getBuffer()

  // Sort by genomeRow then start position for rendering order
  const indices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    indices[i] = i
  }
  const u32View = new Uint32Array(rawBuf)
  indices.sort((a, b) => {
    const rowA = u32View[a * FILL_STRIDE + FILL_FIELD.genomeRow]!
    const rowB = u32View[b * FILL_STRIDE + FILL_FIELD.genomeRow]!
    if (rowA !== rowB) {
      return rowA - rowB
    }
    return (
      u32View[a * FILL_STRIDE + FILL_FIELD.startBp]! -
      u32View[b * FILL_STRIDE + FILL_FIELD.startBp]!
    )
  })

  const sortedBuf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
  const srcBytes = new Uint8Array(rawBuf)
  const dstBytes = new Uint8Array(sortedBuf)

  for (let i = 0; i < n; i++) {
    const srcIdx = indices[i]!
    dstBytes.set(
      srcBytes.subarray(
        srcIdx * INSTANCE_BYTE_SIZE,
        (srcIdx + 1) * INSTANCE_BYTE_SIZE,
      ),
      i * INSTANCE_BYTE_SIZE,
    )
  }

  console.log(
    `[MultiLGVSynteny] prepareBlockGeometry feats=${totalFeatures} cs=${withCs} cigar=${withCigar} showSnps=${showSnps} instances=${n} ${(performance.now() - tStart).toFixed(0)}ms`,
  )
  return { buffer: sortedBuf, instanceCount: n }
}

export { INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE } from '../../shaders/slang/multiSyntenyFill.generated.ts'
