import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
import { createTestEnv } from '../../JBrowse'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const VariantTrack = pluginManager.getTrackType('VariantTrack')
  const config = VariantTrack.configSchema.create({ type: 'VariantTrack' })
  expect(getSnapshot(config)).toMatchSnapshot()
})
