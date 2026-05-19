import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { makeColorEvaluator } from './makeColorEvaluator.ts'

import type { GetManhattanDataArgs, ManhattanRpcResult } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

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
    stopToken,
    statusCallback = () => {},
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const features = await updateStatus('Loading GWAS data', statusCallback, () =>
    firstValueFrom(dataAdapter.getFeatures(region).pipe(toArray())),
  )

  checkStopToken2(stopTokenCheck)

  const evalColor = makeColorEvaluator(color, pluginManager.jexl)

  const n = features.length
  const positions = new Uint32Array(n)
  const scores = new Float32Array(n)
  const colors = new Uint32Array(n)
  let scoreMin = Infinity
  let scoreMax = -Infinity
  let scoreSum = 0
  let scoreSumSq = 0

  for (let i = 0; i < n; i++) {
    const f = features[i]!
    positions[i] = f.get('start') | 0
    const score = f.get('score') as number
    scores[i] = score
    if (score < scoreMin) {
      scoreMin = score
    }
    if (score > scoreMax) {
      scoreMax = score
    }
    scoreSum += score
    scoreSumSq += score * score
    colors[i] = evalColor(f)
  }

  const result: ManhattanRpcResult = {
    positions,
    scores,
    colors,
    numFeatures: n,
    scoreMin: n === 0 ? 0 : scoreMin,
    scoreMax: n === 0 ? 0 : scoreMax,
    scoreSum,
    scoreSumSq,
  }
  return rpcResult(result, [
    positions.buffer,
    scores.buffer,
    colors.buffer,
  ]) as unknown as ManhattanRpcResult
}
