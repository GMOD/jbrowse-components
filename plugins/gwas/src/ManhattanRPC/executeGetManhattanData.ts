import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { buildLdToIndex } from './ldToIndex.ts'
import { makeColorEvaluator } from './makeColorEvaluator.ts'
import { makeLdColorEvaluator } from './makeLdColorEvaluator.ts'
import { makeLdR2Evaluator } from './makeLdR2Evaluator.ts'

import type { LDRecordSource } from './ldToIndex.ts'
import type { GetManhattanDataArgs, ManhattanRpcResult } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

// Pure reducer: features → ManhattanRpcResult. Extracted so it can be unit-
// tested without the RPC/adapter/jexl plumbing.
export function buildManhattanResult(
  features: Feature[],
  evalColor: (f: Feature) => number,
  evalR2?: (f: Feature) => number,
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

  for (let i = 0; i < n; i++) {
    const f = features[i]!
    // Uint32Array assignment coerces via ToUint32 (handles full 32-bit bp
    // space); a `| 0` here would silently sign-extend bp ≥ 2^31 — wrong for
    // T2T-scale cumulative coordinates.
    positions[i] = f.get('start')
    ends[i] = f.get('end')
    glyphs[i] = f.get('svtype') === 'INS' ? 1 : 0
    const score = Number(f.get('score'))
    scores[i] = score
    if (score < scoreMin) {
      scoreMin = score
    }
    if (score > scoreMax) {
      scoreMax = score
    }
    colors[i] = evalColor(f)
    if (r2s) {
      r2s[i] = evalR2!(f)
    }
  }

  let flatbushData: ArrayBuffer | undefined
  if (n > 0) {
    const fb = new Flatbush(n, undefined, Float64Array)
    for (let i = 0; i < n; i++) {
      const s = scores[i]!
      // bp interval [start,end] so hovering anywhere on a ranged SV's span
      // (not just its start) returns it; point features collapse to a 1bp box.
      fb.add(positions[i]!, s, ends[i], s)
    }
    fb.finish()
    flatbushData = fb.data
  }

  return {
    positions,
    ends,
    glyphs,
    scores,
    colors,
    r2s,
    numFeatures: n,
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

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const features = await updateStatus('Loading GWAS data', statusCallback, () =>
    dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )

  checkStopToken2(stopTokenCheck)

  let evalColor: (f: Feature) => number
  let evalR2: ((f: Feature) => number) | undefined
  let indexFound: boolean | undefined
  if (colorBy === 'ld' && indexSnp && ldAdapterConfig) {
    const ldAdapter = (
      await getAdapter(pluginManager, sessionId, ldAdapterConfig)
    ).dataAdapter as unknown as LDRecordSource
    const ld = await updateStatus('Loading LD data', statusCallback, () =>
      buildLdToIndex({ adapter: ldAdapter, region, indexSnp }),
    )
    checkStopToken2(stopTokenCheck)
    evalColor = makeLdColorEvaluator(ld, indexSnp, region.refName)
    evalR2 = makeLdR2Evaluator(ld, indexSnp, region.refName)
    indexFound = ld.indexFound
  } else {
    evalColor = makeColorEvaluator(color, pluginManager.jexl)
  }

  const result = buildManhattanResult(features, evalColor, evalR2)
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
