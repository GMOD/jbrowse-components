import { waitFor } from '@testing-library/react'

import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

const BARS = [{ mark: 'bar', encoding: { y: 'score' } }]
const TWO_SOURCES = features([
  { source: 'mom', start: 0, end: 400, score: 7 },
  { source: 'dad', start: 500, end: 900, score: 4 },
])
const LISTED = [{ name: 'dad' }, { name: 'mom' }, { name: 's2' }]

function displayListing(
  listing: Promise<unknown>,
  settings: Record<string, unknown> = { rows: 'source' },
) {
  const env = createTestEnvironment({ marks: BARS, ...settings })
  env.mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    method === 'MarkGetRowSources' ? listing : new Promise(() => {}),
  )
  const { display } = env.createDisplay()
  display.setRpcData(0, workerResult(display, TWO_SOURCES), REGION)
  return display
}

test('the export waits for the row listing, which adds the rows no feature in view names', async () => {
  let land!: (value: unknown) => void
  const display = displayListing(new Promise(resolve => (land = resolve)))
  expect(display.sources.map(row => row.name)).toEqual(['dad', 'mom'])
  expect(display.svgReady).toBe(false)

  land({ field: 'source', sources: LISTED })
  await waitFor(() => {
    expect(display.svgReady).toBe(true)
  })
  expect(display.sources.map(row => row.name)).toEqual(['dad', 'mom', 's2'])
})

test('a declared run does not start on the rows the features alone name', async () => {
  let land!: (value: unknown) => void
  const display = displayListing(new Promise(resolve => (land = resolve)))
  expect(display.clusterableSources).toHaveLength(2)
  expect(display.autoClusterReady).toBe(false)

  land({ field: 'source', sources: LISTED })
  await waitFor(() => {
    expect(display.autoClusterReady).toBe(true)
  })
  expect(display.clusterableSources).toHaveLength(3)
})

test('a failed listing lets the export draw the rows the features name', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const display = displayListing(Promise.reject(new Error('no listing')))
  await waitFor(() => {
    expect(display.svgReady).toBe(true)
  })
  expect(display.sources.map(row => row.name)).toEqual(['dad', 'mom'])
  expect(display.autoClusterReady).toBe(true)
  warn.mockRestore()
  error.mockRestore()
})

test('an adapter that lists no rows lets the export draw the rows the features name', async () => {
  const display = displayListing(Promise.resolve(undefined))
  await waitFor(() => {
    expect(display.svgReady).toBe(true)
  })
  expect(display.dataSuperseded).toBe(false)
  expect(display.sources.map(row => row.name)).toEqual(['dad', 'mom'])
})

test('a display drawing no rows from a listing never waits on one', () => {
  const display = displayListing(new Promise(() => {}), {})
  expect(display.svgReady).toBe(true)
})
