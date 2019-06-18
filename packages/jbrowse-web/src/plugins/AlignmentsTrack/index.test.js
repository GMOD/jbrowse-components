import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
import { createTestEnv } from '../../JBrowse'

jest.mock('shortid', () => ({ generate: () => 'testid' }))
test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const AlignmentsTrack = pluginManager.getTrackType('AlignmentsTrack')
  // console.log(AlignmentsTrack)
  const config = AlignmentsTrack.configSchema.create({
    type: 'AlignmentsTrack',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})
