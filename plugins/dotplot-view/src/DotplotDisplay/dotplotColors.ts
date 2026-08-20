import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  createComparativeColorFunction,
} from '@jbrowse/synteny-core'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
import type { AttributeRange, SyntenyColorBy } from '@jbrowse/synteny-core'

// The color function itself is `createComparativeColorFunction` in
// synteny-core — the palette, the chromosome-order laps, the ramp LUTs and the
// colorBy switch are all shared with the linear synteny renderer, which is what
// keeps the two views from painting the same two genomes differently. They had:
// synteny handed out palette positions by chromosome, this file hashed into nine
// buckets, and a rice karyotype collided three ways here and not there.
//
// What is dotplot's is below: the unpainted default (its conventional flat
// black point rather than the ribbon's red match block) and the per-SEGMENT
// expansion, since dotplot geometry is one line per CIGAR step where synteny's
// is one instance per drawn tile.

// Dotplot's own default, the one thing the shared switch takes as a parameter.
const POINT_COLOR = cssColorToABGR(colorSchemes.default.pointColor)

export function createDotplotColorFunction(
  colorBy: SyntenyColorBy,
  data: DotplotRpcData,
  trackColor: string,
  attributeRanges: Record<string, AttributeRange>,
  nameOrder?: readonly string[],
) {
  return createComparativeColorFunction({
    colorBy,
    data,
    trackColor,
    nameOrder,
    attributeRanges,
    defaultColor: POINT_COLOR,
  })
}

// Pure function: one packed-ABGR color per line segment, from the segment ->
// feature map the geometry builder emitted plus the current palette. This is the
// gpuProps half of the rpcProps/gpuProps split — a colorBy change reruns only
// this, leaving the positions (and the CIGAR walk that produced them)
// untouched. Opacity is deliberately NOT an input: it is a render parameter, so
// the slider redraws without touching this array at all.
export function computeDotplotColors({
  instanceData,
  rpcData,
  colorBy,
  trackColor,
  nameOrder,
  attributeRanges,
}: {
  instanceData: DotplotInstanceData
  rpcData: DotplotRpcData
  colorBy: SyntenyColorBy
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
  // Chromosome order of the axis assembly the painting mode keys on; see
  // `DotplotDisplay.paintedChromosomeOrder`.
  nameOrder?: readonly string[]
  // The domain an `attribute:<name>` ramp scales to — the view's accumulated
  // one, not this fetch's. See `createComparativeColorFunction`.
  attributeRanges: Record<string, AttributeRange>
}) {
  const { instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createDotplotColorFunction(
    colorBy,
    rpcData,
    trackColor,
    attributeRanges,
    nameOrder,
  )
  const out = new Uint32Array(instanceCount)
  for (let i = 0; i < instanceCount; i++) {
    out[i] = colorFn(instanceFeatureIdx[i]!)
  }
  return out
}
