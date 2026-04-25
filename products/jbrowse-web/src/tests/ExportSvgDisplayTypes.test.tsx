import fs from 'fs'
import path from 'path'

import { createCanvas as nodeCreateCanvas } from 'canvas'
import { fireEvent } from '@testing-library/react'
import { saveAs } from 'file-saver-es'

import {
  createView,
  doBeforeEach,
  hts,
  setup,
} from './util.tsx'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]
const snapshotDir = path.join(path.dirname(module.filename), '__image_snapshots__')

function getSavedSvg(): string {
  // saveAs is mocked; Blob is mocked as (content, opts) => ({ content, opts })
  // so the saved blob is { content: [svgString], ... }
  const mock = saveAs as unknown as { mock: { calls: unknown[][] } }
  const blob = mock.mock.calls[0]![0] as { content: string[] }
  return blob.content[0]!
}

// node-canvas gives real PNG output instead of jsdom's empty "data:,"
const canvasFactory = nodeCreateCanvas as unknown as (
  w: number,
  h: number,
) => HTMLCanvasElement

// MST model identifiers (ElementId) use nanoid(10) and land in SVG clip-path
// IDs like `wiggle-clip-W5TXi8qP1v`. Replace every random 10-char suffix so
// snapshots are stable across runs.
function normalizeSvg(svg: string) {
  const seen = new Map<string, string>()
  let n = 0
  return svg.replace(/-[A-Za-z0-9_-]{10}(?=["|)])/g, m => {
    if (!seen.has(m)) {
      seen.set(m, `-stable${++n}`)
    }
    return seen.get(m)!
  })
}

test('wiggle display SVG vector export', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), ...opts))
  await findByTestId('wiggle-display-done', ...opts)

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/wiggle_vector_snapshot.svg`, svg)
  expect(normalizeSvg(svg)).toMatchSnapshot()
}, 45000)

test('wiggle display SVG rasterized export embeds PNG', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), ...opts))
  await findByTestId('wiggle-display-done', ...opts)

  await view.exportSvg({ rasterizeLayers: true, createCanvas: canvasFactory })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/wiggle_rasterized_snapshot.svg`, svg)
  expect(svg).toContain('<image')
  expect(svg).toContain('data:image/png;base64,iVBOR')
}, 45000)

test('canvas feature display SVG vector export', async () => {
  const { view, findByTestId } = await createView()
  await view.navToLocString('ctgA:1..5000')
  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))
  await findByTestId(/^display-.*-done$/, ...opts)

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/canvas_feature_vector_snapshot.svg`, svg)
  expect(normalizeSvg(svg)).toMatchSnapshot()
}, 45000)

test('canvas feature display SVG rasterized export embeds PNG', async () => {
  const { view, findByTestId } = await createView()
  await view.navToLocString('ctgA:1..5000')
  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))
  await findByTestId(/^display-.*-done$/, ...opts)

  await view.exportSvg({ rasterizeLayers: true, createCanvas: canvasFactory })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/canvas_feature_rasterized_snapshot.svg`, svg)
  expect(svg).toContain('<image')
  expect(svg).toContain('data:image/png;base64,iVBOR')
}, 45000)

test('alignments display SVG rasterized export embeds PNG', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )
  await findByTestId('pileup-display-done', ...opts)

  await view.exportSvg({ rasterizeLayers: true, createCanvas: canvasFactory })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/alignments_rasterized_snapshot.svg`, svg)
  expect(svg).toContain('<image')
  expect(svg).toContain('data:image/png;base64,iVBOR')
}, 45000)
