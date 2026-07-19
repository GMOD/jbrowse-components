import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { isLDRecordSource } from '@jbrowse/ld-core'

import { buildLdToIndex } from './ldToIndex.ts'
import { makeColorEvaluator } from './makeColorEvaluator.ts'
import { makeLdEvaluator } from './makeLdEvaluator.ts'
import { GLYPH_INSERTION, GLYPH_POINT } from './rpcTypes.ts'

import type { GetManhattanDataArgs, ManhattanRpcResult } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

// Pure reducer: features → ManhattanRpcResult. Extracted so it can be unit-
// tested without the RPC/adapter/jexl plumbing.
export function buildManhattanResult(
  features: Feature[],
  evalColor: (f: Feature) => number,
  evalR2?: (f: Feature) => number,
  report?: ProgressReporter,
  evalGlyph?: (f: Feature) => number,
): ManhattanRpcResult {
  const n = features.length
  const positions = new Uint32Array(n)
  const ends = new Uint32Array(n)
  const glyphs = new Uint8Array(n)
  const scores = new Float32Array(n)
  const colors = new Uint32Array(n)
  const r2s = evalR2 ? new Float32Array(n) : undefined
  let scoreMin = Infinity
  let scoreMax = -Infinity
  let count = 0

  for (let i = 0; i < n; i++) {
    report?.(i)
    const f = features[i]!
    const score = Number(f.get('score'))
    // A Manhattan point needs a finite y (-log10 p). Missing/garbage scores
    // (Number(undefined) === NaN) aren't plottable, and an unguarded NaN box
    // poisons the region's Flatbush node bounds via Math.min/max — breaking
    // hit-testing for every point in the region. Skip them so the output
    // arrays stay dense and index-aligned with the flatbush.
    if (Number.isFinite(score)) {
      // Uint32Array assignment coerces via ToUint32 (handles full 32-bit bp
      // space); a `| 0` here would silently sign-extend bp ≥ 2^31 — wrong for
      // T2T-scale cumulative coordinates.
      positions[count] = f.get('start')
      ends[count] = f.get('end')
      glyphs[count] = evalGlyph
        ? evalGlyph(f)
        : f.get('svtype') === 'INS'
          ? GLYPH_INSERTION
          : GLYPH_POINT
      scores[count] = score
      if (score < scoreMin) {
        scoreMin = score
      }
      if (score > scoreMax) {
        scoreMax = score
      }
      colors[count] = evalColor(f)
      if (r2s) {
        r2s[count] = evalR2!(f)
      }
      count++
    }
  }

  let flatbushData: ArrayBuffer | undefined
  if (count > 0) {
    const fb = new Flatbush(count, undefined, Float64Array)
    for (let i = 0; i < count; i++) {
      const s = scores[i]!
      // bp interval [start,end] so hovering anywhere on a ranged SV's span
      // (not just its start) returns it; point features collapse to a 1bp box.
      fb.add(positions[i]!, s, ends[i], s)
    }
    fb.finish()
    flatbushData = fb.data
  }

  // Truncate to the finite-score count (subarray shares the buffer, so no copy
  // and the full ArrayBuffer still transfers correctly).
  return {
    positions: positions.subarray(0, count),
    ends: ends.subarray(0, count),
    glyphs: glyphs.subarray(0, count),
    scores: scores.subarray(0, count),
    colors: colors.subarray(0, count),
    r2s: r2s?.subarray(0, count),
    numFeatures: count,
    scoreMin,
    scoreMax,
    flatbushData,
  }
}

// GWAS data is 1:1 features → points and is conventionally pre-transformed
// (e.g. neg_log_pvalue). Per-feature jexl color eval happens here on the
// worker because we need Feature objects in scope.
export async function executeGetManhattanData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetManhattanDataArgs
}): Promise<ManhattanRpcResult> {
  const {
    sessionId,
    adapterConfig,
    region,
    color,
    colorBy,
    indexSnp,
    ldAdapterConfig,
    stopToken,
    statusCallback = () => {},
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const features = await updateStatus('Downloading GWAS data', statusCallback, () =>
    dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )

  checkStopToken2(stopTokenCheck)

  let evalColor: (f: Feature) => number
  let evalR2: ((f: Feature) => number) | undefined
  let evalGlyph: ((f: Feature) => number) | undefined
  let indexFound: boolean | undefined
  if (colorBy === 'ld' && indexSnp && ldAdapterConfig) {
    const { dataAdapter: ldAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      ldAdapterConfig,
    )
    if (!isLDRecordSource(ldAdapter)) {
      throw new Error(
        `Adapter type "${ldAdapterConfig.type}" cannot supply LD records for coloring`,
      )
    }
    const ld = await updateStatus('Downloading LD data', statusCallback, () =>
      buildLdToIndex({ adapter: ldAdapter, region, indexSnp }),
    )
    checkStopToken2(stopTokenCheck)
    const ldEval = makeLdEvaluator(ld, indexSnp, region.refName)
    evalColor = ldEval.evalColor
    evalR2 = ldEval.evalR2
    evalGlyph = ldEval.evalGlyph
    indexFound = ld.indexFound
  } else {
    evalColor = makeColorEvaluator(color, pluginManager.jexl)
  }

  const result = buildManhattanResult(
    features,
    evalColor,
    evalR2,
    createProgressReporter({
      label: 'Processing GWAS features',
      total: features.length,
      statusCallback,
      stopTokenCheck,
    }),
    evalGlyph,
  )
  result.indexFound = indexFound

  const transferables: Transferable[] = [
    result.positions.buffer,
    result.ends.buffer,
    result.glyphs.buffer,
    result.scores.buffer,
    result.colors.buffer,
  ]
  if (result.r2s) {
    transferables.push(result.r2s.buffer)
  }
  if (result.flatbushData) {
    transferables.push(result.flatbushData)
  }
  return rpcResult(result, transferables) as unknown as ManhattanRpcResult
}
