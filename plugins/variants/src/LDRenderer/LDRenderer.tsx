import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'

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
  lineZoneHeight?: number
  ldMetric?: LDMetric
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter?: number
  colorScheme?: string
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
      lineZoneHeight = 30,
    } = renderProps

    // Calculate total width across all regions
    let totalWidthBp = 0
    for (const region of regions) {
      totalWidthBp += region.end - region.start
    }
    const width = totalWidthBp / bpPerPx
    const hyp = width / 2
    const height = displayHeight ?? hyp + lineZoneHeight
    const matrixHeight = height - lineZoneHeight

    // Get LD data
    const ldData = await this.getLDData(renderProps)

    if (!ldData || ldData.snps.length === 0) {
      // Return empty result
      const res = await renderToAbstractCanvas(width, height, renderProps, ctx => {
        ctx.fillStyle = '#666'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          'No variants in view (try adjusting MAF filter or zooming in)',
          width / 2,
          height / 2,
        )
        return undefined
      })
      return rpcResult(
        { ...res, height, width, ldData: null },
        collectTransferables(res),
      )
    }

    const yScalar = matrixHeight / Math.max(matrixHeight, hyp)

    const { makeImageData, drawConnectingLines } = await import('./makeImageData.ts')

    const res = await renderToAbstractCanvas(width, height, renderProps, ctx => {
      // Draw connecting lines first (in the line zone area)
      const region = regions[0]
      if (region) {
        drawConnectingLines(ctx, {
          snps: ldData.snps,
          region,
          bpPerPx,
          lineZoneHeight,
          totalWidthPx: width,
        })
      }

      // Translate down past the line zone, then draw the matrix
      ctx.translate(0, lineZoneHeight)

      return makeImageData(ctx, {
        ldData,
        regions,
        bpPerPx,
        stopToken: renderProps.stopToken,
        yScalar,
      })
    })

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
    }
    return rpcResult(serialized, collectTransferables(serialized))
  }

  async getLDData(args: RenderArgsDeserialized): Promise<LDMatrixResult | null> {
    const {
      regions,
      sessionId,
      adapterConfig,
      bpPerPx,
      ldMetric = 'r2',
      minorAlleleFrequencyFilter = 0.01,
      lengthCutoffFilter = Number.MAX_SAFE_INTEGER,
      stopToken,
    } = args

    try {
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
          stopToken,
        },
      })
    } catch (e) {
      console.error('Error computing LD matrix:', e)
      return null
    }
  }
}
