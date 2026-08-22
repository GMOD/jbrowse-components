import { fireEvent, waitFor, within } from '@testing-library/react'

import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json' with { type: 'json' }
import { createView, doBeforeEach, getTestSession, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 70_000 }
const opts = [{}, delay]

function typeAndEnter({
  input,
  value,
}: {
  input: HTMLInputElement
  value: string
}) {
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
}

async function doSetup(val?: unknown) {
  const args = await createView(val)
  const { findByTestId, findByPlaceholderText } = args

  const autocomplete = await findByTestId('autocomplete', ...opts)
  const input = (await findByPlaceholderText(
    'Search for location',
    ...opts,
  )) as HTMLInputElement

  autocomplete.focus()
  input.focus()

  return {
    autocomplete,
    input,
    ...args,
  }
}

test('lower case refname, click ctgB', async () => {
  const { input, findByRole } = await doSetup()

  fireEvent.mouseDown(input)
  fireEvent.click(within(await findByRole('listbox')).getByText(/ctgB/))

  await waitFor(() => {
    expect(input.value).toBe('ctgB:1..6,079')
  }, delay)
}, 50_000)

test('single result, searching: eden.1', async () => {
  const { input } = await doSetup()
  typeAndEnter({ input, value: 'eden.1' })
  await waitFor(() => {
    expect(input.value).toBe('ctgA:1..10,590')
  }, delay)
}, 70_000)

test('dialog with multiple results, searching seg02', async () => {
  const { input, findByText } = await doSetup()

  typeAndEnter({ input, value: 'seg02' })
  await findByText('Search results', ...opts)
}, 70_000)

test('enter finds what the dropdown listed, searching: apple', async () => {
  // "apple" has no exactly-matching indexed attribute, only Apple2/Apple3 as
  // prefix hits. Enter used to run an exact-only search, come back empty, and
  // report `No results found for "apple"` for a query the dropdown had just
  // listed two hits for
  const { input, findByText } = await doSetup()

  typeAndEnter({ input, value: 'apple' })

  await findByText('Search results', ...opts)
  await findByText('Apple2', ...opts)
  await findByText('Apple3', ...opts)
}, 70_000)

// The jb1 names index carries EDEN.1 four times, once per track that indexed
// it, all at ctgA:1049..9000. Four rows whose only varying column is Track is
// not a question worth asking, and asking it was issue #4302.
test('hits agreeing on a destination navigate rather than ask', async () => {
  const { session, view } = getTestSession(jb1_config)
  view.setWidth(800)

  await view.navToLocString('eden.1', 'volvox')

  expect(view.visibleLocStrings).toBe('ctgA:1..10,590')
  expect(session.queueOfDialogs).toHaveLength(0)
}, 40_000)

// Two of the four EDEN.1 entries are indexed under JBrowse 1 track names this
// config does not claim (ReadingFrame, volvox_gff3_tabix_html), and the first
// of them leads the list. Travelling through it would navigate and then drop a
// "could not resolve identifier" snackbar over the result.
test('an agreeing group skips a track no config claims', async () => {
  const { view } = getTestSession(jb1_config)
  view.setWidth(800)

  await view.navToLocString('eden.1', 'volvox')

  expect(view.tracks.map(t => t.configuration.trackId)).toEqual([
    'gff3tabix_genes',
  ])
}, 40_000)

// ...and a track already on screen outranks that, so the search does not stack
// a second gene track under the one being read.
test('an agreeing group navigates through a track already open', async () => {
  const { view } = getTestSession(jb1_config)
  view.setWidth(800)
  view.showTrack('bedtabix_genes')

  await view.navToLocString('eden.1', 'volvox')

  expect(view.tracks.map(t => t.configuration.trackId)).toEqual([
    'bedtabix_genes',
  ])
}, 40_000)

// the other half of the same branch: hits that name one feature in genuinely
// different places are a real question, and still get the picker
test('hits in different places still raise the picker', async () => {
  const { session, view } = getTestSession()
  view.setWidth(800)

  await view.navToLocString('seg02', 'volvox')

  expect(session.queueOfDialogs).toHaveLength(1)
}, 40_000)

test('test navigation with the search input box, {volvox2}ctgB:1..200', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: '{volvox2}ctgB:1..200' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.assemblyName).toEqual('volvox2')
  })
}, 70_000)

test('nav lower case refnames, searching: ctgb:1-100', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: 'ctgb:1-100' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 70_000)

test('nav lower case refnames, searching: ctgb', async () => {
  const { view, input } = await doSetup()

  typeAndEnter({ input, value: 'ctgb' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 70_000)

test('nav lower case refnames, searching: contigb:1-100', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: 'contigb:1-100' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 70_000)

test('description of gene, searching: kinase', async () => {
  const { input, findByText } = await doSetup()

  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))

  await waitFor(() => {
    expect(input.value).toBe('ctgA:1..10,590')
  }, delay)
}, 120_000)

test('search matches description for feature in two places', async () => {
  const { input, findByRole } = await doSetup()

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(
    within(await findByRole('listbox', ...opts)).getByText(/b101.2/),
  )
}, 70_000)

test('failed search resets input to visible location', async () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()
  const { input, findByText, view } = await doSetup()

  // Wait for coarseVisibleLocStrings to populate (has 100ms delay in autorun)
  // and blur input so useLayoutEffect can update its value
  input.blur()
  await waitFor(() => {
    expect(view.coarseVisibleLocStrings).not.toBe('')
    expect(input.value).not.toBe('')
  }, delay)

  const originalValue = input.value
  input.focus()

  typeAndEnter({ input, value: 'nonexistent_location_xyz123' })

  await findByText(/No results found/, ...opts)

  await waitFor(() => {
    expect(input.value).toBe(originalValue)
  }, delay)
  consoleMock.mockRestore()
}, 70_000)

// `grow` reached the locstring branch of handleSelectedRegion but not the
// single-search-hit branch, which hardcoded 0.2 — so a session spec's `grow`,
// or sv-core's navToLoc, was honoured or overwritten depending on whether the
// input happened to parse as a locstring rather than resolve to a feature.
test('an explicit grow reaches a feature hit, not only a locstring', async () => {
  const { view } = await getTestSession()
  view.setWidth(800)
  await view.navToLocString('eden.1', 'volvox', 0)
  const exact = view.visibleLocStrings

  const { view: padded } = await getTestSession()
  padded.setWidth(800)
  await padded.navToLocString('eden.1', 'volvox')

  // the feature's own bounds, with nothing added
  expect(exact).toBe('ctgA:1,055..9,005')
  // the default is still 20% either side for a search hit that asked for none
  expect(padded.visibleLocStrings).toBe('ctgA:1..10,590')
}, 40_000)

// A name that prefixes several features but equals none used to cost two reads
// of the same index: an exact search, then the broad one on its miss. The
// adapters answer 'exact' by filtering exactly the broad list, so the flag now
// rides on the hits and one read answers both.
test('enter reads the index once, exact miss or not', async () => {
  const { session, view } = await getTestSession()
  view.setWidth(800)
  const search = jest.spyOn(session.textSearchManager, 'search')

  // "apple" prefixes Apple2/Apple3 and matches no attribute exactly
  await view.navToLocString('apple', 'volvox')
  expect(search).toHaveBeenCalledTimes(1)

  // and the exact-hit path is still one read, as it always was
  search.mockClear()
  await view.navToLocString('eden.1', 'volvox')
  expect(search).toHaveBeenCalledTimes(1)
  expect(view.visibleLocStrings).toBe('ctgA:1..10,590')
}, 40_000)
