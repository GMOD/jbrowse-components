// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render, wait } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import ErrorBoundary from 'react-error-boundary'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'
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

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const pluginManager = getPluginManager({})
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
    expect(await findByText('Help')).toBeTruthy()
  })
  it('renders with an initialState', async () => {
    const pluginManager = getPluginManager()
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
    expect(await findByText('Help')).toBeTruthy()
  })
})

describe('max height test', () => {})

test('lollipop track test', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(await findByTestId('htsTrackEntry-lollipop_track'))

  await findByTestId('track-lollipop_track')
  await expect(findByTestId('three')).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  fireEvent.click(await findByTestId('test-vcf-604452'))

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  fireEvent.click(await findByTestId('drawer-close'))
  fireEvent.contextMenu(await findByTestId('test-vcf-604452'))
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 10000)

describe('nclist track test with long name', () => {
  it('see that a feature gets ellipses', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(1, -539)
    fireEvent.click(await findByTestId('htsTrackEntry-nclist_long_names'))
    await expect(
      findByText(
        'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz1...',
      ),
    ).resolves.toBeTruthy()
  })
})
describe('test configuration editor', () => {
  it('change color on track', async () => {
    const pluginManager = getPluginManager(undefined, true)
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findByDisplayValue } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    fireEvent.click(
      await findByTestId('htsTrackEntryConfigure-volvox_filtered_vcf'),
    )
    await expect(findByTestId('configEditor')).resolves.toBeTruthy()
    const input = await findByDisplayValue('goldenrod')
    fireEvent.change(input, { target: { value: 'green' } })
    await wait(async () => {
      expect(await findByTestId('test-vcf-604452')).toHaveAttribute(
        'fill',
        'green',
      )
    })
  }, 10000)
})

// eslint-disable-next-line react/prop-types
function FallbackComponent({ error }) {
  return <div>there was an error: {String(error)}</div>
}

test('404 sequence file', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager(chromeSizesConfig)
  const { findByText } = render(
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <JBrowse pluginManager={pluginManager} />
    </ErrorBoundary>,
  )
  expect(
    await findByText('HTTP 404 fetching test_data/grape.chrom.sizes.nonexist', {
      exact: false,
    }),
  ).toBeTruthy()
})
