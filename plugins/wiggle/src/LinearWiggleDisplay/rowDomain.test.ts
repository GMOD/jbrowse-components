import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeMultiWiggleData } from './testEnv.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function loadedDisplay(domain: string[]) {
  const env = createTestEnvironment({
    displayConfig: { rows: { field: 'source', domain } },
  })
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve(makeMultiWiggleData('a', 'b', 'c')),
  )
  const { display } = env.createDisplay()
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.discoveredRows).toHaveLength(3)
  })
  return display
}

const rowNames = (display: { sources: { name: string }[] }) =>
  display.sources.map(s => s.name)

describe('`rows.domain` is the subtrack order', () => {
  it('leads with the subtracks it names and leaves the rest in adapter order', async () => {
    expect(rowNames(await loadedDisplay(['c']))).toEqual(['c', 'a', 'b'])
  })

  it('ignores a subtrack name the adapter does not report', async () => {
    expect(rowNames(await loadedDisplay(['zz', 'b']))).toEqual(['b', 'a', 'c'])
  })

  it('leaves adapter order alone by default', async () => {
    expect(rowNames(await loadedDisplay([]))).toEqual(['a', 'b', 'c'])
  })

  // `setRowLayout` writes the field alone, so the order survives the shared
  // plot rather than going with the object.
  it('survives a trip through the shared plot', async () => {
    const display = await loadedDisplay(['c'])
    display.setRowLayout(false)
    display.setRowLayout(true)
    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
  })

  // A reorder writes the same member the config seeded, and "Reset row order"
  // returns to what the config declared rather than to the adapter's order.
  it('takes a reorder and returns to the declared order on reset', async () => {
    const display = await loadedDisplay(['c'])
    display.setRowOrder([{ name: 'b' }, { name: 'a' }, { name: 'c' }])
    expect(rowNames(display)).toEqual(['b', 'a', 'c'])
    expect(display.rowArrangementIsCustom).toBe(true)

    display.resetRowArrangement()

    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
    expect(display.rowArrangementIsCustom).toBe(false)
  })
})
