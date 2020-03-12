import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot, types } from 'mobx-state-tree'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import MyPlugin from '.'

const createMockTrackStateModel = (track: TrackType) =>
  types
    .model({
      name: 'testSession',
      selectedFeature: types.frozen(),
      bpPerPx: 0.05,
      staticBlocks: types.frozen(),
      track: track.stateModel,
      pluginManager: 'mockPluginManager',
      configuration: 'mockConfiguration',
      selection: types.frozen(),
    })
    .actions(self => {
      return {
        setSelection(thing: unknown) {
          self.selection = thing
        },
        clearSelection() {
          self.selection = undefined
        },
      }
    })

const createMockTrack = (track: TrackType) =>
  createMockTrackStateModel(track).create({
    staticBlocks: [],
    track: {
      configuration: track.configSchema.create({
        type: 'AlignmentsTrack',
        trackId: 'track0',
      }),
      type: 'AlignmentsTrack',
    },
  })

test('create bam adapter config', () => {
  const { pluginManager } = createTestSession()

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})
test('create track config', async () => {
  const { pluginManager } = createTestSession()

  const AlignmentsTrack = pluginManager.getTrackType('AlignmentsTrack')
  const config2 = AlignmentsTrack.configSchema.create({
    type: 'AlignmentsTrack',
    trackId: 'track0',
  })
  expect(getSnapshot(config2)).toMatchSnapshot()
})

test('test selection in alignments track model with mock session', async () => {
  const session = createTestSession()
  const { pluginManager } = session

  const sessionModel = createMockTrack(
    pluginManager.getTrackType('AlignmentsTrack'),
  )

  // TODO: requires having actual session.addDrawerWidget
  // sessionModel.track.selectFeature({
  //   id() {
  //     return 1234
  //   },
  // })
  // expect(sessionModel.selection.id()).toBe(1234)

  sessionModel.track.clearFeatureSelection()
  expect(sessionModel.selection).not.toBeTruthy()
})

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})
