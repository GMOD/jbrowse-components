import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { Canvas2DHicRenderer } from './components/Canvas2DHicRenderer.ts'
import HicSVGColorLegend from './components/HicSVGColorLegend.tsx'
import {
  generateColorRamp,
  lookupColorRampCSS,
  mapHicCount,
} from './components/colorRamp.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  await when(() => self.rpcData != null || !!self.error || self.regionTooLarge)
  const { rpcData, useLogScale, colorScheme, showLegend, yScalar } = self
  if (!rpcData || rpcData.numContacts === 0) {
    return null
  }

  const { positions, counts, numContacts, colorMaxScore, binWidth } = rpcData
  const height = opts.overrideHeight ?? self.height
  const visibleWidth = view.width

  const ramp = generateColorRamp(colorScheme)
  const rasterize = opts.rasterizeLayers
  const clipId = `clip-${self.id}-svg`

  let matrixEl: React.ReactNode

  if (rasterize) {
    const scale = 2
    const canvas =
      opts.createCanvas?.(
        Math.round(visibleWidth * scale),
        Math.round(height * scale),
      ) ?? document.createElement('canvas')
    canvas.width = Math.round(visibleWidth * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.save()
      ctx.scale(1, yScalar)
      ctx.rotate(-Math.PI / 4)

      for (let i = 0; i < numContacts; i++) {
        const px = positions[i * 2]!
        const py = positions[i * 2 + 1]!
        const count = counts[i]!
        const t = mapHicCount(count, colorMaxScore, useLogScale)
        ctx.fillStyle = lookupColorRampCSS(ramp, t)
        ctx.fillRect(px, py, binWidth, binWidth)
      }
      ctx.restore()
    }
    matrixEl = (
      <image
        x={0}
        y={0}
        width={visibleWidth}
        height={height}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  } else {
    const svgCtx = new SvgCanvas()
    const renderer = new Canvas2DHicRenderer(svgCtx)
    renderer.uploadData({ positions, counts, numContacts })
    renderer.uploadColorRamp(ramp)
    renderer.render({
      binWidth,
      yScalar,
      canvasWidth: visibleWidth,
      canvasHeight: height,
      colorMaxScore,
      useLogScale,
      viewScale: 1,
      viewOffsetX: 0,
    })
    matrixEl = (
      <g dangerouslySetInnerHTML={{ __html: svgCtx.getSerializedSvg() }} />
    )
  }

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{matrixEl}</g>
      {showLegend && colorMaxScore > 0 ? (
        <HicSVGColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
