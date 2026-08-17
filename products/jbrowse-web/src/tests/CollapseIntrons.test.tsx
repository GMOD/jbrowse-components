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
  expect(newView.totalBp).toBeLessThan(view.totalBp / 2)
  // showAllRegions' framing: everything on screen, filling 90% of the width
  expect(newView.bpPerPx * newView.width * 0.9).toBeCloseTo(newView.totalBp, 5)
  expect(newView.offsetPx).toBeCloseTo(
    (newView.totalBp / newView.bpPerPx - newView.width) / 2,
    5,
  )
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
