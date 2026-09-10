import './svgExportMocks.ts'

import { saveAs } from '@jbrowse/core/util'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  getSavedSvg,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

// The BED12 track, re-declared with a mark display in its config: the
// FeatureTrack and the BedTabixAdapter are the volvox config's own, and only
// the `displays` entry is this suite's.
function markTrackConfig(trackId: string, marks: unknown[]) {
  const base = volvoxConfigWithTracks(['bedtabix_genes'])
  return {
    ...base,
    tracks: base.tracks.map(t => ({
      ...t,
      trackId,
      name: trackId,
      displays: [
        { type: 'LinearMarkDisplay', displayId: `${trackId}-marks`, marks },
      ],
    })),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const timeout = 20000

test('bars from a BED score column, coloured by strand, with the key on screen', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_bars', [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'categorical' },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_bars'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('mark_bars-marks')
  // every feature in volvox-bed12 is on the + strand, so the categorical
  // table the worker resolved has the one entry
  const legend = await findByTestId('floating-legend', {}, { timeout })
  await waitFor(() => {
    expect(legend.textContent).toContain('1')
  })
}, 30000)

test('the SVG export paints the same bars and carries the key', async () => {
  const { view, findByTestId, findByText } = await createView(
    markTrackConfig('mark_bars', [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'categorical', palette: ['red'] },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_bars'), {}, { timeout }))
  await findDisplayPainted('mark-display', { timeout })

  fireEvent.click(await findByTestId('view_menu_icon', {}, { timeout }))
  fireEvent.click(await findByText('Export SVG', {}, { timeout }))
  fireEvent.click(await findByText('Submit', {}, { timeout }))
  await waitFor(
    () => {
      expect(saveAs).toHaveBeenCalled()
    },
    { timeout },
  )
  const svg = getSavedSvg()
  // the painter's bars: score 1000 tops the domain, so each is the full plot height, in the palette colour the worker packed
  expect(svg).toContain('height="140" fill="rgb(255,0,0)"')
  // the key, off the same table
  expect(svg).toContain('data-testid="color-legend"')
  expect(svg).toContain('>1<')
}, 40000)

test('points over the same file with a jexl colour', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_points', [
      {
        shape: 'point',
        encoding: {
          y: 'score',
          color: "jexl:get(feature,'name')=='EDEN.1'?'red':'blue'",
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_points'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('mark_points-marks')
  expect(el.dataset.displayDrawn).toBe('true')
}, 30000)

test('points with the glyph a scale over a field, and the key drawing each glyph', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_glyphs', [
      {
        shape: 'point',
        encoding: {
          y: 'score',
          glyph: {
            field: 'name',
            scale: 'categorical',
            domain: ['EDEN.1', 'EDEN.2'],
            range: ['triangle', 'diamond'],
          },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_glyphs'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  // the pinned domain's rows lead the key and the region's other name
  // follows, walking the range again; every swatch is the glyph itself
  const legend = await findByTestId('floating-legend', {}, { timeout })
  await waitFor(() => {
    expect(legend.textContent).toContain('EDEN.3')
  })
  expect(legend.textContent).not.toContain('(no value)')
  const paths = [...legend.querySelectorAll('path')].map(p =>
    p.getAttribute('d'),
  )
  expect(paths).toEqual([
    'M0 0L12 0L6 12Z',
    'M6 0L12 6L6 12L0 6Z',
    'M0 0L12 0L6 12Z',
  ])
}, 30000)

test('a y field naming no column is a skipped count in the corner, not an empty track', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_typo', [{ shape: 'bar', encoding: { y: 'scroe' } }]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_typo'), {}, { timeout }))

  const chip = await findByTestId('track-control-filter', {}, { timeout })
  expect(chip.getAttribute('aria-label')).toMatch(
    /^\d+ of \d+ features skipped: `scroe` missing or not a number$/,
  )
}, 30000)

test('spans stacked by a row channel band the plot by the highest row', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_rows', [
      {
        shape: 'span',
        encoding: {
          row: "jexl:get(feature,'name')=='EDEN.1'?0:1",
          color: { field: 'name', scale: 'categorical' },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_rows'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = view.tracks[0]!.displays[0] as { rowCount: number }
  await waitFor(() => {
    expect(display.rowCount).toBe(2)
  })
}, 30000)
