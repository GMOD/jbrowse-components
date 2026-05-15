import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { ManhattanRpcResult, RenderManhattanDataArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function executeRenderManhattanData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderManhattanDataArgs
}) {
  const {
    sessionId,
    adapterConfig,
    region,
    stopToken,
    statusCallback = () => {},
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const featuresArray = await updateStatus(
    'Loading GWAS data',
    statusCallback,
    () => firstValueFrom(dataAdapter.getFeatures(region).pipe(toArray())),
  )

  checkStopToken2(stopTokenCheck)

  const n = featuresArray.length
  const positions = new Uint32Array(n)
  const scores = new Float32Array(n)
  let scoreMin = Infinity
  let scoreMax = -Infinity
  let scoreSum = 0
  let scoreSumSq = 0

  for (let i = 0; i < n; i++) {
    const f = featuresArray[i]!
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
  }

  const result: ManhattanRpcResult = {
    positions,
    scores,
    numFeatures: n,
    scoreMin: n === 0 ? 0 : scoreMin,
    scoreMax: n === 0 ? 0 : scoreMax,
    scoreSum,
    scoreSumSq,
  }

  return rpcResult(result, [positions.buffer, scores.buffer])
}
