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
    featuresArray = featuresArray.filter(f =>
      ['gene', 'mRNA', 'transcript', 'CDS'].includes(f.get('type') ?? ''),
    )
  }

  if (maxFeatureDensity !== undefined && requestedBpPerPx) {
    const regionWidthPx = (region.end - region.start) / requestedBpPerPx
    const featureDensity = featuresArray.length / regionWidthPx
    if (featureDensity > maxFeatureDensity) {
      return {
        regionTooLarge: true,
        featureCount: featuresArray.length,
      }
    }
  }

  const regionStart = Math.floor(region.start)
  const regionWidth = Math.ceil(region.end - region.start)

  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id)) {
      features.set(id, f)
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
        regionStart,
        regionWidth,
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
