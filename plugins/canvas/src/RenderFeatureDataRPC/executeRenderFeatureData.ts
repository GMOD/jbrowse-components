import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { collectRenderData } from './collectRenderData.ts'
import { buildFeatureAdmission } from './featureAdmission.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type {
  FeatureDataResult,
  RenderFeatureDataArgs,
  RenderFeatureDataResult,
} from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

export async function executeRenderFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderFeatureDataArgs
}): Promise<RenderFeatureDataResult> {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx: requestedBpPerPx,
    colorByCDS,
    sequenceAdapter,
    showOnlyGenes,
    maxFeatureDensity,
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

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // pass statusCallback + stopToken so the adapter's own determinate download/
  // processing progress reaches the display (overriding the "Fetching features"
  // fallback label) and so a long fetch is interruptible mid-flight, not just at
  // the checkStopToken2 below
  const featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter
          .getFeatures(region, { statusCallback, stopToken })
          .pipe(toArray()),
      ),
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
  })
  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id) && admit(f)) {
      features.set(id, f)
    }
  }

  if (maxFeatureDensity !== undefined) {
    const regionWidthPx = (region.end - region.start) / requestedBpPerPx
    const featureDensity = features.size / regionWidthPx
    if (featureDensity > maxFeatureDensity) {
      return {
        regionTooLarge: true,
        featureCount: features.size,
      }
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
            jexl: pluginManager.jexl,
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
          displayConfig.transcriptTypes,
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

  const result: FeatureDataResult = { ...packed, featureCount: features.size }

  // Derive transferables from the result so new TypedArray fields don't
  // silently get cloned across the worker boundary just because someone
  // forgot to extend a hand-maintained list.
  const transferables = Object.values(result)
    .filter((v): v is ArrayBufferView => ArrayBuffer.isView(v))
    .map(v => v.buffer as ArrayBuffer)

  // rpcResult wraps value + transferables for the RPC framework, which
  // unwraps it before returning to the caller. The function signature
  // reflects the unwrapped type; the double-cast is necessary here.
  return rpcResult(result, transferables) as unknown as RenderFeatureDataResult
}
