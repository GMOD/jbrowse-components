import { slangPass } from '@jbrowse/render-core/slangPass'

import * as arcShader from '../../shaders/slang/arc.generated.ts'
import * as arcFlatShader from '../../shaders/slang/arcFlat.generated.ts'
import * as arcLineShader from '../../shaders/slang/arcLine.generated.ts'
import * as arcMarkerShader from '../../shaders/slang/arcMarker.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { ARC_SHAPE_FLAT_SPLIT, isFlatArcShape } from './shapes.ts'

import type { ArcsUploadData } from './types.ts'

// What the arc-band passes pack from. The band is the one upload whose input
// isn't the pileup payload: `arcs` is a separate RPC result (absent whenever the
// band is off) and `baseWidth` is the configured `readConnectionsLineWidth`,
// which reaches the pack tier rather than staying a per-frame uniform because
// each arc's own width is resolved from its read support at pack time — that
// makes the setting part of what a buffer was packed from, which is why the
// renderer's upload memo carries it.
export interface ArcsPackData {
  arcs: ArcsUploadData
  baseWidth: number
}

// Curved paired-read arcs only. 130 vertices per instance, because the strip is
// a hull that must contain the analytic dome the fragment measures.
export const ARC_PASS = {
  ...slangPass({
    id: 'arc',
    mod: arcShader,
  }),
  pack: (d: ArcsPackData) => packArcs(d.arcs, d.baseWidth),
}

// Default triangle-list topology — a flat read-cloud connector is a 6-vertex
// quad. It used to be an instance of ARC_PASS, i.e. 130 vertices tessellating a
// straight line, in the one mode that draws thousands of them.
export const ARC_FLAT_PASS = {
  ...slangPass({
    id: 'arcFlat',
    mod: arcFlatShader,
  }),
  pack: (d: ArcsPackData) => packArcFlats(d.arcs, d.baseWidth),
}

// Default triangle-list topology — the tick is an antialiased 6-vertex quad,
// not a native line (see arcLine.slang).
export const ARC_LINE_PASS = {
  ...slangPass({
    id: 'arcLine',
    mod: arcLineShader,
  }),
  pack: (d: ArcsPackData) => packArcLines(d.arcs, d.baseWidth),
}

// Default triangle-list topology — each marker is a 6-vertex quad.
export const ARC_MARKER_PASS = {
  ...slangPass({
    id: 'arcMarker',
    mod: arcMarkerShader,
  }),
  pack: (d: ArcsPackData) => packArcMarkers(d.arcs),
}

// The two shape families are packed into two buffers rather than one buffer the
// shader branches on, because their vertex counts differ by 32x (see
// ARC_FLAT_PASS). `numFlatArcs` is precomputed alongside the arrays, so each
// pass sizes its buffer exactly and the compaction below is a single walk.
//
// In practice one of the two is always empty — `computeArcShape` emits a flat
// shape iff `cloud` — so the extra pass costs nothing in either mode. Nothing
// depends on that, though: a mixed feed packs and draws correctly.
//
// Module-private: this is `packArcs`' own allocation size, and the upload tier
// used to export it to recompute the instance count a second time. The count is
// now the packed buffer's own length (`uploadPass`), so this subtraction has
// exactly one reader.
function curvedArcCount(data: ArcsUploadData) {
  return data.numArcs - data.numFlatArcs
}

// Stroke width, in CSS px, for the arc at index `i` of a feed — the whole
// reason the packers take the configured `readConnectionsLineWidth`. An arc is
// a junction rather than a read (resolveArcs coalesces identical connections
// and counts them), so its weight is what says how many reads stand behind it.
//
// Resolved HERE, on the CPU, for both GPU passes: `arcLineWidth` is the one
// implementation of that curve, shared with Canvas2D and the SVG export, and a
// shader evaluating a log2 of its own would be a second one to keep in step.
// The vertex stage receives a width and no support count at all.
function widthOf(data: ArcsUploadData, i: number, baseWidth: number) {
  return arcLineWidth(data.arcSupport[i]!, baseWidth)
}

// Field-for-field packing is delegated to the generated packInstances so the
// instance layout can never drift from the shader struct.
export function packArcs(data: ArcsUploadData, baseWidth: number): ArrayBuffer {
  const count = curvedArcCount(data)
  const x1 = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const colorType = new Uint8Array(count)
  const yBp = new Uint32Array(count)
  const lineWidthPx = new Float32Array(count)
  let n = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (!isFlatArcShape(data.arcShapeTypes[i]!)) {
      x1[n] = data.arcX1[i]!
      x2[n] = data.arcX2[i]!
      colorType[n] = data.arcColorTypes[i]!
      yBp[n] = data.arcYBp[i]!
      lineWidthPx[n] = widthOf(data, i, baseWidth)
      n++
    }
  }
  return arcShader.packInstances({ x1, x2, colorType, yBp, lineWidthPx }, count)
}

// The flat read-cloud connectors. No color — the line is a theme neutral and the
// category color lives in the endpoint squares (packArcMarkers) — but `dashed`
// is a real per-instance bit, since the solid and split variants coexist in one
// draw.
//
// Widths are per instance here for the same reason as the curved pass: flat
// arcs coalesce on the same key, and `drawArcsToCtx` sets `ctx.lineWidth` from
// support BEFORE it branches on shape, so a flat pass left on the global
// uniform would be the one place read cloud disagreed with its own SVG export.
export function packArcFlats(
  data: ArcsUploadData,
  baseWidth: number,
): ArrayBuffer {
  const count = data.numFlatArcs
  const x1 = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const yBp = new Uint32Array(count)
  const dashed = new Uint8Array(count)
  const lineWidthPx = new Float32Array(count)
  let n = 0
  for (let i = 0; i < data.numArcs; i++) {
    const shape = data.arcShapeTypes[i]!
    if (isFlatArcShape(shape)) {
      x1[n] = data.arcX1[i]!
      x2[n] = data.arcX2[i]!
      yBp[n] = data.arcYBp[i]!
      dashed[n] = shape === ARC_SHAPE_FLAT_SPLIT ? 1 : 0
      lineWidthPx[n] = widthOf(data, i, baseWidth)
      n++
    }
  }
  return arcFlatShader.packInstances(
    { x1, x2, yBp, dashed, lineWidthPx },
    count,
  )
}

// Position and width. A tick's color is ARC_COLOR_INTERCHROM, which the shader
// names itself (see arcLine.slang), but its width is per instance for the same
// reason the other two arc passes' are: a tick is one breakpoint rather than one
// read since `resolveArcs` coalesced them, so the weight is how many reads stand
// behind it, through the one `arcLineWidth` curve.
export function packArcLines(
  data: ArcsUploadData,
  baseWidth: number,
): ArrayBuffer {
  const count = data.numArcLines
  const lineWidthPx = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    lineWidthPx[i] = arcLineWidth(data.arcLineSupport[i]!, baseWidth)
  }
  return arcLineShader.packInstances(
    { position: data.arcLinePositions, lineWidthPx },
    count,
  )
}

// Two endpoint-square markers per flat (read-cloud) arc — one at each end.
// Regular curved arcs carry no markers (their endpoints sit on the baseline),
// so in arc mode `numFlatArcs` is 0 and the caller skips this entirely rather
// than scanning every arc to discover there is nothing to draw.
export function packArcMarkers(data: ArcsUploadData): ArrayBuffer {
  const count = data.numFlatArcs * 2
  const position = new Uint32Array(count)
  const colorType = new Uint8Array(count)
  const yBp = new Uint32Array(count)
  let n = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatArcShape(data.arcShapeTypes[i]!)) {
      const c = data.arcColorTypes[i]!
      const y = data.arcYBp[i]!
      position[n] = data.arcX1[i]!
      colorType[n] = c
      yBp[n] = y
      n++
      position[n] = data.arcX2[i]!
      colorType[n] = c
      yBp[n] = y
      n++
    }
  }
  return arcMarkerShader.packInstances({ position, colorType, yBp }, count)
}
