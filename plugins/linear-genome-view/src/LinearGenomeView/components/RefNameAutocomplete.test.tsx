import '@testing-library/jest-dom'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { RefNameAutocomplete, useRecentLocations } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { isStopped } from '@jbrowse/core/util/stopToken'
import { createTestSession } from '@jbrowse/web/testUtils'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { navigateToSelectedOption } from '../../searchUtils.ts'
import SearchBox from './SearchBox.tsx'

import type { LinearGenomeViewModel } from '../model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

// a haplotype-resolved assembly, which is the shape globbing exists for: the
// useful selection is "all of hap1", never a hand-kept list of its scaffolds
function setupHaplotypes() {
  const session = createTestSession({ sessionSnapshot }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctg1_hap1', 'ctg2_hap1', 'ctg1_hap2', 'ctg2_hap2'].map(
          refName => ({
            refName,
            uniqueId: refName,
            start: 0,
            end: 100,
            seq: 'A'.repeat(100),
          }),
        ),
      },
    },
  })
  const model = session.views[0]
  return { model, session: getSession(model) }
}

function setupManyChromosomes(count: number) {
  const session = createTestSession({ sessionSnapshot }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: Array.from({ length: count }, (_, i) => ({
          refName: `ctg${i}`,
          uniqueId: `ctg${i}`,
          start: 0,
          end: 1,
          seq: 'A',
        })),
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
      // the second argument is the per-fetch stop token: a fetcher that
      // forwards it lets the next keystroke cancel this query's ranking
      expect(fetchResults).toHaveBeenCalledWith('ctg', expect.anything())
    }, patience)
  })

  it('stops the previous query token when a keystroke supersedes it', async () => {
    const user = userEvent.setup()
    const { session } = setup()
    const tokens: StopToken[] = []
    const fetchResults = jest.fn(async (_q: string, stopToken?: StopToken) => {
      if (stopToken) {
        tokens.push(stopToken)
      }
      return []
    })

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
      expect(tokens).toHaveLength(1)
    }, patience)
    expect(isStopped(tokens[0])).toBe(false)

    await user.type(input, 'A')
    await waitFor(() => {
      expect(tokens).toHaveLength(2)
    }, patience)
    // the superseded query's token is stopped; the live one is not
    expect(isStopped(tokens[0])).toBe(true)
    expect(isStopped(tokens[1])).toBe(false)
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

  // The whole reason a glob belongs in the picker rather than in the locstring
  // parser: the matches are listed, and counted, before anything is committed
  // to. These two go through the real navigation path — no bulk-navigation code
  // exists, the "show all" row just carries the multi-region locstring the box
  // has always accepted.
  it("lists a glob's matches with one row that takes all of them", async () => {
    const user = userEvent.setup()
    const { session } = setupHaplotypes()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, '*_hap1')

    await waitFor(() => {
      expect(
        screen.getByText('Show all 2 regions matching *_hap1'),
      ).toBeTruthy()
    }, patience)
    // the individual matches are listed under it, and hap2 is not
    expect(screen.getByText('ctg1_hap1')).toBeTruthy()
    expect(screen.queryByText('ctg1_hap2')).toBeNull()
  })

  it('pressing enter on a glob does what that row does', async () => {
    // the property the shared matcher exists for: Enter and the row answer for
    // the same typed text. Enter used to reach the text index, which can never
    // answer a glob, and report no results over a list the box was showing
    const user = userEvent.setup()
    const { model, session } = setupHaplotypes()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
        onSelect={option => {
          navigateToSelectedOption({
            model,
            assemblyName: 'volvox',
            option,
          }).catch(() => {})
        }}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, '*_hap1{Enter}')

    await waitFor(() => {
      expect(
        model.displayedRegions.map((r: { refName: string }) => r.refName),
      ).toEqual(['ctg1_hap1', 'ctg2_hap1'])
    }, patience)
  })

  it('picking that row displays every match, via the multi-region path', async () => {
    const user = userEvent.setup()
    const { model, session } = setupHaplotypes()

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
        onSelect={option => {
          navigateToSelectedOption({
            model,
            assemblyName: 'volvox',
            option,
          }).catch(() => {})
        }}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)
    await user.type(input, '*_hap1')
    await waitFor(
      () => screen.getByText('Show all 2 regions matching *_hap1'),
      patience,
    )
    await user.click(screen.getByText('Show all 2 regions matching *_hap1'))

    await waitFor(() => {
      expect(
        model.displayedRegions.map((r: { refName: string }) => r.refName),
      ).toEqual(['ctg1_hap1', 'ctg2_hap1'])
    }, patience)
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

  it('bounds the browse list for a huge assembly instead of rendering every refname', async () => {
    const user = userEvent.setup()
    const { session } = setupManyChromosomes(500)

    render(
      <RefNameAutocomplete
        session={session}
        assemblyName="volvox"
        fetchResults={async () => []}
      />,
    )

    const input = screen.getByPlaceholderText('Search for location')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('keep typing for more results')).toBeTruthy()
    }, patience)
    // 100 capped rows + the single disabled "keep typing" hint
    expect(screen.getAllByRole('option')).toHaveLength(101)
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

// A stacked view's header turns help off, but the first recent location draws
// the ⋮ button anyway, so what the box reserves has to follow the button rather
// than the help flag — otherwise the locstring loses 30px to a button the box
// is sized as if it did not have.
describe('SearchBox adornment width', () => {
  // minWidth 0 so the reservation is what decides the width; every real caller
  // passes a floor that swallows the difference at a short locstring. Measured
  // by mounting rather than by reading the prop, so this fails if `SearchBox`
  // stops telling the box what it is drawing.
  function mountWidth(model: LinearGenomeViewModel) {
    const { container, unmount } = render(
      <SearchBox model={model} showHelp={false} minWidth={0} />,
    )
    const width = container.querySelector<HTMLElement>('.MuiAutocomplete-root')!
      .style.width
    unmount()
    return Number.parseInt(width, 10)
  }

  it('grows by the overflow button once there is a recent location', () => {
    localStorage.clear()
    const { model } = setupWithChromosome()
    // same model in both mounts, so the locstring the box is sized to is the
    // same and the button is the only difference
    const bare = mountWidth(model)

    // through the hook that owns the storage key, rather than a hand-built one
    const { result } = renderHook(() => useRecentLocations('volvox'))
    act(() => {
      result.current.addRecentLocation({ label: 'ctgA', loc: 'ctgA' })
    })

    expect(mountWidth(model)).toBeGreaterThan(bare)
    localStorage.clear()
  })
})
