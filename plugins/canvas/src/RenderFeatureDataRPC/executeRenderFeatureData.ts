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

  // Stage 1 (cheap): index-only byte estimate, before any feature download.
  // Adapters with no index estimate report none and fall through to the density
  // gate below.
  const { bytes, tooLarge: tooManyBytes } = await measureRegionBytes({
    dataAdapter,
    region,
    byteLimit,
    stopToken,
    statusCallback,
    stopTokenCheck,
  })
  if (tooManyBytes) {
    return tooManyBytes
  }

  // Feature admission (config jexlFilters + showOnlyGenes + solo/hidden) is
  // built once here and used by both density gates and the layout pass below, so
  // "what gets drawn" has exactly one answer and the pre-fetch estimate can't
  // disagree with the exact post-fetch count.
  const admit = buildFeatureAdmission({
    config: displayConfig,
    jexl: pluginManager.jexl,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
  })

  // Stage 1.5 (cheap): estimate feature density from a small sample before
  // downloading the whole region. Only runs when maxFeatureDensity is set — the
  // model leaves it undefined below AUTO_FORCE_LOAD_BP (the floor's one
  // remaining job, `densityGateActive`) and when force-loaded, so small/forced
  // renders skip it. The post-fetch count below is the backstop.
  //
  // This deliberately runs even when a filter is active. It used to be skipped
  // whenever one was, because the sample counted the raw population and would
  // false-reject a filtered view that renders fine (showOnlyGenes at
  // whole-chromosome zoom over a dense GFF). That skip was inert anyway — back
  // then the `jexlFilters` slot shipped the NCBI gbkey=Src source-record filter
  // as its default, so every default-configured track took the skip and no
  // track ever sampled. Passing `admit` removes the reason for the skip instead
  // of the skip's trigger: the estimate now measures the admitted population.
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

  // pass statusCallback + stopToken so the adapter's own determinate download/
  // processing progress reaches the display (overriding the "Downloading features"
  // fallback label) and so a long fetch is interruptible mid-flight, not just at
  // the checkStopTokenThrottled below
  const featuresArray = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopTokenThrottled(stopTokenCheck)

  // region.start / region.end are integer bp by contract — see
  // RenderFeatureDataArgs.region. No defensive rounding here.

  // Admission (built above) runs inside the dedup, ahead of density-gating, so
  // filtered-out features neither count toward density nor reach layout — and
  // the returned featureCount is this map's size, so the gate uses the same
  // count it reports and main-thread and worker decisions stay in sync.
  const features = dedupeFeaturesById(featuresArray, admit)

  // Stage 2: the exact count, the backstop for the sampled estimate above.
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

  // One `withProgress` over the whole layout+collect pass, where the layout half
  // used to have its own: `buildFeatureRenderData` reports per feature and the
  // collect that follows is the same walk again, so a second determinate bar for
  // it only made the first one lie about being finished.
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

  // rpcResultWithArrayBuffers wraps value + auto-derived transferables; the RPC
  // framework unwraps it before returning to the caller. The caller-facing type
  // is the RpcRegistry `RenderFeatureData.return` ambient declaration (see
  // rpcTypes.ts), so this producer needs no return annotation or cast — matching
  // the too-large early returns above, which the framework passes through as-is.
  return rpcResultWithArrayBuffers(result)
}
