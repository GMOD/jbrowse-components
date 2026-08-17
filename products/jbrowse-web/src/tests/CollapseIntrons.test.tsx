import '@testing-library/jest-dom'

import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['gff3tabix_genes'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('collapse introns on gene feature', async () => {
  const { view, session, findByText } = await createView(config)

  await view.navToLocString('ctgA:907..10,000')
  fireEvent.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAnyDisplayPainted(delay)

  const label = await screen.findByTestId('feature-name-EDEN', ...opts)
  fireEvent.contextMenu(label)

  fireEvent.click(await findByText('Collapse introns', ...opts))
  await findByText('Collapse introns of EDEN', ...opts)
  fireEvent.click(await findByText('Open in new view', ...opts))

  await waitFor(
    () => {
      expect(session.views.length).toBe(2)
    },
    { timeout: 10000 },
  )

  const newView = session.views[1] as LinearGenomeViewModel

  await waitFor(
    () => {
      expect(newView.initialized).toBe(true)
    },
    { timeout: 10000 },
  )

  expect(newView.displayedRegions.length).toBeGreaterThan(1)
  for (const region of newView.displayedRegions) {
    expect(region.refName).toBe('ctgA')
  }

  // The new view frames the regions it was built with, not the window it was
  // launched from — collapsing EDEN's introns is most of the 9kb the source view
  // shows. The snapshot names that framing as a genomic window, and the pair it
  // used to name instead (bpPerPx/offsetPx) was dropped in silence, opening this
  // view at the source view's zoom and scroll.
  // the same 3,113bp the dialog previews before either button is clicked
  expect(newView.totalBp).toBe(3113)
  expect(newView.totalBp).toBeLessThan(view.totalBp / 2)
  // fitAllRegions' framing: the regions edge to edge, so nothing is scrolled
  expect(newView.bpPerPx * newView.width).toBeCloseTo(newView.totalBp, 5)
  expect(newView.offsetPx).toBe(0)
}, 60000)

test('collapse introns dialog lists the transcripts to scope to', async () => {
  const { view, findByText } = await createView(config)

  await view.navToLocString('ctgA:907..10,000')
  fireEvent.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAnyDisplayPainted(delay)

  const label = await screen.findByTestId('feature-name-EDEN', ...opts)
  fireEvent.contextMenu(label)

  fireEvent.click(await findByText('Collapse introns', ...opts))
  await findByText('Collapse introns of EDEN', ...opts)

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Transcript' }))
  const listbox = within(await screen.findByRole('listbox', ...opts))

  expect(listbox.getByText(/All transcripts \(3\)/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.1 \(/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.2 \(/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.3 \(/)).toBeInTheDocument()
}, 60000)

test('the dialog says what the window size collapses to before anything is clicked', async () => {
  const { view, findByText } = await createView(config)

  await view.navToLocString('ctgA:907..10,000')
  fireEvent.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAnyDisplayPainted(delay)

  fireEvent.contextMenu(await screen.findByTestId('feature-name-EDEN', ...opts))
  fireEvent.click(await findByText('Collapse introns', ...opts))
  await findByText('Collapse introns of EDEN', ...opts)

  // The count and the bp are the real ones for EDEN at the default 100bp window,
  // and they match what "Open in new view" then frames — the other test asserts
  // 3113bp of collapsed regions on the view it builds.
  // The 3,113bp is the same number the first test's view reports as its totalBp,
  // so the preview and the view it builds are pinned to each other.
  await findByText(
    'Collapses to 4 regions — 3,113bp shown of the 7,951bp this feature spans',
    ...opts,
  )
}, 60000)
