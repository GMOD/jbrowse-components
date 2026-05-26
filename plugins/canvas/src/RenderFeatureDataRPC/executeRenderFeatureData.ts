import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { collectRenderData } from './collectRenderData.ts'
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
  // ThemeOptions (same pattern as SVG export / ServerSideRendererType). Until
  // the canvas display wires `theme` into rpcProps, `themeOptions` is undefined
  // and createJBrowseTheme returns the default theme.
  const theme = createJBrowseTheme(themeOptions)

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  let featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () => firstValueFrom(dataAdapter.getFeatures(region).pipe(toArray())),
  )
  checkStopToken2(stopTokenCheck)

  if (showOnlyGenes) {
    const geneLikeTypes = new Set<string>([
      ...displayConfig.transcriptTypes,
      ...displayConfig.containerTypes,
      'gene',
      'pseudogene',
      'CDS',
    ])
    featuresArray = featuresArray.filter(f =>
      geneLikeTypes.has(f.get('type') ?? ''),
    )
  }

  // region.start / region.end are integer bp by contract — see
  // RenderFeatureDataArgs.region. No defensive rounding here.

  // Dedup before density-gating: multiple adapter passes can yield the same
  // feature id, and the returned featureCount is the dedup'd size — the gate
  // must use the same count it reports so main-thread and worker decisions stay
  // in sync.
  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id)) {
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

  const layouts = await updateStatus(
    'Computing layout',
    statusCallback,
    async () => {
      const reversed = region.reversed ?? false
      const records: FeatureLayout[] = []
      for (const feature of features.values()) {
        records.push(
          findGlyph(
            feature,
            displayConfig,
          )({ feature, reversed, config: displayConfig }),
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
      ),
  )

  checkStopToken2(stopTokenCheck)

  const result: FeatureDataResult = { ...packed, featureCount: features.size }

  const transferables = [
    result.rectPositions.buffer,
    result.rectYs.buffer,
    result.rectHeights.buffer,
    result.rectColors.buffer,
    result.rectFeatureIndices.buffer,
    result.linePositions.buffer,
    result.lineYs.buffer,
    result.lineColors.buffer,
    result.lineDirections.buffer,
    result.lineFeatureIndices.buffer,
    result.arrowXs.buffer,
    result.arrowYs.buffer,
    result.arrowDirections.buffer,
    result.arrowColors.buffer,
    result.arrowFeatureIndices.buffer,
  ] as ArrayBuffer[]

  // rpcResult wraps value + transferables for the RPC framework, which
  // unwraps it before returning to the caller. The function signature
  // reflects the unwrapped type; the double-cast is necessary here.
  return rpcResult(result, transferables) as unknown as RenderFeatureDataResult
}
