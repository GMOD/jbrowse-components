import './svgExportMocks.ts'

import fs from 'node:fs'
import path from 'node:path'

import { fireEvent } from '@testing-library/react'
import { createCanvas as nodeCreateCanvas } from 'canvas'

import { createView, doBeforeEach, getSavedSvg, hts, setup } from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]
const snapshotDir = path.join(
  path.dirname(module.filename),
  '__image_snapshots__',
)

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
  return svg.replaceAll(/-[A-Za-z0-9_-]{10}(?=["|)])/g, m => {
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

test('alignments display SVG vector export', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )
  await findByTestId('pileup-display-done', ...opts)

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/alignments_vector_snapshot.svg`, svg)
  expect(svg).toContain('<svg')
  // SvgCanvas paths emit as <g>/<path>; rasterized path would emit <image>.
  expect(svg).not.toContain('<image')
}, 45000)

test('refName label stays on-canvas when zoomed into a chromosome interior', async () => {
  const { view, findByTestId } = await createView()
  // deep inside ctgA, so the region's left edge has scrolled off the left of
  // the viewport — the sticky refName label must pin to x=0, not render at the
  // (far off-canvas) block start
  await view.navToLocString('ctgA:30000..40000')
  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))
  await findByTestId(/^display-.*-done$/, ...opts)

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  const sticky = /<text x="0"[^>]*font-weight="bold"[^>]*>ctgA<\/text>/
  expect(svg).toMatch(sticky)
}, 45000)

test('arc display SVG export renders bezier arcs for BND variants', async () => {
  const { view, findByTestId, findByText } = await createView()
  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  // switch to the paired-arc display type
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText('Variant display arcs', ...opts))

  await findByTestId('arc-display-done', ...opts)

  // renderArcSvg awaits model.svgReady (via awaitSvgReady) internally
  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  fs.writeFileSync(`${snapshotDir}/arc_sv_snapshot.svg`, svg)
  // BND arcs are rendered as SVG bezier cubic paths
  expect(svg).toContain(' C ')
  expect(normalizeSvg(svg)).toMatchSnapshot()
}, 45000)

// These two assert-only tests live at the end of the file on purpose: the
// `@jbrowse/svgcanvas` clip-id counter is a module global that increments per
// export and isn't covered by normalizeSvg, so inserting a snapshot-affecting
// test earlier would renumber every later snapshot's `svgcanvas-clip-N`.

test('wiggle SVG export includes cross-hatches when enabled', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), ...opts))
  await findByTestId('wiggle-display-done', ...opts)

  const display = view.tracks[0]!.displays[0] as {
    toggleCrossHatches: () => void
  }
  display.toggleCrossHatches()

  await view.exportSvg({ rasterizeLayers: false })
  // CrossHatchLines draws a guide line at each Y-scale tick. Its opacity is a
  // separate stroke-opacity attribute (not baked into rgba) so it survives the
  // export, which strips rgba() alpha.
  const svg = getSavedSvg()
  expect(svg).toContain('stroke="rgb(200,200,200)"')
  expect(svg).toContain('stroke-opacity="0.8"')
}, 45000)

test('multi-wiggle SVG export includes row separators and cross-hatches when enabled', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  await findByTestId('multi-wiggle-display-done', ...opts)

  const display = view.tracks[0]!.displays[0] as {
    toggleCrossHatches: () => void
    setShowRowSeparators: (arg: boolean) => void
  }
  display.toggleCrossHatches()
  display.setShowRowSeparators(true)

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()
  // inter-row separators: theme divider hue with its alpha split onto a
  // stroke-opacity attribute by getStrokeProps (colord quantizes to n/255, so
  // ~0.15 renders as 0.149). No other exported element pairs #000000 with a
  // sub-1 stroke-opacity, so this uniquely identifies the separators.
  expect(svg).toMatch(/stroke-opacity="0\.1\d+" stroke="#000000"/)
  expect(svg).toContain('stroke="rgb(200,200,200)"') // cross-hatches
  expect(svg).toContain('stroke-opacity="0.8"')
}, 45000)

// x of each ruler coordinate label. The ruler clip group holds only the tick
// path and these labels (no nested <g>), so a non-greedy match scopes cleanly to
// it and can't pick up the scalebar or overview labels.
function rulerLabelXs(svg: string) {
  const ruler = /<g clip-path="url\(#ruler-clip-[^)]*\)">(.*?)<\/g>/.exec(svg)
  return [...ruler![1]!.matchAll(/<text x="([\d.-]+)"/g)].map(m => Number(m[1]))
}

test('SVG export labels ruler coordinates when many regions are visible', async () => {
  const { view } = await createView()
  // Six visible regions. The export used to suppress every coordinate label
  // once five or more content blocks were in view, though the on-screen
  // scalebar labels them regardless — labelFitsInBlock already drops the ones a
  // narrow region can't fit.
  view.setDisplayedRegions(
    Array.from({ length: 6 }, (_, i) => ({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: i * 8000,
      end: i * 8000 + 8000,
    })),
  )
  view.showAllRegions()
  expect(view.dynamicBlocks.contentBlocks.length).toBeGreaterThanOrEqual(5)

  await view.exportSvg({ rasterizeLayers: false })
  expect(rulerLabelXs(getSavedSvg()).length).toBeGreaterThan(0)
}, 45000)
