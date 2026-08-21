import { makeStringDict } from '@jbrowse/synteny-core'

import type { SyntenyFeatureData } from './model.ts'

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
 * Shared because four suites had a `data(blocks: Block[])` of their own, each
 * spelling out all fourteen fields of the payload with a slightly different
 * `Block` — so the string lanes going dictionary-encoded was a four-file edit
 * that said nothing about any of the four suites. Mate coordinates default to
 * the feature's own, which is enough for a test exercising one axis.
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
  const lane = (values: string[]) => {
    const d = makeStringDict()
    return { dict: d.dict, ids: Uint32Array.from(values, v => d.idFor(v)) }
  }
  const names = lane(blocks.map(b => b.name ?? b.id ?? ''))
  const refNames = lane(blocks.map(b => b.refName ?? 'chr1'))
  const assemblies = lane(blocks.map(b => b.assembly ?? 'hg002mat'))
  const mateRefNames = lane(
    blocks.map(b => b.mateRefName ?? b.refName ?? 'chr1'),
  )
  const mateAssemblies = lane(blocks.map(b => b.mateAssembly ?? 'hg002pat'))
  return {
    offscreenMates,
    targetOffscreenMates,
    strands: Int8Array.from(blocks, b => b.strand ?? 1),
    starts: Uint32Array.from(blocks, b => b.start),
    ends: Uint32Array.from(blocks, b => b.end),
    attributes: {},
    attributeRanges: {},
    featureIds: blocks.map((b, i) => b.id ?? `f${i}`),
    nameDict: names.dict,
    nameIds: names.ids,
    refNameDict: refNames.dict,
    refNameIds: refNames.ids,
    assemblyNameDict: assemblies.dict,
    assemblyNameIds: assemblies.ids,
    mateStarts: Uint32Array.from(blocks, b => b.mateStart ?? b.start),
    mateEnds: Uint32Array.from(blocks, b => b.mateEnd ?? b.end),
    mateRefNameDict: mateRefNames.dict,
    mateRefNameIds: mateRefNames.ids,
    mateAssemblyNameDict: mateAssemblies.dict,
    mateAssemblyNameIds: mateAssemblies.ids,
    hasCigar,
  }
}
