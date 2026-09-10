import { createSvgRasterCanvas } from '@jbrowse/core/util/createSvgRasterCanvas'
import { renderToStaticMarkup } from '@jbrowse/core/util/renderToStaticMarkup'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { ringShape } from './ringShape.ts'

import type { ExportSvgOptions } from '../CircularView/model.ts'
import type { RingHostModel } from './ringHost.ts'
import type { SvgRasterCanvasOpts } from '@jbrowse/core/util/createSvgRasterCanvas'
import type { ThemeOptions } from '@mui/material'
import type { ReactNode } from 'react'

interface RingSvgDisplay {
  renderSvg?: (
    opts: ExportSvgOptions & {
      theme?: ThemeOptions
      rasterizeLayers?: boolean
      plotOnly?: boolean
    },
  ) => Promise<ReactNode>
}

async function rasterize(
  markup: string,
  width: number,
  height: number,
  opts: SvgRasterCanvasOpts,
) {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  await img.decode()
  const { canvas, ctx } = createSvgRasterCanvas(width, height, opts)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

/**
 * The rings of an export, as one raster: every ring display's own SVG export
 * is rendered for its strip, rasterized, and warped into its annulus by the
 * Canvas2D ring painter — the same resampling the screen shows. An SVG has
 * no polar transform, so the alternative was re-tessellating every path of
 * every display; the raster is what the screen drew, and costs no display a
 * line.
 *
 * Nothing where the page cannot decode an image — a jsdom export — so the
 * chords and ruler still export there.
 */
export async function renderRingsSvg(
  host: RingHostModel,
  opts: ExportSvgOptions & SvgRasterCanvasOpts,
  theme: ThemeOptions | undefined,
  figure: { size: number; center: number; offsetRadians: number },
) {
  const { rings, width } = host
  if (rings.length === 0 || typeof Image === 'undefined') {
    return null
  }
  const { canvas, ctx } = createSvgRasterCanvas(figure.size, figure.size, opts)
  const shape = ringShape('ringExport')
  const block = canvasWideBlock(0, figure.size)
  const frame = { canvasWidth: figure.size, canvasHeight: figure.size }
  for (const ring of rings) {
    const display = ring.display as RingSvgDisplay
    if (!display.renderSvg) {
      continue
    }
    const { height } = ring.display
    const body = await display.renderSvg({
      ...opts,
      theme,
      rasterizeLayers: true,
      plotOnly: true,
    })
    const markup = renderToStaticMarkup(
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        width={width}
        height={height}
      >
        {body}
      </svg>,
    )
    let strip: HTMLCanvasElement
    try {
      strip = await rasterize(markup, width, height, opts)
    } catch {
      continue
    }
    shape.paintBlock(
      ctx,
      {
        innerPx: new Float32Array([ring.innerPx]),
        outerPx: new Float32Array([ring.outerPx]),
        count: 1,
      },
      block,
      frame,
      {
        centerX: figure.center,
        centerY: figure.center,
        offsetRadians: figure.offsetRadians,
        strip: { image: strip, width: strip.width, height: strip.height },
      },
    )
  }
  return (
    <image
      width={figure.size}
      height={figure.size}
      xlinkHref={canvas.toDataURL('image/png')}
    />
  )
}
