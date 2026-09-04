import { packSyntenyLanes } from '@jbrowse/synteny-core'

import type { SyntenyFeatureData } from './model.ts'
import type { PickCanvasLike } from './syntenyPickEngine.ts'

/**
 * Stand in for the context `makePickCtx` hands the pick engine, so a suite can
 * say whether a candidate's path contains the point without a real canvas.
 *
 * Both backends resolve that context through `OffscreenCanvas`, which is what
 * this replaces — and going through the same door as production is the point:
 * the pick used to run on the Canvas2D backend's own RENDER context, where the
 * device-scale transform silently moved the path out from under the query
 * point. A suite that reaches into the renderer's mock ctx cannot see that,
 * because a mock has no transform to apply.
 *
 * Returns the restore function and a call count, so a test can assert the pick
 * went through here rather than through anything that draws.
 */
export function stubPickCtx(inPath: boolean | (() => boolean) = true) {
  const answer = typeof inPath === 'function' ? inPath : () => inPath
  const calls = { isPointInPath: 0, bezierCurveTo: 0 }
  const key = 'OffscreenCanvas'
  const globals = globalThis as unknown as Record<string, unknown>
  const original = globals[key]
  globals[key] = class {
    getContext() {
      return {
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        bezierCurveTo: () => {
          calls.bezierCurveTo++
        },
        isPointInPath: () => {
          calls.isPointInPath++
          return answer()
        },
      }
    }
  }
  return {
    calls,
    restore: () => {
      globals[key] = original
    },
  }
}

function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * A pick context that answers `isPointInPath` by real point-in-polygon over the
 * path it was just handed, so a suite's "hits here, misses there" asserts
 * something — a stub that always says yes makes every positional test vacuous.
 * `stubPickCtx` above is the other kind of double, and answers the other
 * question: WHICH context the engine picked through.
 *
 * A curve contributes its endpoint only, which is exact for the straight mode
 * the positional suites run in and a chord approximation in curve mode.
 */
export function createGeometricPickCtx(): PickCanvasLike {
  let pts: [number, number][] = []
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {
      pts = []
    },
    closePath() {},
    moveTo(x: number, y: number) {
      pts.push([x, y])
    },
    lineTo(x: number, y: number) {
      pts.push([x, y])
    },
    bezierCurveTo(
      _cp1x: number,
      _cp1y: number,
      _cp2x: number,
      _cp2y: number,
      x: number,
      y: number,
    ) {
      pts.push([x, y])
    },
    fill() {},
    stroke() {},
    isPointInPath(x: number, y: number) {
      return pointInPolygon(x, y, pts)
    },
  }
}

/**
 * One alignment block as a test writes it: readable objects, the fields it cares
 * about, defaults for the rest.
 */
export interface FeatureBlock {
  id?: string
  name?: string
  refName?: string
  start: number
  end: number
  strand?: number
  assembly?: string
  mateRefName?: string
  mateStart?: number
  mateEnd?: number
  mateAssembly?: string
}

function emptyOffscreenMates(): SyntenyFeatureData['offscreenMates'] {
  return {
    mateRefNameDict: [],
    counts: new Uint32Array(0),
    starts: new Float64Array(0),
    ends: new Float64Array(0),
    mateRefNameIds: new Uint32Array(0),
    lengths: new Float32Array(0),
    mateStarts: new Float64Array(0),
    mateEnds: new Float64Array(0),
  }
}

/**
 * Pack blocks the way the RPC hands them over: parallel typed arrays and
 * dictionary-encoded string lanes, not objects.
 *
 * The lanes come from `packSyntenyLanes` walking the lane table, so a lane
 * added there fails this file's typecheck until a reader is written — the
 * harness once drifted to `name ?? id` against production's `name ?? UNNAMED`
 * (the table's sentinel supplies that fallback now, and an id fallback made
 * every id-carrying fixture read as NAMED to the contig votes' evidence rule).
 * What stays here are the harness-only defaults: refName `chr1`, one
 * hg002mat/hg002pat assembly pair, and mate coordinates falling back to the
 * feature's own, which is enough for a test exercising one axis.
 */
export function packSyntenyFeatureData(
  blocks: FeatureBlock[],
  {
    hasCigar = true,
    // The alignments a fetch could not pair, which every caller so far has none
    // of — an empty tally is the answer for a comparison where both rows show
    // every contig, and a suite that wants some builds them.
    offscreenMates = emptyOffscreenMates(),
    // the mirror, which only a bidirectional fetch ever fills
    targetOffscreenMates = emptyOffscreenMates(),
  }: {
    hasCigar?: boolean
    offscreenMates?: SyntenyFeatureData['offscreenMates']
    targetOffscreenMates?: SyntenyFeatureData['offscreenMates']
  } = {},
): SyntenyFeatureData {
  return {
    ...packSyntenyLanes(blocks, {
      numeric: {
        strands: b => b.strand ?? 1,
        starts: b => b.start,
        ends: b => b.end,
        mateStarts: b => b.mateStart ?? b.start,
        mateEnds: b => b.mateEnd ?? b.end,
      },
      dict: {
        name: b => b.name,
        refName: b => b.refName ?? 'chr1',
        assemblyName: b => b.assembly ?? 'hg002mat',
        mateRefName: b => b.mateRefName ?? b.refName ?? 'chr1',
        mateAssemblyName: b => b.mateAssembly ?? 'hg002pat',
      },
      list: {
        featureIds: (b, i) => b.id ?? `f${i}`,
      },
    }),
    attributes: {},
    attributeRanges: {},
    offscreenMates,
    targetOffscreenMates,
    hasCigar,
  }
}
