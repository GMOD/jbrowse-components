import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import RefNameAutocomplete from './RefNameAutocomplete/index.tsx'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          ],
          tracks: [],
          configuration: {},
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: { type: 'FromConfigSequenceAdapter', features: [] },
    },
  })
  return { model: session.views[0] }
}

const patience = { timeout: 5000 }

describe('RefNameAutocomplete', () => {
  it('renders the search input', () => {
    const { model } = setup()
    render(
      <RefNameAutocomplete
        model={model}
        assemblyName="volvox"
        fetchResults={async () => []}
      />,
    )
    expect(screen.getByPlaceholderText('Search for location')).toBeTruthy()
  })

  it('is disabled when no assemblyName is provided', () => {
    const { model } = setup()
    render(<RefNameAutocomplete model={model} fetchResults={async () => []} />)
    expect(
      (screen.getByRole('combobox') as HTMLInputElement).disabled,
    ).toBe(true)
  })

  it('calls fetchResults when the user types a query', async () => {
    const user = userEvent.setup()
    const { model } = setup()
    const fetchResults = jest.fn(async () => [])

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()
    const result = new BaseResult({ label: 'ctgA:1..100' })
    const fetchResults = jest.fn(async () => [result])
    const onSelect = jest.fn()

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()
    const onChange = jest.fn()

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()
    const fetchResults = jest.fn(async () => [
      new BaseResult({ label: 'ctgA', displayString: 'ctgA:1..100' }),
      new BaseResult({ label: 'ctgA', displayString: 'ctgA:1..100' }),
    ])

    render(
      <RefNameAutocomplete
        model={model}
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
    const { model } = setup()

    let resolveSearch!: (r: BaseResult[]) => void
    const fetchResults = jest.fn(
      () =>
        new Promise<BaseResult[]>(resolve => {
          resolveSearch = resolve
        }),
    )

    render(
      <RefNameAutocomplete
        model={model}
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
})
