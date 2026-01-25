import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'

import type { LDMatrixResult, LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized as ServerSideRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

export interface RenderArgsDeserialized extends ServerSideRenderArgsDeserialized {
  regions: Region[]
  bpPerPx: number
  highResolutionScaling: number
  adapterConfig: AnyConfigurationModel
  displayHeight?: number
  ldMetric?: LDMetric
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter?: number
  hweFilterThreshold?: number
  callRateFilter?: number
  jexlFilters?: string[]
  colorScheme?: string
  fitToHeight?: boolean
  useGenomicPositions?: boolean
  signedLD?: boolean
}

export interface RenderArgsDeserializedWithLDData extends RenderArgsDeserialized {
  ldData: LDMatrixResult
}

export default class LDRenderer extends ServerSideRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const {
      displayHeight,
      regions,
      bpPerPx,
      ldMetric = 'r2',
      fitToHeight = false,
      useGenomicPositions = false,
      signedLD = false,
    } = renderProps

    // Calculate total width across all regions (like HiC)
    let totalWidthBp = 0
    for (const region of regions) {
      totalWidthBp += region.end - region.start
    }
    const width = totalWidthBp / bpPerPx
    const hyp = width / 2
    // Canvas contains only the triangle
    // lineZoneHeight/recombinationZoneHeight are handled by CSS positioning
    // displayHeight already accounts for these when fitToHeight is true
    const height = fitToHeight ? (displayHeight ?? hyp) : hyp
    const matrixHeight = height

    // Get LD data
    const ldData = await this.getLDData(renderProps)

    if (!ldData || ldData.snps.length === 0) {
      // Return empty result
      const res = await renderToAbstractCanvas(
        width,
        height,
        renderProps,
        ctx => {
          ctx.fillStyle = '#666'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(
            'No variants in view (try adjusting MAF filter or zooming in)',
            width / 2,
            height / 2,
          )
          return undefined
        },
      )
      return rpcResult(
        {
          ...res,
          height,
          width,
          ldData: null,
          filterStats: ldData?.filterStats,
        },
        collectTransferables(res),
      )
    }

    // When fitToHeight is true, scale the triangle to fit the display height
    // When false, maintain true aspect ratio (yScalar = 1)
    const yScalar = fitToHeight ? matrixHeight / hyp : 1

    const { makeImageData } = await import('./makeImageData.ts')

    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx => {
        // Canvas contains only the triangle at y=0
        // lineZoneHeight positioning is handled by CSS in the display component
        return makeImageData(ctx, {
          ldData,
          regions,
          bpPerPx,
          stopTokenCheck: renderProps.stopTokenCheck,
          yScalar,
          useGenomicPositions,
          signedLD,
        })
      },
    )

    const serialized = {
      ...res,
      height,
      width,
      yScalar,
      ldMetric,
      signedLD,
      ldData: {
        snps: ldData.snps,
        metric: ldData.metric,
        numValues: ldData.ldValues.length,
      },
      filterStats: ldData.filterStats,
      recombination: {
        values: Array.from(ldData.recombination.values),
        positions: ldData.recombination.positions,
      },
    }
    return rpcResult(serialized, collectTransferables(serialized))
  }

  async getLDData(
    args: RenderArgsDeserialized,
  ): Promise<LDMatrixResult | null> {
    const {
      regions,
      sessionId,
      adapterConfig,
      bpPerPx,
      ldMetric = 'r2',
      minorAlleleFrequencyFilter = 0.01,
      lengthCutoffFilter = Number.MAX_SAFE_INTEGER,
      hweFilterThreshold = 0.001,
      callRateFilter = 0,
      jexlFilters = [],
      signedLD = false,
      stopTokenCheck,
    } = args

    try {
      // Check if this is a pre-computed LD adapter (PLINK or ldmat)
      const adapterType = adapterConfig.type as string | undefined
      if (
        adapterType === 'PlinkLDAdapter' ||
        adapterType === 'PlinkLDTabixAdapter' ||
        adapterType === 'LdmatAdapter'
      ) {
        return await getLDMatrixFromPlink({
          pluginManager: this.pluginManager,
          args: {
            regions,
            sessionId,
            adapterConfig,
            ldMetric,
          },
        })
      }

      // Otherwise compute LD from VCF genotypes
      return await getLDMatrix({
        pluginManager: this.pluginManager,
        args: {
          regions,
          sessionId,
          adapterConfig,
          bpPerPx,
          ldMetric,
          minorAlleleFrequencyFilter,
          lengthCutoffFilter,
          hweFilterThreshold,
          callRateFilter,
          jexlFilters,
          signedLD,
          stopTokenCheck,
        },
      })
    } catch (e) {
      console.error('Error computing LD matrix:', e)
      throw e
    }
  }
}
