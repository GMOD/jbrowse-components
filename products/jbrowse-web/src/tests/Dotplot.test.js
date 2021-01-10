// library
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import dotplotConfig from '../../test_data/config_dotplot.json'

import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

dotplotConfig.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/${url}`))
    }),
  )
})

describe('dotplot view', () => {
  it('open a dotplot view', async () => {
    const pluginManager = getPluginManager(
      dotplotConfig,
      false,
      'Grape vs Peach (small)',
    )
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    let canvas
    try {
      canvas = await findByTestId('prerendered_canvas', { timeout: 20000 })
    } catch (e) {
      canvas = await findByTestId('prerendered_canvas', { timeout: 20000 })
    }

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  })
}, 25000)
