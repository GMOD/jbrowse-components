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

// The volvox microarray BigWig twice: the config's own QuantitativeTrack with
// its wiggle display, and the same track re-declared under a mark display.
function config(uri?: string) {
  const base = volvoxConfigWithTracks(['volvox_microarray'])
  const [original] = base.tracks
  const track = uri
    ? {
        ...original,
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: { uri, locationType: 'UriLocation' },
        },
      }
    : original
  return {
    ...base,
    tracks: [
      track,
      {
        ...track,
        trackId: 'microarray_marks',
        name: 'microarray_marks',
        displays: [
          {
            type: 'LinearMarkDisplay',
            displayId: 'microarray_marks-marks',
            marks: [{ shape: 'bar', encoding: { y: 'score' } }],
          },
        ],
      },
    ],
  }
}

interface WiggleProbe {
  rpcDataMap: ReadonlyMap<
    number,
    {
      sources: {
        numFeatures: number
        featurePositions: Uint32Array
        featureScores: Float32Array
      }[]
    }
  >
  isCacheValid: (idx: number) => boolean
  viewportWithinLoadedData: boolean
}

interface MarkProbe {
  rpcDataMap: ReadonlyMap<
    number,
    {
      layers: {
        count: number
        x: Uint32Array
        x2: Uint32Array
        y: Float32Array
      }[]
      zoomRange?: { minBpPerPx: number; maxBpPerPx: number }
    }
  >
  isCacheValid: (idx: number) => boolean
  viewportWithinLoadedData: boolean
}

const timeout = 20000

beforeEach(() => {
  doBeforeEach()
})

// Both displays fetch the BigWig at the view's bpPerPx, so they hold the same
// rows of the same tier (ADR-123, ADR-125), and a zoom inside the range the
// adapter declared refetches neither.
test('a mark display over a BigWig holds the rows the wiggle display holds, and neither refetches inside the tier', async () => {
  const { view, session, findByTestId } = await createView(config())
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout }))
  fireEvent.click(await findByTestId(hts('microarray_marks'), {}, { timeout }))
  await findDisplayPainted('wiggle-display', { timeout })
  await findDisplayPainted('mark-display', { timeout })

  const wiggle = view.tracks[0]!.displays[0] as unknown as WiggleProbe
  const marks = view.tracks[1]!.displays[0] as unknown as MarkProbe
  await waitFor(() => {
    expect(wiggle.rpcDataMap.get(0)).toBeDefined()
    expect(marks.rpcDataMap.get(0)).toBeDefined()
  })
  const source = wiggle.rpcDataMap.get(0)!.sources[0]!
  const layer = marks.rpcDataMap.get(0)!.layers[0]!
  expect(layer.count).toBe(source.numFeatures)
  expect(layer.count).toBeGreaterThan(10)
  for (let i = 0; i < layer.count; i++) {
    expect(layer.x[i]).toBe(source.featurePositions[i * 2])
    expect(layer.x2[i]).toBe(source.featurePositions[i * 2 + 1])
    expect(layer.y[i]).toBe(source.featureScores[i])
  }
  // the raw section of volvox_microarray.bw, under its 256bp synthetic tier
  expect(marks.rpcDataMap.get(0)!.zoomRange).toEqual({
    minBpPerPx: 0,
    maxBpPerPx: 128,
  })

  // A zoom in, so the viewport stays inside the loaded regions and only the
  // zoom rule could refetch
  const call = jest.spyOn(session.rpcManager, 'call')
  view.zoomTo(2.5)
  expect(wiggle.viewportWithinLoadedData).toBe(true)
  expect(marks.viewportWithinLoadedData).toBe(true)
  expect(wiggle.isCacheValid(0)).toBe(true)
  expect(marks.isCacheValid(0)).toBe(true)
  await new Promise(resolve => setTimeout(resolve, 1500))
  expect(
    call.mock.calls.filter(([, method]) =>
      ['RenderWiggleData', 'CoreEncodeFeatures'].includes(method),
    ),
  ).toHaveLength(0)
}, 40000)

// Between the raw section and the file's first level the adapter bins the raw
// records itself, so both displays hold the same bins. The 1bp coverage file's
// first level is 40bp, so 12 bp/px reads its 16bp synthetic tier.
test('a mark display and a wiggle display hold the same synthetic-tier bins', async () => {
  const { view, findByTestId } = await createView(
    config('volvox-sorted.bam.coverage.bw'),
  )
  view.setNewView(12, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout }))
  fireEvent.click(await findByTestId(hts('microarray_marks'), {}, { timeout }))
  await findDisplayPainted('wiggle-display', { timeout })
  await findDisplayPainted('mark-display', { timeout })

  const wiggle = view.tracks[0]!.displays[0] as unknown as WiggleProbe
  const marks = view.tracks[1]!.displays[0] as unknown as MarkProbe
  await waitFor(() => {
    expect(wiggle.rpcDataMap.get(0)).toBeDefined()
    expect(marks.rpcDataMap.get(0)).toBeDefined()
  })
  expect(marks.rpcDataMap.get(0)!.zoomRange).toEqual({
    minBpPerPx: 8,
    maxBpPerPx: 20,
  })
  const source = wiggle.rpcDataMap.get(0)!.sources[0]!
  const layer = marks.rpcDataMap.get(0)!.layers[0]!
  expect(layer.count).toBe(source.numFeatures)
  expect(layer.count).toBeGreaterThan(10)
  let onBinEdge = 0
  for (let i = 0; i < layer.count; i++) {
    const start = source.featurePositions[i * 2]!
    expect(layer.x[i]).toBe(start)
    expect(layer.x2[i]).toBe(source.featurePositions[i * 2 + 1])
    expect(layer.y[i]).toBe(source.featureScores[i])
    onBinEdge += start % 16 === 0 ? 1 : 0
  }
  // dense coverage, so a row starts where its bin does
  expect(onBinEdge / layer.count).toBeGreaterThan(0.95)
}, 40000)
