// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import ErrorBoundary from 'react-error-boundary'
import { LocalFile } from 'generic-filehandle'
import { TextEncoder } from 'fastestsmallesttextencoderdecoder'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import * as sessionSharing from '../sessionSharing'
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'

window.TextEncoder = TextEncoder

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
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

  await findByTestId('display-lollipop_track_linear')
  await expect(findByTestId('three')).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  state.session.views[0].tracks[0].displays[0].setFeatureIdUnderMouse(
    'test-vcf-604452',
  )
  const feats1 = await findAllByTestId(
    'test-vcf-604452',
    {},
    { timeout: 10000 },
  )
  fireEvent.click(feats1[0])

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  fireEvent.click(await findByTestId('drawer-close'))
  const feats2 = await findAllByTestId(
    'test-vcf-604452',
    {},
    { timeout: 10000 },
  )
  fireEvent.contextMenu(feats2[0])
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 10000)

describe('assembly aliases', () => {
  it('allow a track with an alias assemblyName to display', async () => {
    const variantTrack = volvoxConfigSnapshot.tracks.find(
      track => track.trackId === 'volvox_filtered_vcf',
    )
    const assemblyAliasVariantTrack = JSON.parse(JSON.stringify(variantTrack))
    assemblyAliasVariantTrack.assemblyNames = ['vvx']
    const pluginManager = getPluginManager({
      ...volvoxConfigSnapshot,
      tracks: [assemblyAliasVariantTrack],
    })
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    state.session.views[0].tracks[0].displays[0].setFeatureIdUnderMouse(
      'test-vcf-604452',
    )
    const feat = await findByTestId('test-vcf-604452', {}, { timeout: 10000 })
    expect(feat).toBeTruthy()
  }, 10000)
})

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

    await findByText(
      'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz1...',
      {},
      { timeout: 10000 },
    )
  })
})
describe('test configuration editor', () => {
  it('change color on track', async () => {
    const pluginManager = getPluginManager(undefined, true)
    const state = pluginManager.rootModel
    const {
      findByTestId,
      findAllByTestId,
      findByText,
      findByDisplayValue,
    } = render(<JBrowse pluginManager={pluginManager} />)
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
    fireEvent.click(await findByText('Settings'))
    await expect(findByTestId('configEditor')).resolves.toBeTruthy()
    const input = await findByDisplayValue('goldenrod')
    fireEvent.change(input, { target: { value: 'green' } })
    await waitFor(async () => {
      const feats = await findAllByTestId('box-test-vcf-604452')
      expect(feats[0]).toHaveAttribute('fill', 'green')
    })
  }, 10000)
})

// eslint-disable-next-line react/prop-types
function FallbackComponent({ error }) {
  return <div>there was an error: {String(error)}</div>
}

describe('test sharing', () => {
  sessionSharing.shareSessionToDynamo = jest.fn().mockReturnValue({
    encryptedSession: 'A',
    json: {
      sessionId: 'abc',
    },
    password: '123',
  })
  it('can click and share a session', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    fireEvent.click(await findByText('Share'))

    // check the share dialog has the above session shared
    expect(await findByTestId('share-dialog')).toBeTruthy()
    const url = await findByTestId('share-url-text')
    expect(url.value).toBe('http://localhost/?session=share-abc&password=123')
  })
})

test('404 sequence file', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager(chromeSizesConfig)
  const { findByText } = render(
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <JBrowse pluginManager={pluginManager} />
    </ErrorBoundary>,
  )
  expect(
    await findByText('HTTP 404 fetching grape.chrom.sizes.nonexist', {
      exact: false,
    }),
  ).toBeTruthy()
})

test('looks at about this track dialog', async () => {
  const pluginManager = getPluginManager()
  const { findByTestId, findAllByText, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-volvox-long-reads-cram'))
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('About this track'))
  await findAllByText(/SQ/, {}, { timeout: 10000 })
})
