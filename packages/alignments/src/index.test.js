import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot, types } from 'mobx-state-tree'
import MyPlugin from '.'

const createMockTrackStateModel = (track, trackTwo, trackThree) =>
  types
    .model({
      name: 'testSession',
      selectedFeature: types.frozen(),
      bpPerPx: 0.05,
      staticBlocks: types.frozen(),
      PileupTrack: types.maybe(trackTwo.stateModel),
      SNPCoverageTrack: types.maybe(trackThree.stateModel),
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

const createMockTrack = (track, pileup, snpcoverage) =>
  createMockTrackStateModel(track, pileup, snpcoverage).create({
    staticBlocks: [],
    track: {
      configuration: track.configSchema.create({
        type: 'AlignmentsTrack',
        trackId: 'track0',
      }),
      type: 'AlignmentsTrack',
    },
    PileupTrack: {
      configuration: pileup.configSchema.create({
        type: 'PileupTrack',
        name: 'track0_pileup',
        trackId: 'track0_pileup',
      }),
      type: 'PileupTrack',
    },
    SNPCoverageTrack: {
      configuration: snpcoverage.configSchema.create({
        type: 'SNPCoverageTrack',
        name: 'track0_snpcoverage',
        trackId: 'track0_snpcoverage',
      }),
      type: 'SNPCoverageTrack',
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

test('has pileup and alignment tracks', async () => {
  const session = createTestSession()
  const { pluginManager } = session

  const sessionModel = createMockTrack(
    pluginManager.getTrackType('AlignmentsTrack'),
    pluginManager.getTrackType('PileupTrack'),
    pluginManager.getTrackType('SNPCoverageTrack'),
  )

  expect(sessionModel.PileupTrack).toBeTruthy()
  expect(sessionModel.SNPCoverageTrack).toBeTruthy()
})

test('test selection in alignments track model with mock session', async () => {
  const session = createTestSession()
  const { pluginManager } = session

  const sessionModel = createMockTrack(
    pluginManager.getTrackType('AlignmentsTrack'),
    pluginManager.getTrackType('PileupTrack'),
    pluginManager.getTrackType('SNPCoverageTrack'),
  )

  // TODO: requires having actual session.addDrawerWidget
  // sessionModel.track.selectFeature({
  //   id() {
  //     return 1234
  //   },
  // })
  // expect(sessionModel.selection.id()).toBe(1234)

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
