import { getConf, setConf } from '@jbrowse/core/configuration'
import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { SourceInfo } from '@jbrowse/wiggle-core'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const GROUPED: SourceInfo[] = [
  { name: 'Grain1', group: 'Islet' },
  { name: 'Grain2', group: 'Islet' },
  { name: 'Grain3', group: 'Liver' },
  { name: 'Grain4' },
]

async function loaded(rows: Record<string, unknown>) {
  const env = createTestEnvironment({
    displayConfig: { rows: { field: 'source', ...rows } },
  })
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve([
      { sources: GROUPED.map(s => ({ ...makeSource(s.name), ...s })) },
    ]),
  )
  const { display } = env.createDisplay()
  // before the first region lands no chip reads "0 of 0"
  expect(display.rowNarrowingHint).toBeUndefined()
  expect(display.rowFocusLineHeight).toBe(0)
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.discoveredRows).toHaveLength(GROUPED.length)
  })
  return display
}

const namesOf = (rows: readonly { name: string }[]) => rows.map(r => r.name)

test('rows.filter keeps the subtracks whose field passes', async () => {
  const display = await loaded({
    filter: [{ field: 'group', equal: 'Islet' }],
  })
  expect(namesOf(display.sources)).toEqual(['Grain1', 'Grain2'])
  expect(display.rowNarrowingHint?.text).toBe('Showing 2 of 4 rows')
})

test('a kept list naming no subtrack draws none and names the miss', async () => {
  const display = await loaded({ kept: ['Grain9'] })
  expect(display.sources).toEqual([])
  expect(display.rowNarrowingHint?.text).toBe('Showing 0 of 4 rows · Show all')
  expect(display.notices).toContain(
    'rows.kept names no row (Grain9), so no row shows',
  )
})

// The overlay toggle writes rows.field '' and back, which names no values,
// so it resets nothing: the filter names an attribute, and kept the same
// subtracks either side.
test('the overlay toggle keeps filter and kept', async () => {
  const display = await loaded({
    filter: [{ field: 'group', equal: 'Islet' }],
    kept: ['Grain1'],
  })
  expect(namesOf(display.sources)).toEqual(['Grain1'])
  setConf(display, ['rows', 'field'], '')
  setConf(display, ['rows', 'field'], 'source')
  expect(getConf(display, ['rows', 'kept'])).toEqual(['Grain1'])
  expect(namesOf(display.sources)).toEqual(['Grain1'])
})

test('rows.filter refuses a row name, pointing at rows.kept', async () => {
  const display = await loaded({})
  expect(() => {
    setConf(display, ['rows', 'filter'], [{ field: 'name', equal: 'Grain1' }])
  }).toThrow(/a row's name goes in rows.kept/)
})
