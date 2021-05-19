// library
import '@testing-library/jest-dom/extend-expect'
import fs from 'fs'
import path from 'path'

import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  getByRole,
} from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { LocalFile } from 'generic-filehandle'
import { TextEncoder } from 'web-encoding'
import FileSaver from 'file-saver'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import * as sessionSharing from '../sessionSharing'
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'
import TestPlugin from './TestPlugin'

window.TextEncoder = TextEncoder

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))
global.Blob = (content, options) => ({ content, options })

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

const waitForOptions = { timeout: 10000 }

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
  await findByTestId('three')
})

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
  const feats1 = await findAllByTestId('test-vcf-604452', {}, waitForOptions)
  fireEvent.click(feats1[0])

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  const feats2 = await findAllByTestId('test-vcf-604452', {}, waitForOptions)
  fireEvent.contextMenu(feats2[0])
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 10000)

test('widget drawer navigation', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  // opens a config editor widget
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor')
  // shows up when there  active widgets
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(
    await findByTestId(
      'widget-drawer-selects-item-HierarchicalTrackSelectorWidget',
    ),
  )
  await findByTestId('hierarchical_track_selector')

  // test minimize and maximize widget drawer
  expect(state.session.minimized).toBeFalsy()

  await findByTestId('drawer-minimize')
  fireEvent.click(await findByTestId('drawer-minimize'))
  expect(state.session.minimized).toBeTruthy()

  fireEvent.click(await findByTestId('drawer-maximize'))
  expect(state.session.minimized).toBeFalsy()

  // test deleting widget from select dropdown using trash icon
  expect(state.session.activeWidgets.size).toEqual(2)
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(await findByTestId('ConfigurationEditorWidget-drawer-delete'))
  expect(state.session.activeWidgets.size).toEqual(1)
}, 10000)

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
      waitForOptions,
    )
  }, 10000)
})

describe('test configuration editor', () => {
  it('change color on track', async () => {
    const pluginManager = getPluginManager(undefined, true)
    const state = pluginManager.rootModel
    const {
      getByTestId,
      findByTestId,
      findByText,
      findByDisplayValue,
    } = render(<JBrowse pluginManager={pluginManager} />)
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
    fireEvent.click(await findByText('Settings'))
    await findByTestId('configEditor')
    fireEvent.change(await findByDisplayValue('goldenrod'), {
      target: { value: 'green' },
    })
    await waitFor(
      () =>
        expect(getByTestId('box-test-vcf-604452')).toHaveAttribute(
          'fill',
          'green',
        ),
      waitForOptions,
    )
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
    await findByTestId('share-dialog')
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
  await findByText('HTTP 404 fetching grape.chrom.sizes.nonexist', {
    exact: false,
  })
})

test('wrong assembly', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findAllByText } = render(<JBrowse pluginManager={pluginManager} />)
  const view = state.session.views[0]
  view.showTrack('volvox_wrong_assembly')
  await findAllByText(
    'Error: region assembly (volvox) does not match track assemblies (wombat)',
    {},
    waitForOptions,
  )
}, 15000)

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

test('export svg', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_alignments_pileup_coverage'),
  )

  state.session.views[0].exportSvg()

  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), {
    timeout: 25000,
  })

  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 25000)
