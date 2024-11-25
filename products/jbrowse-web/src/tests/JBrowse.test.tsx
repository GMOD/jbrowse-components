import '@testing-library/jest-dom'

import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import { fireEvent } from '@testing-library/react'

// locals
import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
import TestPlugin from './TestPlugin'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import * as sessionSharing from '../sessionSharing'
import { doBeforeEach, setup, createView, hts } from './util'
import sessionModelFactory from '../sessionModel'

jest.mock('../makeWorkerInstance', () => () => {})

setup()

const delay = { timeout: 30000 }

beforeEach(() => {
  doBeforeEach()
})

test('renders with an empty config', async () => {
  const { findByText } = await createView()
  await findByText('Help', {}, delay)
}, 20000)

test('lollipop track test', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(1, 150)
  fireEvent.click(await findByTestId(hts('lollipop_track'), {}, delay))

  await findByTestId('display-lollipop_track_linear', {}, delay)
  await findByTestId('three', {}, delay)
}, 30000)

test('toplevel configuration', () => {
  const plugins = [...corePlugins, TestPlugin].map(P => new P())
  const pluginManager = new PluginManager(plugins).createPluggableElements()
  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: true,
  }).create(
    {
      jbrowse: volvoxConfigSnapshot,
    },
    { pluginManager },
  )
  rootModel.setDefaultSession()
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  const state = pluginManager.rootModel
  const { jbrowse } = state!
  const { configuration } = jbrowse
  // test reading top level configurations added by Test Plugin
  const test = getConf(jbrowse, ['TestPlugin', 'topLevelTest'])
  const test2 = readConfObject(configuration, ['TestPlugin', 'topLevelTest'])
  expect(test).toEqual('test works')
  expect(test2).toEqual('test works')
})

test('assembly aliases', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId(hts('volvox_filtered_vcf_assembly_alias'), {}, delay),
  )
  await findByTestId('box-test-vcf-604453', {}, delay)
}, 30000)

test('nclist track test with long name', async () => {
  const { view, findByTestId, findByText } = await createView()
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
  expect(
    ((await findByLabelText('URL', {}, delay)) as HTMLInputElement).value,
  ).toBe('http://localhost/?session=share-abc&password=123')
}, 30000)

test('looks at about this track dialog', async () => {
  const { findByTestId, findAllByText, findByText } = await createView()

  // load track
  fireEvent.click(await findByTestId(hts('volvox-long-reads-cram'), {}, delay))
  fireEvent.click(await findByTestId('track_menu_icon', {}, delay))
  fireEvent.click(await findByText('About track'))
  await findAllByText(/SQ/, {}, delay)
}, 30000)
