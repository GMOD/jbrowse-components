// library
import { cleanup, render } from '@testing-library/react'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import dotplotConfig from '../../test_data/config_dotplot.json'

import { setup, readBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})

describe('dotplot view', () => {
  it('open a dotplot view', async () => {
    const pluginManager = getPluginManager(dotplotConfig)
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    const canvas = await findByTestId('prerendered_canvas')

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
})
