import { createCanvas, loadImage } from 'canvas'

import { paintRingsSvg } from './ringSvg.tsx'

import type { RingDisplay } from './ringHost.ts'
import type { ReactElement } from 'react'

const createNodeCanvas = createCanvas as unknown as (
  width: number,
  height: number,
) => HTMLCanvasElement
const decodeSvg = async (markup: string) =>
  (await loadImage(Buffer.from(markup))) as unknown as CanvasImageSource

const display: RingDisplay = {
  id: 'ring',
  type: 'LinearWiggleDisplay',
  height: 50,
  paintCount: 1,
  painted: true,
  renderNow() {},
  configuration: { displayId: 'ring' },
  RenderingComponent: () => null,
}

test('an exported ring draws a translucent strip at its own alpha, inside its annulus only', async () => {
  const width = 2 * Math.PI * 200
  const image = (await paintRingsSvg(
    { rings: [{ display, innerPx: 150, outerPx: 200 }], width },
    [
      {
        display,
        body: (
          <rect width={width} height={50} fill="#0000ff" fillOpacity={0.5} />
        ),
      },
    ],
    { createCanvas: createNodeCanvas, decodeSvg },
    undefined,
    { size: 500, center: 250, offsetRadians: 0.3 },
  )) as ReactElement<{ xlinkHref: string }>
  const png = await loadImage(image.props.xlinkHref)
  const ctx = createCanvas(png.width, png.height).getContext('2d')
  ctx.drawImage(png, 0, 0)
  const { data, width: w } = ctx.getImageData(0, 0, png.width, png.height)
  const scale = w / 500
  const alphas = { inside: new Set<number>(), outside: new Set<number>() }
  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const r = Math.hypot(x + 0.5 - 250 * scale, y + 0.5 - 250 * scale) / scale
      const alpha = data[(y * w + x) * 4 + 3]!
      if (r > 151 && r < 199) {
        alphas.inside.add(alpha)
      } else if (r < 149 || r > 201) {
        alphas.outside.add(alpha)
      }
    }
  }
  expect([...alphas.inside].every(a => Math.abs(a - 128) <= 1)).toBe(true)
  expect([...alphas.outside]).toEqual([0])
})
