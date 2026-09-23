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

// The volvox MultiWiggle's four BigWigs as the multi-row xyplot of ADR-126.
function config() {
  const base = volvoxConfigWithTracks(['volvox_microarray_multi'])
  const [track] = base.tracks
  return {
    ...base,
    tracks: [
      {
        ...track,
        trackId: 'multiwig_marks',
        name: 'multiwig_marks',
        category: [],
        displays: [
          {
            type: 'LinearMarkDisplay',
            displayId: 'multiwig_marks-marks',
            facet: 'source',
            marks: [{ mark: 'bar', encoding: { y: 'score' } }],
          },
        ],
      },
    ],
  }
}

interface MarkRowProbe {
  height: number
  rowCount: number
  facetLayout: {
    rowCount: number
    sections: {
      key: string
      label: string
      firstRow: number
      rowCount: number
    }[]
  }
  rpcDataMap: ReadonlyMap<
    number,
    { layers: { count: number; row?: Uint32Array }[] }
  >
  renderState: { canvasHeight: number; rowCount: number }
  valueScales: { height: number; offset: number; bandTops?: number[] }[]
}

const timeout = 20000

beforeEach(() => {
  doBeforeEach()
})

test('a multi-BigWig faceted by source bands the mark display one row per source, and the axis rules the canvas the bars draw on', async () => {
  const { view, findByTestId } = await createView(config())
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('multiwig_marks'), {}, { timeout }))
  await findDisplayPainted('mark-display', { timeout })

  const display = view.tracks[0]!.displays[0] as unknown as MarkRowProbe
  await waitFor(() => {
    expect(display.rpcDataMap.get(0)).toBeDefined()
  })

  const { sections } = display.facetLayout
  expect(sections).toEqual([
    { key: 'j1', label: 'source: j1', firstRow: 0, rowCount: 1 },
    { key: 'j2', label: 'source: j2', firstRow: 1, rowCount: 1 },
    { key: 'k3', label: 'source: k3', firstRow: 2, rowCount: 1 },
    { key: 'k4', label: 'source: k4', firstRow: 3, rowCount: 1 },
  ])

  const layer = display.rpcDataMap.get(0)!.layers[0]!
  const rows = layer.row!
  expect(layer.count).toBeGreaterThan(10)
  expect([...new Set(rows)].sort((a, b) => a - b)).toEqual(
    sections.map(s => s.firstRow),
  )
  const perRow = sections.map(
    s => [...rows].filter(r => r === s.firstRow).length,
  )
  expect(perRow.reduce((a, b) => a + b, 0)).toBe(layer.count)
  expect(Math.min(...perRow)).toBeGreaterThan(1000)

  const { canvasHeight, rowCount } = display.renderState
  expect(rowCount).toBe(sections.length)
  const rowHeight = Math.floor(canvasHeight / rowCount)
  const yTop = (display.height - canvasHeight) / 2
  const [axis] = display.valueScales
  expect(axis!.height).toBe(rowHeight)
  expect(axis!.bandTops).toEqual(
    sections.map(s => yTop + s.firstRow * rowHeight),
  )
}, 40000)
