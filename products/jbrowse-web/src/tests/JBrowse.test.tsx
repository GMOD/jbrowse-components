import '@testing-library/jest-dom'

import PluginManager from '@jbrowse/core/PluginManager'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import volvoxConfigSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import sessionModelFactory from '../sessionModel'
import * as sessionSharing from '../sessionSharing'
import TestPlugin from './TestPlugin'
import { createView, expectCanvasMatch, openTrackMenu, setupTest } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

setupTest()

const delay = { timeout: 30000 }

test('renders with an empty config', async () => {
  const { findByText } = await createView()
  await findByText('Help', {}, delay)
}, 20000)

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
  const { view, findByTestId, findAllByTestId } = await createView()
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId(hts('volvox_filtered_vcf_assembly_alias'), {}, delay),
  )
  expectCanvasMatch(
    (await findAllByTestId(/prerendered_canvas/, {}, delay))[0]!,
  )
}, 30000)

xtest('nclist track test with long name', async () => {
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
  const user = userEvent.setup()
  await createView()

  // load track
  await openTrackMenu(user, 'volvox-long-reads-cram')
  await user.click(await screen.findByText('About track'))
  await screen.findAllByText(/SQ/, {}, delay)
}, 30000)
