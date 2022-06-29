import React from 'react'
import { fireEvent, within } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  createView,
  hts,
  pc,
} from './util'

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 20000 }

test('opens an alignments track', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-pileup', {}, delay),
  )
  expectCanvasMatch(
    await findByTestId1(pc('{volvox}ctgA:1..4,000-0'), {}, delay),
  )

  const { findByTestId: findByTestId2 } = within(
    await findByTestId('Blockset-snpcoverage', {}, delay),
  )
  expectCanvasMatch(
    await findByTestId2(pc('{volvox}ctgA:1..4,000-0'), {}, delay),
  )

  const track = await findAllByTestId('pileup_overlay_canvas')
  fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(track[0], { clientX: 200, clientY: 40 })
  fireEvent.mouseDown(track[0], { clientX: 200, clientY: 20 })
  fireEvent.mouseMove(track[0], { clientX: 300, clientY: 20 })
  fireEvent.mouseUp(track[0], { clientX: 300, clientY: 20 })
  fireEvent.mouseMove(track[0], { clientX: -100, clientY: -100 })

  // this is to confirm a alignment detail widget opened
  await findByTestId('alignment-side-drawer')
}, 20000)

test('test that bam with small max height displays message', async () => {
  const { findByTestId, findAllByText } = createView()
  fireEvent.click(
    await findByTestId(hts('volvox_bam_small_max_height'), {}, delay),
  )

  await findAllByText('Max height reached', {}, delay)
}, 30000)

test('test snpcoverage doesnt count snpcoverage', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.03932, 67884.16536402702)

  // load track
  fireEvent.click(
    await findByTestId(hts('volvox-long-reads-sv-cram'), {}, delay),
  )

  const { findByTestId: findByTestId1 } = within(
    await findByTestId('Blockset-snpcoverage', {}, delay),
  )

  expectCanvasMatch(
    await findByTestId1(pc('{volvox}ctgA:2,657..2,688-0'), {}, delay),
  )
  expectCanvasMatch(
    await findByTestId1(pc('{volvox}ctgA:2,689..2,720-0'), {}, delay),
  )
}, 30000)
