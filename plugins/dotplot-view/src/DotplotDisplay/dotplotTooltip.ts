import { toLocale } from '@jbrowse/core/util'
import {
  axisSpan,
  featureAttributes,
  genesSharing,
  syntenyBlockLines,
} from '@jbrowse/synteny-core'

import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotRpcData } from './types.ts'

// Every link's x side is on the x axis' assembly and its y side on the y
// axis', so a gene's assembly picks a whole side or none; a self-comparison
// pools both
function onAxisAssembly(axisAssemblyName: string) {
  return (assemblyName: string) => {
    const on = assemblyName === axisAssemblyName
    return () => on
  }
}

/**
 * The hover tooltip for one dotplot feature, as lines: synteny-core's block
 * description, which the synteny views show too, so one block reads the same
 * in every view, and the CIGAR operator under the cursor. A gene with more than
 * one partner has them named, as far as the loaded links reach.
 *
 * The two spans are the DRAWN ones (the trimmed cumBp endpoints), not
 * `alignmentLengths` — that is the feature's full reference span, which on a
 * block trimmed to the displayed region disagrees with the locations printed
 * right above it.
 *
 * `segment` is the endpoints of the stretch of matches under the cursor, which
 * runs between the indels drawn either side of it. Where that is less than the
 * whole block, the two spans are the stretch's and a line gives the block's
 * length: a block broken by large indels spans far more than what is pointed
 * at.
 */
export function getDotplotTooltipLines({
  rpcData,
  featureIdx,
  hview,
  vview,
  cigarOp,
  segment,
}: {
  rpcData: DotplotRpcData
  featureIdx: number
  hview: Dotplot1DViewModel
  vview: Dotplot1DViewModel
  // The operator under the cursor, resolved from the hovered SEGMENT rather than
  // the feature — see `segmentCigarOp`. Undefined for most segments and every
  // zoomed-out one.
  cigarOp?: { op: string; length: number }
  segment?: { x1: number; x2: number; y1: number; y2: number }
}) {
  const { p11, p12, p21, p22, strands, attributes, attributeRanges } = rpcData
  const { nameDict, nameIds, mateNameDict, mateNameIds } = rpcData
  const x = {
    ...axisSpan(p11[featureIdx]!, p12[featureIdx]!, hview),
    name: nameDict[nameIds[featureIdx]!],
  }
  const y = {
    ...axisSpan(p21[featureIdx]!, p22[featureIdx]!, vview),
    name: mateNameDict[mateNameIds[featureIdx]!],
  }
  const sides = [x, y]
  const segmentSides = segment
    ? [
        { ...x, ...axisSpan(segment.x1, segment.x2, hview) },
        { ...y, ...axisSpan(segment.y1, segment.y2, vview) },
      ]
    : undefined
  const blockAttributes = featureAttributes(
    attributes,
    featureIdx,
    attributeRanges,
  )
  const depth = blockAttributes.syntenicDepth
  const sharedBy =
    typeof depth === 'number' && depth > 1
      ? genesSharing(
          {
            lanes: rpcData,
            query: onAxisAssembly(x.assemblyName),
            mate: onAxisAssembly(y.assemblyName),
          },
          [x, y],
        )
      : undefined
  return [
    ...syntenyBlockLines({
      sides,
      segment: segmentSides?.some(
        (side, i) =>
          side.start !== sides[i]!.start || side.end !== sides[i]!.end,
      )
        ? segmentSides
        : undefined,
      inverted: strands[featureIdx] === -1,
      attributes: blockAttributes,
      sharedBy,
    }),
    ...(cigarOp
      ? [`CIGAR operator: ${toLocale(cigarOp.length)}${cigarOp.op}`]
      : []),
  ]
}
