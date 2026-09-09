import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  colorEvaluator,
  encodeFeatures,
  encodedChannelTransferables,
} from '@jbrowse/core/util/markEncoding'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { isLDRecordSource } from '@jbrowse/ld-core'

import { buildLdToIndex } from './ldToIndex.ts'
import { makeLdEvaluator } from './makeLdEvaluator.ts'
import { defaultGlyph, ldColoringRequested } from './rpcTypes.ts'

import type { ManhattanRpcResult } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type {
  Feature,
  ProgressReporter,
  StatusCallback,
} from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { RpcResult } from '@jbrowse/core/util/librpc'
import type {
  ChannelReader,
  ColorEncoding,
} from '@jbrowse/core/util/markEncoding'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

// The channels a coloring mode reads off each feature — the colour as a
// declared encoding in field mode, a reader otherwise — and what LD mode ships
// beside them: `r2`, whose absence is what drops the r² array from the
// payload, and whether the index SNP was found.
export interface ManhattanReaders {
  color: ColorEncoding | ChannelReader<number>
  glyph: ChannelReader<number>
  r2?: ChannelReader<number>
  indexFound?: boolean
}

// LD coloring needs a mode, an index and an adapter to read r² from; with any
// of the three missing the worker falls back to the flat `color` config,
// which is also the whole of normal coloring mode. Field coloring needs only
// the mode: the values come off the features themselves.
async function makeReaders(
  args: Pick<
    RpcExecuteArgs<'GetManhattanData'>,
    | 'sessionId'
    | 'region'
    | 'color'
    | 'colorBy'
    | 'colorField'
    | 'indexSnp'
    | 'ldAdapterConfig'
    | 'ldRefName'
  > & {
    pluginManager: PluginManager
    statusCallback: StatusCallback | undefined
    stopTokenCheck: StopTokenChecker
  },
): Promise<ManhattanReaders> {
  const { pluginManager, sessionId, region, color, statusCallback } = args
  // The same predicate `GetManhattanData.serializeArguments` resolves
  // `ldRefName` under. Kept as one call rather than a restated condition: if
  // this side said yes where that side said no, the LD read would run with no
  // `ldRefName` and query the PLINK file under the GWAS file's name.
  if (ldColoringRequested(args)) {
    const { indexSnp, ldAdapterConfig, ldRefName, stopTokenCheck } = args
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
      buildLdToIndex({ adapter: ldAdapter, region, ldRefName, indexSnp }),
    )
    checkStopTokenThrottled(stopTokenCheck)
    return {
      ...makeLdEvaluator(ld, indexSnp, region.refName),
      indexFound: ld.indexFound,
    }
  } else if (args.colorBy === 'field') {
    return {
      color: { field: args.colorField, scale: 'categorical' },
      glyph: defaultGlyph,
    }
  } else {
    return {
      color: colorEvaluator(color, pluginManager.jexl),
      glyph: defaultGlyph,
    }
  }
}

// The LD r² channel the encoder does not carry, read over the features it
// admitted: `featureIndex[i]` is instance `i`'s feature, so the array lands
// index-aligned with the rest of the payload.
function r2Channel(
  features: readonly Feature[],
  featureIndex: Uint32Array,
  readR2: ChannelReader<number>,
) {
  const r2s = new Float32Array(featureIndex.length)
  for (let i = 0; i < featureIndex.length; i++) {
    r2s[i] = readR2(features[featureIndex[i]!]!)
  }
  return r2s
}

// Pure: the encoder over `scoreField` with the mode's readers, plus what LD
// mode ships beside the channels. Unit-tested without the RPC plumbing.
export function buildManhattanResult(
  features: readonly Feature[],
  scoreField: string,
  { r2, indexFound, ...readers }: ManhattanReaders,
  ctx: { jexl: JexlInstance; report?: ProgressReporter },
): { result: ManhattanRpcResult; transferables: ArrayBufferLike[] } {
  const encoded = encodeFeatures(features, { y: scoreField, ...readers }, ctx)
  const r2s = r2 ? r2Channel(features, encoded.featureIndex, r2) : undefined
  return {
    result: { ...encoded, r2s, indexFound },
    transferables: [
      ...encodedChannelTransferables(encoded),
      ...(r2s ? [r2s.buffer] : []),
    ],
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
  args: RpcExecuteArgs<'GetManhattanData'>
}): Promise<RpcResult<ManhattanRpcResult>> {
  const {
    sessionId,
    adapterConfig,
    region,
    color,
    colorBy,
    colorField,
    scoreField,
    indexSnp,
    ldAdapterConfig,
    ldRefName,
    stopToken,
    statusCallback,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const features = await updateStatus(
    'Downloading GWAS data',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )

  checkStopTokenThrottled(stopTokenCheck)

  const readers = await makeReaders({
    pluginManager,
    sessionId,
    region,
    color,
    colorBy,
    colorField,
    indexSnp,
    ldAdapterConfig,
    ldRefName,
    statusCallback,
    stopTokenCheck,
  })

  const { result, transferables } = buildManhattanResult(
    features,
    scoreField,
    readers,
    {
      jexl: pluginManager.jexl,
      report: createProgressReporter({
        label: 'Processing GWAS features',
        total: features.length,
        statusCallback,
        stopTokenCheck,
      }),
    },
  )
  return rpcResult(result, transferables)
}
