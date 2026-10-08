import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const timeout = 20000

// A plain FeatureTrack over a BedTabixAdapter, told to draw as one of the
// quantitative displays. This file's `score` tops out at 1000 and its
// `thickEnd` column at 50001, so a non-default `y` field reaching the
// worker shows up as a y domain fifty times taller.
const TRACK = 'volvox_mouse_inheritance_painting'

function config(display: Record<string, unknown>) {
  const base = volvoxConfigWithTracks([TRACK])
  return {
    ...base,
    tracks: base.tracks.map(t => ({ ...t, displays: [display] })),
  }
}

async function openTrack(display: Record<string, unknown>, testid: string) {
  const result = await createView(config(display))
  const { view, findByTestId } = result
  view.setNewView(20, 0)
  fireEvent.click(await findByTestId(hts(TRACK), {}, { timeout }))
  const el = await findDisplayPainted(testid, { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const track = view.tracks[0]!
  return { ...result, track, display: track.displays[0]! }
}

beforeEach(() => {
  doBeforeEach()
})

const points = (encoding: Record<string, unknown>) => ({
  type: 'LinearManhattanDisplay',
  marks: [{ mark: 'point', encoding }],
})

test('a FeatureTrack offers the Manhattan display and paints it', async () => {
  const { track, display } = await openTrack(
    { type: 'LinearManhattanDisplay' },
    'mark-display',
  )
  expect(
    track.compatibleDisplays.map((d: { type: string }) => d.type),
  ).toContain('LinearManhattanDisplay')
  expect(display.type).toBe('LinearManhattanDisplay')
  await waitFor(() => {
    expect(display.domain).toBeDefined()
  })
  expect(display.domain[1]).toBeLessThanOrEqual(1000)
}, 30000)

test('a Manhattan point mark plots another column as y', async () => {
  const { display } = await openTrack(points({ y: 'thickEnd' }), 'mark-display')
  await waitFor(() => {
    expect(display.domain?.[1]).toBeGreaterThanOrEqual(50001)
  })
  const scores = [...display.rpcDataMap.values()].flatMap(d =>
    Array.from(d.layers[0].y),
  )
  expect(scores).toContain(50001)
}, 30000)

test('a Manhattan y naming no column says so in the corner', async () => {
  const { display, findByTestId } = await openTrack(
    points({ y: 'pvalue' }),
    'mark-display',
  )
  const chip = await findByTestId('track-control-filter', {}, { timeout })
  expect(chip.textContent).toContain('skipped')
  expect(chip.getAttribute('aria-label')).toMatch(
    /^\d+ of \d+ features skipped: `pvalue` missing or not a number$/,
  )
  expect(display.skippedFeatures.skipped).toBe(display.skippedFeatures.total)
}, 30000)

test('a Manhattan colored by chromosome keys each contig', async () => {
  const base = volvoxConfigWithTracks(['volvox_gwas'])
  const { view, findByTestId } = await createView({
    ...base,
    tracks: base.tracks.map(t => ({
      ...t,
      displays: [
        {
          type: 'LinearManhattanDisplay',
          marks: [
            {
              mark: 'point',
              encoding: { y: 'score', color: { field: 'refName' } },
            },
          ],
        },
      ],
    })),
  })
  await view.navToLocString('ctgA ctgB')
  fireEvent.click(await findByTestId(hts('volvox_gwas'), {}, { timeout }))
  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = view.tracks[0]!.displays[0]!
  await waitFor(
    () => {
      expect(display.colorScales).toHaveLength(1)
    },
    { timeout },
  )
  const legend = await findByTestId('floating-legend', {}, { timeout })
  expect(legend.textContent).toContain('ctgA')
  expect(legend.textContent).toContain('ctgB')
}, 30000)

test('a FeatureTrack paints the wiggle display', async () => {
  const { display } = await openTrack(
    { type: 'LinearWiggleDisplay' },
    'wiggle-display',
  )
  await waitFor(() => {
    expect(display.domain).toBeDefined()
  })
  expect(display.domain[1]).toBeLessThanOrEqual(1000)
}, 30000)

test('a wiggle y field reaches featuresToRaw', async () => {
  const { display } = await openTrack(
    { type: 'LinearWiggleDisplay', y: 'thickEnd' },
    'wiggle-display',
  )
  await waitFor(() => {
    expect(display.domain?.[1]).toBeGreaterThanOrEqual(50001)
  })
}, 30000)
