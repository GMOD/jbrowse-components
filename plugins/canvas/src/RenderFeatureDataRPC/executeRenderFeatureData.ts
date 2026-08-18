import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { measureRegionBytes } from './byteGate.ts'
import { collectRenderData } from './collectRenderData.ts'
import { dedupeFeaturesById } from './dedupeFeatures.ts'
import {
  exactDensityTooLargeResult,
  samplePreFetchDensity,
} from './densityGate.ts'
import { buildFeatureAdmission } from './featureAdmission.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { summarizeIsoformPicks } from './isoformPicks.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type { FeatureDataResult } from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
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
    maxFeatureDensity,
    byteLimit,
    theme: themeOptions,
    stopToken,
    statusCallback,
  } = args

  // Resolve the colors worker-side from the structurally serializable args the
  // display passes via rpcProps. This is plain data in and plain data out, so
  // no Material UI reaches the worker. When absent (e.g. a session without
  // theming), this returns the default palette.
  const palette = resolvePalette(themeOptions)

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

  const layouts = await withProgress(
    {
      label: 'Computing layout',
      total: features.size,
      statusCallback,
      stopToken,
    },
    report => {
      const records: FeatureLayout[] = []
      for (const feature of features.values()) {
        report()
        records.push(
          findGlyph(
            feature,
            displayConfig,
          )({
            feature,
            config: displayConfig,
            // for the one layout-time per-feature callback slot, `featureHeight`
            jexl: pluginManager.jexl,
          }),
        )
      }
      return records
    },
  )
  checkStopTokenThrottled(stopTokenCheck)

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

  const packed = await updateStatus(
    'Collecting render data',
    statusCallback,
    () =>
      collectRenderData({
        layouts,
        regionStart: region.start,
        regionEnd: region.end,
        config: displayConfig,
        palette,
        colorByCDS: !!colorByCDS,
        peptideDataMap,
        jexl: pluginManager.jexl,
      }),
  )

  checkStopTokenThrottled(stopTokenCheck)

  const result: FeatureDataResult = {
    ...packed,
    featureCount: features.size,
    hasMultiIsoformGenes: layouts.some(layout => layout.hasMultipleIsoforms),
    isoformPicks: summarizeIsoformPicks(layouts),
    bytes,
  }

  // rpcResultWithArrayBuffers wraps value + auto-derived transferables; the RPC
  // framework unwraps it before returning to the caller. The caller-facing type
  // is the RpcRegistry `RenderFeatureData.return` ambient declaration (see
  // rpcTypes.ts), so this producer needs no return annotation or cast — matching
  // the too-large early returns above, which the framework passes through as-is.
  return rpcResultWithArrayBuffers(result)
}
