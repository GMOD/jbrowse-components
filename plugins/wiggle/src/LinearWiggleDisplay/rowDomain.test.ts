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
    displayConfig: { facet: { field: 'source', domain } },
  })
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve(makeMultiWiggleData('a', 'b', 'c')),
  )
  const { display } = env.createDisplay()
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.sourcesWithoutLayout).toHaveLength(3)
  })
  return display
}

const rowNames = (display: { sources: { name: string }[] }) =>
  display.sources.map(s => s.name)

describe('`facet.domain` seeds the subtrack order', () => {
  it('leads with the subtracks it names and leaves the rest in adapter order', async () => {
    expect(rowNames(await loadedDisplay(['c']))).toEqual(['c', 'a', 'b'])
  })

  it('ignores a subtrack name the adapter does not report', async () => {
    expect(rowNames(await loadedDisplay(['zz', 'b']))).toEqual(['b', 'a', 'c'])
  })

  it('leaves adapter order alone by default', async () => {
    expect(rowNames(await loadedDisplay([]))).toEqual(['a', 'b', 'c'])
  })

  // `rowDomain` reads the order back through `facet`, which is undefined while
  // the sources share a plot, so a `setFaceted` writing the object whole wrote
  // the empty order it had just read.
  it('survives a trip through the shared plot', async () => {
    const display = await loadedDisplay(['c'])
    display.setFaceted(false)
    display.setFaceted(true)
    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
  })

  // `layout` is the runtime channel over the seed, and "Reset row order"
  // returns to the domain rather than to the adapter's order.
  it('gives way to a layout and comes back when it is cleared', async () => {
    const display = await loadedDisplay(['c'])
    display.setLayout([{ name: 'b' }, { name: 'a' }, { name: 'c' }])
    expect(rowNames(display)).toEqual(['b', 'a', 'c'])

    display.clearLayout()

    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
  })
})
