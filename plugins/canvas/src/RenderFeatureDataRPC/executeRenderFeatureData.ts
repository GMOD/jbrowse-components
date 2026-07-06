import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { collectRenderData } from './collectRenderData.ts'
import {
  featuresPerPx,
  samplePreFetchDensity,
  tooManyFeaturesResult,
} from './densityGate.ts'
import { buildFeatureAdmission } from './featureAdmission.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type { FeatureDataResult, RenderFeatureDataArgs } from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export async function executeRenderFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderFeatureDataArgs
}) {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx: requestedBpPerPx,
    colorByCDS,
    geneticCodeId,
    sequenceAdapter,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
    maxFeatureDensity,
    byteSizeLimit,
    theme: themeOptions,
    stopToken,
    statusCallback = () => {},
  } = args

  // Build a full JBrowse theme worker-side from the structurally serializable
  // args the display passes via rpcProps — the created theme carries functions
  // and can't cross the worker boundary. When absent (e.g. a session without
  // theming), this returns the default theme.
  const theme = createJBrowseThemeFromArgs(themeOptions)

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // Stage 1 (cheap): index-only byte estimate, before any feature download. An
  // over-budget region short-circuits here, so a whole-genome fan-out never
  // pulls every chromosome's features just to reject them after. Adapters with
  // no index estimate return undefined and fall through to the density gate.
  let bytes: number | undefined
  if (byteSizeLimit !== undefined) {
    bytes = await dataAdapter.getRegionByteSize([region], {
      stopToken,
      statusCallback,
    })
    checkStopToken2(stopTokenCheck)
    if (bytes !== undefined && bytes > byteSizeLimit) {
      return { regionTooLarge: true, bytes }
    }
  }

  // Stage 1.5 (cheap): estimate feature density from a small sample before
  // downloading the whole region. Only runs when maxFeatureDensity is set — the
  // model leaves it undefined below AUTO_FORCE_LOAD_BP and when force-loaded, so
  // small/forced renders skip it. The post-fetch count below is the backstop.
  if (maxFeatureDensity !== undefined) {
    const tooLarge = await samplePreFetchDensity({
      dataAdapter,
      region,
      bpPerPx: requestedBpPerPx,
      maxFeatureDensity,
      bytes,
      stopToken,
      statusCallback,
      stopTokenCheck,
    })
    if (tooLarge) {
      return tooLarge
    }
  }

  // pass statusCallback + stopToken so the adapter's own determinate download/
  // processing progress reaches the display (overriding the "Fetching features"
  // fallback label) and so a long fetch is interruptible mid-flight, not just at
  // the checkStopToken2 below
  const featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopToken2(stopTokenCheck)

  // region.start / region.end are integer bp by contract — see
  // RenderFeatureDataArgs.region. No defensive rounding here.

  // Feature admission (config jexlFilters + showOnlyGenes) runs before dedup and
  // density-gating, so filtered-out features neither count toward density nor
  // reach layout. Dedup before density-gating: multiple adapter passes can yield
  // the same feature id, and the returned featureCount is the dedup'd size — the
  // gate must use the same count it reports so main-thread and worker decisions
  // stay in sync.
  const admit = buildFeatureAdmission({
    config: displayConfig,
    jexl: pluginManager.jexl,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
  })
  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id) && admit(f)) {
      features.set(id, f)
    }
  }

  if (maxFeatureDensity !== undefined) {
    const featureDensity = featuresPerPx(
      features.size,
      region,
      requestedBpPerPx,
    )
    if (featureDensity > maxFeatureDensity) {
      return tooManyFeaturesResult(features.size, bytes)
    }
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
          }),
        )
      }
      return records
    },
  )
  checkStopToken2(stopTokenCheck)

  let peptideDataMap: Map<string, PeptideData> | undefined
  if (
    colorByCDS &&
    sequenceAdapter &&
    shouldRenderPeptideBackground(requestedBpPerPx)
  ) {
    peptideDataMap = await updateStatus(
      'Fetching peptide data',
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

  checkStopToken2(stopTokenCheck)

  const packed = await updateStatus(
    'Collecting render data',
    statusCallback,
    () =>
      collectRenderData(
        layouts,
        region.start,
        region.end,
        displayConfig,
        theme,
        !!colorByCDS,
        peptideDataMap,
        pluginManager.jexl,
      ),
  )

  checkStopToken2(stopTokenCheck)

  const result: FeatureDataResult = {
    ...packed,
    featureCount: features.size,
    isoformsCollapsed: layouts.some(layout => layout.isoformsCollapsed),
    bytes,
  }

  // rpcResultWithArrayBuffers wraps value + auto-derived transferables; the RPC
  // framework unwraps it before returning to the caller. The caller-facing type
  // is the RpcRegistry `RenderFeatureData.return` ambient declaration (see
  // rpcTypes.ts), so this producer needs no return annotation or cast — matching
  // the too-large early returns above, which the framework passes through as-is.
  return rpcResultWithArrayBuffers(result)
}
