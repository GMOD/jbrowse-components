// library
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'
import hicConfig from '../../../../extra_test_data/hic_integration_test.json'

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

hicConfig.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

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
  const { findByTestId, findAllByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  state.session.views[0].setNewView(5000, 0)
  fireEvent.click(await findByTestId('htsTrackEntry-hic_test'))
  const canvas = await findAllByTestId(
    'prerendered_canvas',
    {},
    {
      timeout: 10000,
    },
  )
  const bigwigImg = canvas[0].toDataURL()
  const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
  const bigwigBuf = Buffer.from(bigwigData, 'base64')
  expect(bigwigBuf).toMatchImageSnapshot({
    failureThreshold: 0.05,
    failureThresholdType: 'percent',
  })
}, 15000)
