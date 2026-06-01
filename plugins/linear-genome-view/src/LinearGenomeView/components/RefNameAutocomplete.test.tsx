import '@testing-library/jest-dom'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { RefNameAutocomplete } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const sessionSnapshot = {
  views: [
    {
      type: 'LinearGenomeView',
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: [
        {
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 100,
        },
      ],
      tracks: [],
      configuration: {},
    },
  ],
}

function setup() {
  const session = createTestSession({ sessionSnapshot }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: { type: 'FromConfigSequenceAdapter', features: [] },
    },
  })
  const model = session.views[0]
  return { model, session: getSession(model) }
}

function setupWithChromosome() {
  const session = createTestSession({ sessionSnapshot }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 100,
            seq: 'A'.repeat(100),
          },
        ],
      },
    },
  })
  const model = session.views[0]
  return { model, session: getSession(model) }
}

const patience = { timeout: 5000 }

describe('RefNameAutocomplete', () => {
  it('renders the search input', () => {
    const { session } = setup()
    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
      />,
    )
    expect(screen.getByPlaceholderText('Search for location')).toBeTruthy()
  })

  it('is disabled when no assemblyName is provided', () => {
    const { session } = setup()
    render(
      <RefNameAutocomplete session={session} fetchResults={async () => []} />,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('calls fetchResults when the user types a query', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const fetchResults = jest.fn(async () => [])

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')

    await waitFor(() => {
      expect(fetchResults).toHaveBeenCalledWith('ctg')
    }, patience)
  })

  it('displays results returned by fetchResults', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')

    await waitFor(() => {
      expect(screen.getByText('ctgA:1..100')).toBeTruthy()
    }, patience)
  })

  it('calls onSelect with the chosen result', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const result = new BaseResult({ label: 'ctgA:1..100' })
    const fetchResults = jest.fn(async () => [result])
    const onSelect = jest.fn()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
        onSelect={onSelect}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')
    await waitFor(() => screen.getByText('ctgA:1..100'), patience)
    await user.click(screen.getByText('ctgA:1..100'))

    expect(onSelect).toHaveBeenCalledWith(result)
  })

  it('calls onChange for each typed character', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const onChange = jest.fn()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
        onChange={onChange}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ct')

    expect(onChange).toHaveBeenCalledWith('c')
    expect(onChange).toHaveBeenCalledWith('ct')
  })

  it('clears results when the input is emptied', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')
    await waitFor(() => screen.getByText('ctgA:1..100'), patience)

    await user.clear(input)

    await waitFor(() => {
      expect(screen.queryByText('ctgA:1..100')).toBeNull()
    }, patience)
  })

  it('deduplicates results with the same display string', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA', displayString: 'ctgA:1..100' }),
      new BaseResult({ label: 'ctgA', displayString: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')
    await waitFor(() => screen.getByText('ctgA:1..100'), patience)

    expect(screen.queryAllByText('ctgA:1..100')).toHaveLength(1)
  })

  it('shows loading text while fetch is in progress, then results when done', async () => {
    const user = userEvent.setup()
    const { session } = setup()

    let resolveSearch!: (r: BaseResult[]) => void
    const fetchResults = jest.fn(
      () =>
        new Promise<BaseResult[]>(resolve => {
          resolveSearch = resolve
        }),
    )

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={fetchResults}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, 'ctg')

    await waitFor(() => {
      expect(screen.getByText('loading results')).toBeTruthy()
    }, patience)

    resolveSearch([new BaseResult({ label: 'ctgA:1..100' })])

    await waitFor(() => {
      expect(screen.getByText('ctgA:1..100')).toBeTruthy()
    }, patience)
  })

  it('snaps the input back to value on blur after typing without selecting', async () => {
    const user = userEvent.setup()
    const { session } = setup()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const input = screen.getByRole('combobox') as HTMLInputElement
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'foo')
    expect(input.value).toBe('foo')
    await user.tab()
    await waitFor(() => {
      expect(input.value).toBe('ctgA:1-100')
    }, patience)
  })

  it('snaps the input back to value after selecting a result', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgB:1..200' }),
    ])

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={fetchResults}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const input = screen.getByRole('combobox') as HTMLInputElement
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'ctg')
    await waitFor(() => screen.getByText('ctgB:1..200'), patience)
    await user.click(screen.getByText('ctgB:1..200'))

    await waitFor(() => {
      expect(input.value).toBe('ctgA:1-100')
    }, patience)
  })

  // Convenience: queries the combobox input fresh from the DOM. After a
  // rerender, the React DOM-side value updates but a previously captured
  // reference can lag — re-query each time you assert.
  const getInput = () =>
    screen.getByRole('combobox') as unknown as HTMLInputElement

  it('reflects external value changes when the user is not typing', async () => {
    const { session } = setup()

    const { rerender } = render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
      />,
    )
    expect(getInput().value).toBe('ctgA:1-100')

    rerender(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgB:1-200"
        fetchResults={async () => []}
      />,
    )
    expect(getInput().value).toBe('ctgB:1-200')
  })

  it('clobbers typed text when external value changes (location bar behaviour)', async () => {
    const user = userEvent.setup()
    const { session } = setup()

    const { rerender } = render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
      />,
    )

    await user.click(getInput())
    await user.clear(getInput())
    await user.type(getInput(), 'gene1')
    expect(getInput().value).toBe('gene1')

    // The view navigated under the user (bookmark click, programmatic nav,
    // …). The address bar should reflect where we actually are, not stale
    // typed text.
    rerender(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgB:1-200"
        fetchResults={async () => []}
      />,
    )
    expect(getInput().value).toBe('ctgB:1-200')
  })

  it('lets the user fully empty the input mid-type without snapping back', async () => {
    const user = userEvent.setup()
    const { session } = setup()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const input = screen.getByRole('combobox') as HTMLInputElement

    await user.click(input)
    await user.clear(input)
    // before this fix, the empty value fell through to `value` so the next
    // typed character appended to "ctgA:1-100" instead of replacing it
    expect(input.value).toBe('')
    await user.type(input, 'foo')
    expect(input.value).toBe('foo')
  })

  it('reverts to value after a freeSolo submit that does not navigate', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    // Simulates the production path: SearchBox.onSelect attempts navigation,
    // catches its own errors, and `value` does not change. The autocomplete
    // must still drop the typed text and revert to `value`.
    const onSelect = jest.fn()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
        onSelect={onSelect}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const input = screen.getByRole('combobox') as HTMLInputElement

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'nonexistent_xyz')
    expect(input.value).toBe('nonexistent_xyz')

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled()
      expect(input.value).toBe('ctgA:1-100')
    }, patience)
  })

  it('shows chromosome names when value is a locstring (regression: chromosomes were filtered out)', async () => {
    const user = userEvent.setup()
    const { session } = setupWithChromosome()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        value="ctgA:1-100"
        fetchResults={async () => []}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('ctgA')).toBeTruthy()
    }, patience)
  })
})
