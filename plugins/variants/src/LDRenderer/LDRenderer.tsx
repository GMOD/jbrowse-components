import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'

import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
} from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized as ServerSideRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

export interface RenderArgsDeserialized extends ServerSideRenderArgsDeserialized {
  regions: Region[]
  bpPerPx: number
  highResolutionScaling: number
  adapterConfig: AnyConfigurationModel
  displayHeight?: number
  lineZoneHeight?: number
  ldMetric?: LDMetric
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter?: number
  hweFilterThreshold?: number
  colorScheme?: string
  fitToHeight?: boolean
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
      lineZoneHeight = 20,
      fitToHeight = false,
    } = renderProps

    // Calculate total width across all regions (like HiC)
    let totalWidthBp = 0
    for (const region of regions) {
      totalWidthBp += region.end - region.start
    }
    const width = totalWidthBp / bpPerPx
    const hyp = width / 2
    // When fitToHeight is false, use natural triangle height (hyp + lineZoneHeight)
    // When true, use the provided displayHeight
    const height = fitToHeight
      ? (displayHeight ?? hyp + lineZoneHeight)
      : hyp + lineZoneHeight
    const matrixHeight = height - lineZoneHeight

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
    const yScalar = fitToHeight ? matrixHeight / Math.max(matrixHeight, hyp) : 1

    const { makeImageData } = await import('./makeImageData.ts')

    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx => {
        // Translate down past the line zone, then draw the matrix
        // Lines are drawn separately as SVG in the display component
        ctx.translate(0, lineZoneHeight)

        return makeImageData(ctx, {
          ldData,
          regions,
          bpPerPx,
          stopToken: renderProps.stopToken,
          yScalar,
        })
      },
    )

    const serialized = {
      ...res,
      height,
      width,
      yScalar,
      ldMetric,
      lineZoneHeight,
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
      stopToken,
    } = args

    try {
      // Check if this is a PlinkLDAdapter (pre-computed LD)
      const adapterType = adapterConfig?.type as string | undefined
      if (adapterType === 'PlinkLDAdapter') {
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
          stopToken,
        },
      })
    } catch (e) {
      console.error('Error computing LD matrix:', e)
      return null
    }
  }
}
