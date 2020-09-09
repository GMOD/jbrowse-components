// library
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

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

describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray'))
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
  it('open a bigwig line track 2', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(10, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray_line'))
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
  it('open a bigwig density track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density'),
    )
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
})
