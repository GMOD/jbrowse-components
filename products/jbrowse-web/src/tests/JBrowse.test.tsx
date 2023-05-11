import '@testing-library/jest-dom/extend-expect'

import { fireEvent } from '@testing-library/react'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import JBrowseRootModelFactory from '../rootModel/rootModel'
import corePlugins from '../corePlugins'
import * as sessionSharing from '../sessionSharing'
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import { doBeforeEach, setup, createView, hts } from './util'
import TestPlugin from './TestPlugin'
import sessionModelFactory from '../sessionModel'

jest.mock('../makeWorkerInstance', () => () => {})

setup()

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

test('renders with an empty config', async () => {
  const { findByText } = await createView()
  await findByText('Help', {}, delay)
}, 20000)

test('renders with an initialState', async () => {
  const { findByText } = await createView()
  await findByText('Help', {}, delay)
}, 20000)

test('lollipop track test', async () => {
  const { view, findByTestId, findByText } = await createView()
  await findByText('Help')
  view.setNewView(1, 150)
  fireEvent.click(await findByTestId(hts('lollipop_track'), {}, delay))

  await findByTestId('display-lollipop_track_linear', {}, delay)
  await findByTestId('three', {}, delay)
}, 30000)

test('toplevel configuration', () => {
  const pm = new PluginManager([...corePlugins, TestPlugin].map(P => new P()))
  pm.createPluggableElements()
  const rootModel = JBrowseRootModelFactory(
    pm,
    sessionModelFactory,
    true,
  ).create({
    jbrowse: volvoxConfigSnapshot,
    assemblyManager: {},
  })
  rootModel.setDefaultSession()
  pm.setRootModel(rootModel)
  pm.configure()
  const state = pm.rootModel
  const { jbrowse } = state!
  const { configuration } = jbrowse
  // test reading top level configurations added by Test Plugin
  const test = getConf(jbrowse, ['TestPlugin', 'topLevelTest'])
  const test2 = readConfObject(configuration, ['TestPlugin', 'topLevelTest'])
  expect(test).toEqual('test works')
  expect(test2).toEqual('test works')
})

test('assembly aliases', async () => {
  const { view, findByTestId, findByText } = await createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId(hts('volvox_filtered_vcf_assembly_alias'), {}, delay),
  )
  await findByTestId('box-test-vcf-604453', {}, delay)
}, 15000)

test('nclist track test with long name', async () => {
  const { view, findByTestId, findByText } = await createView()
  await findByText('Help')
  view.setNewView(6.2, -301)
  fireEvent.click(await findByTestId(hts('nclist_long_names'), {}, delay))

  await findByText(
    'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuv...',
    {},
    delay,
  )
}, 20000)

test('test sharing', async () => {
  // @ts-expect-error
  sessionSharing.shareSessionToDynamo = jest.fn().mockReturnValue({
    encryptedSession: 'A',
    json: {
      sessionId: 'abc',
    },
    password: '123',
  })
  const { findByLabelText, findByText } = await createView()
  fireEvent.click(await findByText('Share'))
  expect(((await findByLabelText('URL')) as HTMLInputElement).value).toBe(
    'http://localhost/?session=share-abc&password=123',
  )
}, 15000)

test('looks at about this track dialog', async () => {
  const { findByTestId, findAllByText, findByText } = await createView()
  await findByText('Help')

  // load track
  fireEvent.click(await findByTestId(hts('volvox-long-reads-cram')))
  fireEvent.click(await findByTestId('track_menu_icon', {}, delay))
  fireEvent.click(await findByText('About track'))
  await findAllByText(/SQ/, {}, delay)
}, 15000)
