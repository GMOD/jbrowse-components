import './svgExportMocks.ts'

import fs from 'node:fs'
import path from 'node:path'

import { userEvent } from '@testing-library/user-event'

import {
  canvasToBuffer,
  createView,
  doBeforeEach,
  findCanvasIn,
  getSavedSvg,
  hts,
  setup,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const timeout = 100000
const outDir = path.join(path.dirname(module.filename), '__overlap_demo__')

async function renderLinkedOverlap(name: string, loc: string, track: string) {
  const user = userEvent.setup()
  const { view, findByTestId, findByText } = await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Read connections'))
  await user.click(
    await findByText('View as pairs / link supplementary alignments'),
  )

  // Bump feature height so the overlap tint is clearly visible.
  const display = view.tracks[0].displays[0]
  display.setFeatureHeight(14)

  const el = await findByTestId('pileup-display-done', ...opts)
  await new Promise(res => setTimeout(res, 2000))

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    path.join(outDir, `${name}.png`),
    canvasToBuffer(findCanvasIn(el)),
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
