import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import {
  JBrowse,
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  getPluginManager,
} from './util'
import hicConfig from '../../../../extra_test_data/hic_integration_test.json'

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

hicConfig.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

const delay = { timeout: 20000 }

test('hic', async () => {
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url =>
        new LocalFile(require.resolve(`../../../../extra_test_data/${url}`)),
    ),
  )
  const pluginManager = getPluginManager(hicConfig)

  const state = pluginManager.rootModel
  const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)
  state.session.views[0].setNewView(5000, 0)
  fireEvent.click(await findByTestId('htsTrackEntry-hic_test'))
  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{hg19}1:1..4,000,000-0', {}, delay),
  )
}, 15000)
