// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, render, wait } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import breakpointConfig from '../../test_data/breakpoint/config.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, readBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})

xdescribe('breakpoint split view', () => {
  it('open a split view', async () => {
    console.warn = jest.fn()
    const pluginManager = getPluginManager(breakpointConfig)
    const { findByTestId, queryAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await wait(() => {
      const r = queryAllByTestId('r1')
      expect(r.length).toBe(2)
    }) // the breakpoint could be partially loaded so explicitly wait for two items
    expect(
      await findByTestId('pacbio_hg002_breakpoints-loaded'),
    ).toMatchSnapshot()

    expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
  }, 10000)
})
