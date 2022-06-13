import React from 'react'
import { fireEvent, render, within } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import {
  JBrowse,
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  getPluginManager,
} from './util'

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 20000 }

test('opens the track menu and enables soft clipping', async () => {
  console.error = jest.fn()
  const pm = getPluginManager()
  const { session } = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  await findByText('Help')
  act(() => session.views[0].setNewView(0.02, 142956))

  // load track
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox-long-reads-sv-bam', {}, delay),
  )
  await findByTestId(
    'display-volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
    {},
    delay,
  )
  expect(session.views[0].tracks[0]).toBeTruthy()

  // opens the track menu
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Show soft clipping'))

  // wait for block to rerender
  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-pileup'),
  )

  expectCanvasMatch(
    await findByTestId1(
      'prerendered_canvas_softclipped_{volvox}ctgA:2,849..2,864-0_done',
      {},
      delay,
    ),
  )
}, 30000)

test('selects a sort, sort by strand', async () => {
  console.error = jest.fn()
  const pm = getPluginManager()
  const { session } = pm.rootModel
  const { findByTestId, findByText, findAllByTestId } = render(
    <JBrowse pluginManager={pm} />,
  )
  await findByText('Help')
  act(() => session.views[0].setNewView(0.02, 2086500))

  // load track
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox-long-reads-cram', {}, delay),
  )
  await findByTestId(
    'display-volvox-long-reads-cram-LinearAlignmentsDisplay',
    {},
    delay,
  )
  expect(session.views[0].tracks[0]).toBeTruthy()

  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Sort by'))
  fireEvent.click(await findByText('Read strand'))

  // wait for pileup track to render with sort
  await findAllByTestId('pileup-Read strand', {}, delay)

  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-pileup'),
  )

  expectCanvasMatch(
    await findByTestId1(
      'prerendered_canvas_{volvox}ctgA:41,729..41,744-0_done',
      {},
      delay,
    ),
  )
}, 35000)

test('color by strand', async () => {
  console.error = jest.fn()
  const pm = getPluginManager()
  const { session } = pm.rootModel
  const { findByTestId, findByText, findAllByTestId } = render(
    <JBrowse pluginManager={pm} />,
  )
  await findByText('Help')
  act(() => session.views[0].setNewView(0.02, 2086500))

  // load track
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox-long-reads-cram', {}, delay),
  )
  await findByTestId(
    'display-volvox-long-reads-cram-LinearAlignmentsDisplay',
    {},
    delay,
  )

  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Color scheme'))
  fireEvent.click(await findByText('Strand'))

  // wait for pileup track to render with color
  await findAllByTestId('pileup-strand', {}, delay)

  // wait for pileup track to render
  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-pileup'),
  )
  expectCanvasMatch(
    await findByTestId1(
      'prerendered_canvas_{volvox}ctgA:41,729..41,744-0_done',
      {},
      delay,
    ),
  )
}, 30000)

test('color by tag', async () => {
  console.error = jest.fn()
  const pm = getPluginManager()
  const { session } = pm.rootModel
  const { findByTestId, findByText, findAllByTestId } = render(
    <JBrowse pluginManager={pm} />,
  )
  await findByText('Help')
  act(() => session.views[0].setNewView(0.465, 85055))

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram', {}, delay))
  await findByTestId('display-volvox_cram-LinearAlignmentsDisplay', {}, delay)
  expect(session.views[0].tracks[0]).toBeTruthy()

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

  // wait for pileup track to render
  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-pileup'),
  )

  expectCanvasMatch(
    await findByTestId1(
      'prerendered_canvas_{volvox}ctgA:39,805..40,176-0_done',
      {},
      delay,
    ),
  )
}, 30000)
