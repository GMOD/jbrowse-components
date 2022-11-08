import { fireEvent, within } from '@testing-library/react'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  pc,
  hts,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('opens the track menu and enables soft clipping', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.02, 142956)

  // load track
  fireEvent.click(
    await findByTestId(hts('volvox-long-reads-sv-bam'), {}, delay),
  )
  await findByTestId(
    'display-volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
    {},
    delay,
  )
  expect(view.tracks[0]).toBeTruthy()

  // opens the track menu
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Show soft clipping'))

  // wait for block to rerender
  const { findByTestId: f0 } = within(await findByTestId('Blockset-pileup'))

  expectCanvasMatch(
    await f0(pc('softclipped_{volvox}ctgA:2849..2864-0'), {}, delay),
  )
}, 30000)

test('selects a sort, sort by base pair', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(0.043688891869634636, 301762)
  const track = 'volvox_cram_alignments_ctga'

  // load track
  fireEvent.click(await findByTestId(hts(track), {}, delay))
  await findByTestId(`display-${track}-LinearAlignmentsDisplay`, {}, delay)
  expect(view.tracks[0]).toBeTruthy()

  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Sort by'))
  fireEvent.click(await findByText('Base pair'))

  // wait for pileup track to render with sort
  await findAllByTestId('pileup-Base pair', {}, delay)
  const { findByTestId: find1 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find1(pc('{volvox}ctgA:13196..13230-0'), {}, delay))

  fireEvent.click(await findByTestId('zoom_out'))
  await findAllByTestId('pileup-Base pair', {}, delay)
  const { findByTestId: find2 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find2(pc('{volvox}ctgA:13161..13230-0'), {}, delay))
}, 35000)

test('color by tag', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(0.465, 85055)

  // load track
  fireEvent.click(await findByTestId(hts('volvox_cram'), {}, delay))
  await findByTestId('display-volvox_cram-LinearAlignmentsDisplay', {}, delay)
  expect(view.tracks[0]).toBeTruthy()

  // colors by HP tag
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Color scheme'))
  fireEvent.click(await findByText('Color by tag...'))
  fireEvent.change(await findByTestId('color-tag-name-input'), {
    target: { value: 'HP' },
  })
  fireEvent.click(await findByText('Submit'))
  // wait for pileup track to render with color
  await findAllByTestId('pileup-tagHP', {}, delay)
  const { findByTestId: find1 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find1(pc('{volvox}ctgA:39805..40176-0'), {}, delay))
}, 30000)
