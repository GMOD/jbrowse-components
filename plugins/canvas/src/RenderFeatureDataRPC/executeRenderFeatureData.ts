import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { buildFeatureRenderData } from './buildFeatureRenderData.ts'
import { dedupeFeaturesById } from './dedupeFeatures.ts'
import {
  exactDensityTooLargeResult,
  samplePreFetchDensity,
} from './densityGate.ts'
import { buildFeatureAdmission } from './featureAdmission.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type { FeatureDataResult } from './rpcTypes.ts'
import type { PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeRenderFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderFeatureData'>
}) {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx: requestedBpPerPx,
    colorByCDS,
    showAminoAcids,
    geneticCodeId,
    sequenceAdapter,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
    expandedGeneIds,
    maxFeatureDensity,
    byteLimit,
    stopToken,
    statusCallback,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
  })

  // Stage 1: index-only byte estimate. An adapter with no index estimate
  // reports none and falls through to the density gate.
  const { bytes, tooLarge: tooManyBytes } = await measureRegionBytes({
    dataAdapter,
    regions: [region],
    byteLimit,
    stopToken,
    statusCallback,
    stopTokenCheck,
  })
  if (tooManyBytes) {
    return tooManyBytes
  }

  // Both density gates and the layout pass use this one admission, so the
  // pre-fetch estimate cannot disagree with the exact post-fetch count.
  const admit = buildFeatureAdmission({
    config: displayConfig,
    jexl: pluginManager.jexl,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
  })

  // Stage 1.5: estimate density from a small sample before downloading the
  // whole region. The model leaves `maxFeatureDensity` undefined for a small or
  // force-loaded render, which skips this; the post-fetch count is the backstop.
  if (maxFeatureDensity !== undefined) {
    const tooLarge = await samplePreFetchDensity({
      dataAdapter,
      region,
      bpPerPx: requestedBpPerPx,
      maxFeatureDensity,
      bytes,
      admit,
      stopToken,
      statusCallback,
      stopTokenCheck,
    })
    if (tooLarge) {
      return tooLarge
    }
  }

  // The adapter's own statusCallback + stopToken make a long fetch
  // interruptible mid-flight, not just at the checkStopTokenThrottled below.
  const featuresArray = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopTokenThrottled(stopTokenCheck)

  // Admission runs inside the dedup, ahead of density-gating, so filtered-out
  // features neither count toward density nor reach layout.
  const features = dedupeFeaturesById(featuresArray, admit)

  // Stage 2: the exact count.
  const tooManyFeatures = exactDensityTooLargeResult(
    features.size,
    region,
    requestedBpPerPx,
    maxFeatureDensity,
    bytes,
  )
  if (tooManyFeatures) {
    return tooManyFeatures
  }

  // A Set once per region rather than per gene: `layoutSubfeatures` asks for
  // every container feature it lays out.
  const expandedGenes = expandedGeneIds && new Set(expandedGeneIds)

  let peptideDataMap: Map<string, PeptideData> | undefined
  if (
    showAminoAcids &&
    sequenceAdapter &&
    shouldRenderPeptideBackground(requestedBpPerPx)
  ) {
    peptideDataMap = await updateStatus(
      'Downloading peptide data',
      statusCallback,
      async () =>
        fetchPeptideData(
          pluginManager,
          {
            sessionId,
            sequenceAdapter,
            regions: [region],
          },
          features,
          geneticCodeId,
        ),
    )
  }

  checkStopTokenThrottled(stopTokenCheck)

  // One `withProgress` over the whole layout+collect pass: the collect is the
  // same walk again, so a second bar would make the first lie about finishing.
  const packed = await withProgress(
    {
      label: 'Computing layout',
      total: features.size,
      statusCallback,
      stopToken,
    },
    report =>
      buildFeatureRenderData({
        features: features.values(),
        featureCount: features.size,
        config: displayConfig,
        jexl: pluginManager.jexl,
        regionStart: region.start,
        regionEnd: region.end,
        colorByCDS: !!colorByCDS,
        expandedGeneIds: expandedGenes,
        peptideDataMap,
        report,
      }),
  )

  checkStopTokenThrottled(stopTokenCheck)

  const result: FeatureDataResult = { ...packed, bytes }

  // The RPC framework unwraps this before returning to the caller, whose type
  // comes from the RpcRegistry declaration rather than from an annotation here.
  return rpcResultWithArrayBuffers(result)
}
