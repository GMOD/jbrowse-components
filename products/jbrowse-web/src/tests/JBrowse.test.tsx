import '@testing-library/jest-dom/extend-expect'

import { fireEvent } from '@testing-library/react'
import { TextEncoder } from 'web-encoding'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import * as sessionSharing from '../sessionSharing'
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import { doBeforeEach, setup, createView, hts } from './util'
import TestPlugin from './TestPlugin'

jest.mock('../makeWorkerInstance', () => () => {})

window.TextEncoder = TextEncoder
setup()

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

test('renders with an empty config', async () => {
  const { findByText } = createView()
  await findByText('Help')
})
test('renders with an initialState', async () => {
  const { findByText } = createView()
  await findByText('Help')
})

test('lollipop track test', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(1, 150)
  fireEvent.click(await findByTestId(hts('lollipop_track'), {}, delay))

  await findByTestId('display-lollipop_track_linear', {}, delay)
  await findByTestId('three', {}, delay)
}, 10000)

test('toplevel configuration', () => {
  const pm = new PluginManager([...corePlugins, TestPlugin].map(P => new P()))
  pm.createPluggableElements()
  const JBrowseRootModel = JBrowseRootModelFactory(pm, true)
  const rootModel = JBrowseRootModel.create({
    jbrowse: volvoxConfigSnapshot,
    assemblyManager: {},
  })
  rootModel.setDefaultSession()
  pm.setRootModel(rootModel)
  pm.configure()
  const state = pm.rootModel
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { jbrowse } = state!
  const { configuration } = jbrowse
  // test reading top level configurations added by Test Plugin
  const test = getConf(jbrowse, ['TestPlugin', 'topLevelTest'])
  const test2 = readConfObject(configuration, ['TestPlugin', 'topLevelTest'])
  expect(test).toEqual('test works')
  expect(test2).toEqual('test works')
})

test('assembly aliases', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId(hts('volvox_filtered_vcf_assembly_alias'), {}, delay),
  )
  await findByTestId('box-test-vcf-604452', {}, delay)
}, 15000)

test('nclist track test with long name', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(1, -539)
  fireEvent.click(await findByTestId(hts('nclist_long_names'), {}, delay))

  await findByText(
    'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz1...',
    {},
    delay,
  )
}, 15000)

test('test sharing', async () => {
  // @ts-ignore
  sessionSharing.shareSessionToDynamo = jest.fn().mockReturnValue({
    encryptedSession: 'A',
    json: {
      sessionId: 'abc',
    },
    password: '123',
  })
  const { findByTestId, findByText } = createView()
  await findByText('Help')
  fireEvent.click(await findByText('Share'))

  // check the share dialog has the above session shared
  await findByTestId('share-dialog')
  const url = (await findByTestId('share-url-text')) as HTMLInputElement
  expect(url.value).toBe('http://localhost/?session=share-abc&password=123')
})

test('looks at about this track dialog', async () => {
  const { findByTestId, findAllByText, findByText } = createView()
  await findByText('Help')

  // load track
  fireEvent.click(await findByTestId(hts('volvox-long-reads-cram')))
  fireEvent.click(await findByTestId('track_menu_icon', {}, delay))
  fireEvent.click(await findByText('About track'))
  await findAllByText(/SQ/, {}, delay)
}, 15000)
