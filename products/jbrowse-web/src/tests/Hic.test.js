// library
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'
import hicConfig from '../../test_data/hic_integration_test.json'

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('hic', () => {
  it('hic track', async () => {
    fetch.resetMocks()
    fetch.mockResponse(
      generateReadBuffer(url => {
        return new LocalFile(require.resolve(`../../test_data/${url}`))
      }),
    )
    const pluginManager = getPluginManager(hicConfig)

    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    state.session.views[0].setNewView(5000, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-hic_test'))
    await timeout(1000)
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
})
