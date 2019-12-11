import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot, types } from 'mobx-state-tree'

const createMockTrackStateModel = track =>
  types
    .model({
      name: 'testSession',
      selectedFeature: types.frozen(),
      bpPerPx: 0.05,
      staticBlocks: types.frozen(),
      track: track.stateModel,
      pluginManager: 'mockPluginManager',
    })
    .actions(self => {
      return {
        setSelection(thing) {
          self.selection = thing
        },
        clearSelection() {
          self.selection = undefined
        },
      }
    })

const createMockTrack = track =>
  createMockTrackStateModel(track).create({
    staticBlocks: [],
    track: {
      configuration: track.configSchema.create({
        type: 'AlignmentsTrack',
      }),
      type: 'AlignmentsTrack',
    },
  })

test('create bam adapter config', () => {
  const { pluginManager } = createTestSession()

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    index: { configId: expect.any(String) },
  })
})
test('create track config', async () => {
  const { pluginManager } = createTestSession()

  const AlignmentsTrack = pluginManager.getTrackType('AlignmentsTrack')
  const config2 = AlignmentsTrack.configSchema.create({
    type: 'AlignmentsTrack',
  })
  expect(getSnapshot(config2)).toMatchSnapshot({
    adapter: {
      index: {
        configId: expect.any(String),
      },
    },
    configId: expect.any(String),
    renderers: {
      PileupRenderer: {
        configId: expect.any(String),
      },
      SvgFeatureRenderer: {
        configId: expect.any(String),
        labels: {
          configId: expect.any(String),
        },
      },
      configId: expect.any(String),
    },
  })
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
