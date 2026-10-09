import { SvgThemeProviders } from '@jbrowse/core/svg/SvgThemeProviders'
import { serializeSvg } from '@jbrowse/core/svg/serializeSvg'
import { awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
import { createSvgRasterCanvas } from '@jbrowse/core/util/createSvgRasterCanvas'

import { warpRing } from './warpRing.ts'

import type { ExportSvgOptions } from '../CircularView/model.ts'
import type { RingDisplay, RingHostModel } from './ringHost.ts'
import type { SvgRasterCanvasOpts } from '@jbrowse/core/util/createSvgRasterCanvas'
import type { ThemeOptions } from '@mui/material'
import type { ReactNode } from 'react'

type RingSvgDisplay = RingDisplay & {
  renderSvg?: (
    opts: ExportSvgOptions & {
      theme?: ThemeOptions
      rasterizeLayers?: boolean
      plotOnly?: boolean
    },
  ) => Promise<ReactNode>
}

export interface RingBody {
  display: RingDisplay
  body: ReactNode
}

/**
 * Whether an SVG strip can be decoded into pixels to warp: through the
 * export's own `decodeSvg`, or the environment's `Image`. Node has no `Image`,
 * and jsdom's has no `decode`.
 */
export function canRasterizeRings(opts: SvgRasterCanvasOpts) {
  return (
    opts.decodeSvg !== undefined ||
    (typeof Image !== 'undefined' && 'decode' in Image.prototype)
  )
}

async function decodeSvg(markup: string, opts: SvgRasterCanvasOpts) {
  if (opts.decodeSvg) {
    return opts.decodeSvg(markup)
  }
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  await img.decode()
  return img
}

async function rasterize(
  markup: string,
  width: number,
  height: number,
  opts: SvgRasterCanvasOpts,
) {
  const img = await decodeSvg(markup, opts)
  const { canvas, ctx } = createSvgRasterCanvas(width, height, opts)
  ctx.drawImage(img, 0, 0, width, height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Every ring display's own SVG export, plot only. The first half of a ring
 * export, and the only half that waits on data, so the view fans it out beside
 * its chord renders and reads the figure geometry after both.
 */
export function renderRingBodies(
  host: RingHostModel,
  opts: ExportSvgOptions,
  theme: ThemeOptions | undefined,
) {
  const displays = host.ringDisplays as RingSvgDisplay[]
  return awaitSvgRenders(
    displays
      .filter(display => display.renderSvg)
      .map(async display => ({
        display,
        body: await display.renderSvg!({
          ...opts,
          theme,
          rasterizeLayers: opts.decodeSvg === undefined,
          plotOnly: true,
        }),
      })),
  )
}

/**
 * The rings of an export, as one raster: each body is rendered for its strip,
 * rasterized, and warped into its annulus by `warpRing` — the resampling the
 * screen's ring pass runs per fragment. An SVG has no polar transform, so the
 * alternative was re-tessellating every path of every display; the raster is
 * what the screen drew, and costs no display a line.
 *
 * The annuli and strip sizes are read here, after the bodies' waits, since a
 * display that grows to its data only reaches its height once they resolve.
 */
export async function paintRingsSvg(
  host: Pick<RingHostModel, 'rings' | 'width'>,
  bodies: RingBody[],
  opts: ExportSvgOptions & SvgRasterCanvasOpts,
  theme: ThemeOptions | undefined,
  figure: { size: number; center: number; offsetRadians: number },
) {
  const { rings, width } = host
  const drawn = rings.flatMap(ring => {
    const found = bodies.find(b => b.display === ring.display)
    return found ? [{ ring, body: found.body }] : []
  })
  if (drawn.length === 0) {
    return null
  }
  const { canvas, ctx } = createSvgRasterCanvas(figure.size, figure.size, opts)
  const scale = canvas.width / figure.size
  const pixels = ctx.createImageData(canvas.width, canvas.height)
  for (const { ring, body } of drawn) {
    const { height } = ring.display
    const markup = serializeSvg(
      <SvgThemeProviders theme={theme}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          width={width}
          height={height}
          fontFamily={opts.fontFamily || undefined}
        >
          {body}
        </svg>
      </SvgThemeProviders>,
    )
    warpRing(pixels, await rasterize(markup, width, height, opts), {
      centerX: figure.center * scale,
      centerY: figure.center * scale,
      innerPx: ring.innerPx * scale,
      outerPx: ring.outerPx * scale,
      offsetRadians: figure.offsetRadians,
    })
  }
  ctx.putImageData(pixels, 0, 0)
  return (
    <image
      width={figure.size}
      height={figure.size}
      xlinkHref={canvas.toDataURL('image/png')}
    />
  )
}
