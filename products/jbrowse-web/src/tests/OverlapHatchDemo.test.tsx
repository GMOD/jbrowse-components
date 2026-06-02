import fs from 'fs'
import path from 'path'

import { saveAs } from '@jbrowse/core/util'
import { userEvent } from '@testing-library/user-event'
import { createCanvas } from 'canvas'

import { createView, doBeforeEach, findCanvasIn, hts, setup } from './util.tsx'

import './svgExportMocks.ts'
jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const timeout = 100000
const outDir = path.join(path.dirname(module.filename), '__overlap_demo__')

// Flatten the rendered canvas onto white and return a PNG buffer (mirrors
// util.tsx canvasToBuffer, which isn't exported).
function canvasToPng(canvas: HTMLCanvasElement) {
  const { width, height } = canvas
  const src = canvas.getContext('2d')!.getImageData(0, 0, width, height)
  const flat = createCanvas(width, height)
  const ctx = flat.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const dst = ctx.getImageData(0, 0, width, height)
  const s = src.data
  const d = dst.data
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3]! / 255
    d[i] = Math.round(s[i]! * a + 255 * (1 - a))
    d[i + 1] = Math.round(s[i + 1]! * a + 255 * (1 - a))
    d[i + 2] = Math.round(s[i + 2]! * a + 255 * (1 - a))
    d[i + 3] = 255
  }
  ctx.putImageData(dst, 0, 0)
  return flat.toBuffer()
}

function getSavedSvg() {
  const mock = saveAs as unknown as { mock: { calls: unknown[][] } }
  const blob = mock.mock.calls[0]![0] as { content: string[] }
  return blob.content[0]!
}

async function renderLinkedOverlap(name: string, loc: string, track: string) {
  const user = userEvent.setup()
  const { view, findByTestId, findByText } = await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Read connections'))
  await user.click(await findByText('Link supplementary alignments'))

  // Bump feature height so the diagonal hatch is clearly visible.
  const display = view.tracks[0].displays[0]
  display.setFeatureHeight(14)

  const el = await findByTestId('pileup-display-done', ...opts)
  await new Promise(res => setTimeout(res, 2000))

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    path.join(outDir, `${name}.png`),
    canvasToPng(findCanvasIn(el)),
  )

  await view.exportSvg({ rasterizeLayers: false })
  fs.writeFileSync(path.join(outDir, `${name}.svg`), getSavedSvg())
}

test(
  'long-read SV linked reads (supplementary overlap)',
  async () => {
    await renderLinkedOverlap(
      'long-read-sv',
      'ctgA:1..20,000',
      'volvox-long-reads-sv-cram',
    )
  },
  timeout,
)

test(
  'short-read paired linked reads (mate overlap)',
  async () => {
    await renderLinkedOverlap(
      'short-read-paired',
      'ctgA:1..10,000',
      'volvox_sv_cram',
    )
  },
  timeout,
)
