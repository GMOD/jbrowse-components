import React from 'react'
import '@testing-library/jest-dom/extend-expect'

import { fireEvent, render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { LocalFile } from 'generic-filehandle'
import { TextEncoder } from 'web-encoding'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import * as sessionSharing from '../sessionSharing'
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import { JBrowse, setup, getPluginManager, generateReadBuffer } from './util'
import TestPlugin from './TestPlugin'
jest.mock('../makeWorkerInstance', () => () => {})

window.TextEncoder = TextEncoder

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))
global.Blob = (content, options) => ({ content, options })

expect.extend({ toMatchImageSnapshot })

setup()

const waitForOptions = { timeout: 15000 }

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
    await findByText('Help')
  })
  it('renders with an initialState', async () => {
    const pluginManager = getPluginManager()
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
    await findByText('Help')
  })
})

test('lollipop track test', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(await findByTestId('htsTrackEntry-lollipop_track'))

  await findByTestId('display-lollipop_track_linear', {}, waitForOptions)
  await findByTestId('three', {}, waitForOptions)
}, 10000)

test('toplevel configuration', () => {
  const pluginManager = new PluginManager(
    corePlugins.concat([TestPlugin]).map(P => new P()),
  )
  pluginManager.createPluggableElements()
  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, true)
  const rootModel = JBrowseRootModel.create({
    jbrowse: volvoxConfigSnapshot,
    assemblyManager: {},
  })
  rootModel.setDefaultSession()
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  const state = pluginManager.rootModel
  const { jbrowse } = state
  const { configuration } = jbrowse
  // test reading top level configurations added by Test Plugin
  const test = getConf(jbrowse, ['TestPlugin', 'topLevelTest'])
  const test2 = readConfObject(configuration, ['TestPlugin', 'topLevelTest'])
  expect(test).toEqual('test works')
  expect(test2).toEqual('test works')
})

describe('assembly aliases', () => {
  it('allow a track with an alias assemblyName to display', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_filtered_vcf_assembly_alias'),
    )
    await findByTestId('box-test-vcf-604452', {}, waitForOptions)
  }, 20000)
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
      waitForOptions,
    )
  }, 20000)
})

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
    await findByTestId('share-dialog')
    const url = await findByTestId('share-url-text')
    expect(url.value).toBe('http://localhost/?session=share-abc&password=123')
  })
})

test('looks at about this track dialog', async () => {
  const pluginManager = getPluginManager()
  const { findByTestId, findAllByText, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-volvox-long-reads-cram'))
  fireEvent.click(await findByTestId('track_menu_icon', {}, waitForOptions))
  fireEvent.click(await findByText('About track'))
  await findAllByText(/SQ/, {}, waitForOptions)
}, 15000)
