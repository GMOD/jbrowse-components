import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import {
  JBrowse,
  setup,
  generateReadBuffer,
  expectCanvasMatch,
  getPluginManager,
} from './util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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

const delay = { timeout: 10000 }

function createView() {
  const pm = getPluginManager()
  const { session } = pm.rootModel!
  const rest = render(<JBrowse pluginManager={pm} />)
  const view = session!.views[0] as LGV
  return { view, ...rest }
}

test('open a bigwig track', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_microarray', {}, delay),
  )
  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..4,000-0_done',
      {},
      delay,
    ),
  )
}, 15000)
test('open a bigwig line track 2', async () => {
  const { view, findByTestId, findByText } = createView()

  await findByText('Help')
  view.setNewView(10, 0)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_microarray_line', {}, delay),
  )
  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..8,000-0_done',
      {},
      delay,
    ),
  )
}, 15000)
test('open a bigwig density track', async () => {
  const { view, findByTestId, findByText } = createView()

  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_microarray_density', {}, delay),
  )
  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..4,000-0_done',
      {},
      delay,
    ),
  )
}, 15000)
