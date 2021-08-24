// library
import { cleanup, render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
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
    const pluginManager = getPluginManager(dotplotConfig, false)
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    const canvas = await findByTestId(
      'prerendered_canvas',
      {},
      { timeout: 10000 },
    )

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 15000)

  it('open a dotplot view with import form', async () => {
    const pluginManager = getPluginManager(dotplotConfig, false)
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByText('File'))
    fireEvent.click(await findByText('Add'))
    fireEvent.click(await findByText('Dotplot view'))
    const inputBox = await findAllByTestId('assembly-selector')
    fireEvent.change(inputBox[0], {
      target: {
        value: 'peach',
      },
    })
    fireEvent.change(await findByTestId('urlInput'), {
      target: {
        value: 'test_data/peach_grape_small.paf',
      },
    })
    fireEvent.click(await findByTestId('submitDotplot'), {
      target: {
        value: 'test_data/peach_grape_small.paf',
      },
    })

    const canvas = await findByTestId(
      'prerendered_canvas',
      {},
      { timeout: 10000 },
    )

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 15000)
})
