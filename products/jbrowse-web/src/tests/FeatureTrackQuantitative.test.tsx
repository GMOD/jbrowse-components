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
// `thickEnd` column at 50001, so a non-default `scoreField` reaching the
// worker shows up as a y domain fifty times taller; `sample` names the
// mouse each row belongs to, which is what field coloring keys on.
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

test('a FeatureTrack offers the Manhattan display and paints it', async () => {
  const { track, display } = await openTrack(
    { type: 'LinearManhattanDisplay' },
    'manhattan-display',
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

test('a Manhattan scoreField plots another column as y', async () => {
  const { display } = await openTrack(
    { type: 'LinearManhattanDisplay', scoreField: 'thickEnd' },
    'manhattan-display',
  )
  await waitFor(() => {
    expect(display.domain?.[1]).toBeGreaterThanOrEqual(50001)
  })
  const scores = [...display.rpcDataMap.values()].flatMap(d =>
    Array.from(d.scores as Float32Array),
  )
  expect(scores).toContain(50001)
}, 30000)

test('Manhattan field coloring derives its key from the values the worker met', async () => {
  const { display, findByTestId } = await openTrack(
    { type: 'LinearManhattanDisplay', colorBy: 'field', colorField: 'sample' },
    'manhattan-display',
  )
  await waitFor(() => {
    expect(display.colorScales).toHaveLength(1)
  })
  const labels = display.colorScales[0].entries.map(
    (i: { label: string }) => i.label,
  )
  expect(labels).toEqual(expect.arrayContaining(['mom', 'dad', 'offspring01']))
  const legend = await findByTestId('floating-legend', {}, { timeout })
  expect(legend.textContent).toContain('sample')
  expect(legend.textContent).toContain('mom')
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

test('a wiggle scoreField reaches featuresToRaw', async () => {
  const { display } = await openTrack(
    { type: 'LinearWiggleDisplay', scoreField: 'thickEnd' },
    'wiggle-display',
  )
  await waitFor(() => {
    expect(display.domain?.[1]).toBeGreaterThanOrEqual(50001)
  })
}, 30000)
